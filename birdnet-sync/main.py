import time
import os
import re
import sys
import logging
from datetime import datetime, timezone
from config import Config
from database import SQLiteReader
from storage import SupabaseStorage
from supabase_db import SupabaseDB
from state import StateManager
from logger import setup_logger

logger = setup_logger()

import argparse
import requests

import shutil

def slugify(name: str) -> str:
    return re.sub(r'[-\s]+', '_', name.strip().lower())

def get_system_telemetry():
    cpu_temp = 45.0
    try:
        if os.path.exists("/sys/class/thermal/thermal_zone0/temp"):
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                cpu_temp = round(float(f.read().strip()) / 1000.0, 1)
    except Exception:
        pass
    
    storage_used_percent = 50.0
    try:
        total, used, free = shutil.disk_usage("/")
        storage_used_percent = round((used / total) * 100, 1)
    except Exception:
        pass
        
    return cpu_temp, storage_used_percent

def supabase_rest(url: str, key: str, table: str, method: str = "GET", params=None, data=None, headers_extra=None):
    endpoint = f"{url.rstrip('/')}/rest/v1/{table}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if headers_extra:
        headers.update(headers_extra)
    try:
        if method == "GET":
            r = requests.get(endpoint, headers=headers, params=params)
        elif method == "POST":
            r = requests.post(f"{endpoint}?on_conflict=id", headers=headers, json=data)
        elif method == "PATCH":
            r = requests.patch(endpoint, headers=headers, params=params, json=data)
        else:
            r = requests.request(method, endpoint, headers=headers, params=params, json=data)
        return r
    except Exception as e:
        logger.error(f"Supabase REST call failed for {table}: {e}")
        return None

def ensure_project_exists(url: str, key: str, project_name: str, lat: float, long: float):
    project_id = slugify(project_name)
    # Try to get existing
    r = supabase_rest(url, key, "projects", "GET", params={"id": f"eq.{project_id}", "select": "id,name"})
    if r and r.status_code == 200 and r.json():
        return project_id

    # Create if missing
    payload = {
        "id": project_id,
        "name": project_name,
        "project_type": "Live",
        "description": "Real-time live streaming bioacoustics project.",
        "organization": "IISER Tirupati Bird Lab",
        "stations_count": 0,
        "species_count": 0,
        "total_detections": 0
    }
    r = supabase_rest(url, key, "projects", "POST", data=[payload], headers_extra={"Prefer": "return=representation"})
    if r and r.status_code in [200, 201, 204]:
        logger.info(f"Created new Live project in Supabase: {project_name} ({project_id})")
        return project_id
    else:
        logger.error(f"Failed to create project {project_name}: {r.status_code if r else 'no response'} {r.text if r else ''}")
        return project_id

def ensure_site_exists(url: str, key: str, project_id: str, site_name: str, lat: float, long: float):
    site_id = slugify(f"{project_id}_{site_name}")
    r = supabase_rest(url, key, "sites", "GET", params={"id": f"eq.{site_id}", "select": "id"})
    if r and r.status_code == 200 and r.json():
        return site_id

    payload = {
        "id": site_id,
        "project_id": project_id,
        "name": site_name,
        "latitude": lat,
        "longitude": long,
        "status": "Active"
    }
    r = supabase_rest(url, key, "sites", "POST", data=[payload], headers_extra={"Prefer": "return=representation"})
    if r and r.status_code in [200, 201, 204]:
        logger.info(f"Created new Live site in Supabase: {site_name} ({site_id})")
    else:
        logger.error(f"Failed to create site {site_name}: {r.status_code if r else 'no response'} {r.text if r else ''}")
    return site_id

def register_in_recorders_registry(url, key, project_name, site_name, recorder_id, lat=13.58, long=75.64):
    endpoint = f"{url.rstrip('/')}/rest/v1/recorders_registry"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    # Ensure project and site exist before registering
    project_id = ensure_project_exists(url, key, project_name, lat, long)
    ensure_site_exists(url, key, project_id, site_name, lat, long)

    # Composite primary key allows the same recorder_id under different projects/sites
    # while the same project/site/recorder always upserts in place.
    registry_id = f"{project_id}::{slugify(site_name)}::{recorder_id}"
    
    cpu_temp, storage_used = get_system_telemetry()

    payload = {
        "id": registry_id,
        "project_type": "Live",
        "project_name": project_name,
        "site_name": site_name,
        "recorder_id": recorder_id,
        "status": "online",
        "lat": lat,
        "long": long,
        "cpu_temperature": cpu_temp,
        "storage_used_percent": storage_used,
        "last_ping": datetime.now(timezone.utc).isoformat()
    }
    try:
        r = requests.post(f"{endpoint}?on_conflict=id", headers=headers, json=[payload])
        if r.status_code in [200, 201, 204]:
            logger.info(f"Registered/Pinged recorder in recorders_registry: {recorder_id} ({site_name} @ {project_name}) [lat: {lat}, long: {long}]")
            return True
        else:
            logger.warning(f"Could not register in recorders_registry (HTTP {r.status_code}): {r.text}")
    except Exception as e:
        logger.error(f"Failed to register in recorders_registry: {e}")
    return False

