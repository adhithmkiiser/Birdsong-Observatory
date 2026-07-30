import time
import os
import sys
import logging
from config import Config
from database import SQLiteReader
from storage import SupabaseStorage
from supabase_db import SupabaseDB
from state import StateManager
from logger import setup_logger

logger = setup_logger()

import argparse
import requests

def register_in_recorders_registry(url, key, project_name, site_name, recorder_id):
    endpoint = f"{url.rstrip('/')}/rest/v1/recorders_registry"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    payload = {
        "project_type": "Live",
        "project_name": project_name,
        "site_name": site_name,
        "recorder_id": recorder_id,
        "status": "ONLINE",
        "last_ping": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }
    try:
        r = requests.post(endpoint, headers=headers, json=[payload])
        if r.status_code in [200, 201, 204]:
            logger.info(f"Registered/Pinged recorder in recorders_registry: {recorder_id} ({site_name} @ {project_name})")
        else:
            logger.warning(f"Could not register in recorders_registry (HTTP {r.status_code}): {r.text}")
    except Exception as e:
        logger.error(f"Failed to register in recorders_registry: {e}")

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

    # Upsert info into recorders_registry table
    register_in_recorders_registry(config.SUPABASE_URL, config.SUPABASE_KEY, project_name, site_name, recorder_id)

    sqlite_reader = SQLiteReader(config.SQLITE_DB, config.AUDIO_ROOT)
    storage = SupabaseStorage(config.SUPABASE_URL, config.SUPABASE_KEY)
    db = SupabaseDB(config.SUPABASE_URL, config.SUPABASE_KEY)
    state_manager = StateManager(config.STATE_FILE)

    logger.info(f"Project Name : {project_name}")
    logger.info(f"Site Name    : {site_name}")
    logger.info(f"Recorder ID  : {recorder_id}")
    logger.info(f"Sync Interval: {config.SYNC_INTERVAL} seconds")
    logger.info(f"Last RowID   : {state_manager.get_last_rowid()}")

    while True:
        try:
            run_sync_cycle(config, sqlite_reader, storage, db, state_manager, project_name, site_name, recorder_id)
            register_in_recorders_registry(config.SUPABASE_URL, config.SUPABASE_KEY, project_name, site_name, recorder_id)
        except Exception as e:
            logger.error(f"Unexpected error in sync cycle: {e}", exc_info=True)

        time.sleep(config.SYNC_INTERVAL)

if __name__ == "__main__":
    main()