def run_sync_cycle(config, sqlite_reader, storage, db, state_manager, project_name, site_name, recorder_id):
    last_rowid = state_manager.get_last_rowid()
    new_detections = sqlite_reader.get_detections_after(last_rowid)

    if not new_detections:
        logger.debug("No new detections found.")
        return

    logger.info(f"Found {len(new_detections)} new detection(s) to process.")

    for detection in new_detections:
        rowid = detection['rowid']
        file_name = detection['file_name']
        date_str = detection['date']
        time_str = detection['time']

        # Locate MP3 file
        mp3_path = sqlite_reader.locate_mp3(file_name, date_str, detection['com_name'])

        audio_url = None
        if mp3_path and os.path.exists(mp3_path):
            logger.info(f"Uploading audio clip: {file_name}")
            audio_url = storage.upload_audio(
                local_path=mp3_path,
                station_id=recorder_id,
                date_str=date_str,
                filename=file_name
            )
        else:
            logger.warning(f"MP3 file not found for detection {file_name} (rowid: {rowid}). Skipping audio upload.")

        # Prepare payload for live_detections table
        timestamp_iso = f"{date_str}T{time_str}Z"
        payload = {
          "project_name": project_name,
          "site_name": site_name,
          "recorder_id": recorder_id,
          "station_id": recorder_id,
          "station_name": site_name,
          "common_name": detection['com_name'],
          "scientific_name": detection['sci_name'],
          "confidence": float(detection['confidence']),
          "timestamp": timestamp_iso,
          "date_str": date_str,
          "time_str": time_str,
          "duration": 3.0,
          "audio_url": audio_url,
          "reviewed": False,
          "verified": False,
          "verification_status": "PENDING"
        }

        # Insert metadata into Supabase
        success = db.insert_detection(payload)
        if success:
            state_manager.update_last_rowid(rowid)
            logger.info(f"Successfully synced detection rowid {rowid}: {detection['com_name']} ({detection['confidence']})")
        else:
            logger.error(f"Failed to insert detection metadata for rowid {rowid}. Will retry on next cycle.")
            break # Stop loop to maintain strict sequential order

def main():
    parser = argparse.ArgumentParser(description="BirdNET-Pi to Supabase Live Sync Daemon")
    parser.add_argument("--project", type=str, help="Target Live Project Name (e.g. Bird_Lab_demo)", default=None)
    parser.add_argument("--site", type=str, help="Target Site Name (e.g. Test_lab_1)", default=None)
    parser.add_argument("--recorder", type=str, help="Unique Recorder ID (e.g. station_01)", default=None)
    args = parser.parse_args()

    logger.info("==========================================")
    logger.info("Starting BirdNET-Pi to Supabase Sync Engine")
    logger.info("==========================================")

    config = Config()
    config.validate()

    project_name = args.project or os.getenv("PROJECT_NAME") or getattr(config, "PROJECT_NAME", "Bird_Lab_demo")
    site_name = args.site or os.getenv("SITE_NAME") or getattr(config, "STATION_NAME", "Test_lab_1")
    recorder_id = args.recorder or os.getenv("RECORDER_ID") or getattr(config, "STATION_ID", "station_01")

    # Upsert info into recorders_registry table with exact BirdNET-Pi GPS coordinates
    register_in_recorders_registry(config.SUPABASE_URL, config.SUPABASE_KEY, project_name, site_name, recorder_id, config.LATITUDE, config.LONGITUDE)

    sqlite_reader = SQLiteReader(config.SQLITE_DB, config.AUDIO_ROOT)
    storage = SupabaseStorage(config.SUPABASE_URL, config.SUPABASE_KEY)
    db = SupabaseDB(config.SUPABASE_URL, config.SUPABASE_KEY)
    state_manager = StateManager(config.STATE_FILE)

    logger.info(f"Project Name : {project_name}")
    logger.info(f"Site Name    : {site_name}")
    logger.info(f"Recorder ID  : {recorder_id}")
    logger.info(f"Coordinates  : Lat {config.LATITUDE}° N, Lng {config.LONGITUDE}° E")
    logger.info(f"Sync Interval: {config.SYNC_INTERVAL} seconds")
    logger.info(f"Last RowID   : {state_manager.get_last_rowid()}")

    while True:
        try:
            run_sync_cycle(config, sqlite_reader, storage, db, state_manager, project_name, site_name, recorder_id)
            register_in_recorders_registry(config.SUPABASE_URL, config.SUPABASE_KEY, project_name, site_name, recorder_id, config.LATITUDE, config.LONGITUDE)
        except Exception as e:
            logger.error(f"Unexpected error in sync cycle: {e}", exc_info=True)

        time.sleep(config.SYNC_INTERVAL)

if __name__ == "__main__":
    main()
