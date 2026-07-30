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

def run_sync_cycle(config, sqlite_reader, storage, db, state_manager):
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
                station_id=config.STATION_ID,
                date_str=date_str,
                filename=file_name
            )
            if not audio_url:
                logger.warning(f"Audio upload failed for {file_name}, proceeding with metadata only.")
        else:
            logger.warning(f"MP3 file not found for detection {file_name} (rowid: {rowid}). Skipping audio upload.")

        # Prepare payload for live_detections table
        timestamp_iso = f"{date_str}T{time_str}Z"
        payload = {
          "station_id": config.STATION_ID,
          "station_name": config.STATION_NAME,
          "common_name": detection['com_name'],
          "scientific_name": detection['sci_name'],
          "confidence": float(detection['confidence']),
          "timestamp": timestamp_iso,
          "date_str": date_str,
          "time_str": time_str,
          "duration": 3.0,
          "audio_url": audio_url
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
    logger.info("==========================================")
    logger.info("Starting BirdNET-Pi to Supabase Sync Engine")
    logger.info("==========================================")

    config = Config()
    config.validate()

    sqlite_reader = SQLiteReader(config.SQLITE_DB, config.AUDIO_ROOT)
    storage = SupabaseStorage(config.SUPABASE_URL, config.SUPABASE_KEY)
    db = SupabaseDB(config.SUPABASE_URL, config.SUPABASE_KEY)
    state_manager = StateManager(config.STATE_FILE)

    logger.info(f"Station ID   : {config.STATION_ID}")
    logger.info(f"Station Name : {config.STATION_NAME}")
    logger.info(f"Sync Interval: {config.SYNC_INTERVAL} seconds")
    logger.info(f"Last RowID   : {state_manager.get_last_rowid()}")

    while True:
        try:
            run_sync_cycle(config, sqlite_reader, storage, db, state_manager)
        except Exception as e:
            logger.error(f"Unexpected error in sync cycle: {e}", exc_info=True)

        time.sleep(config.SYNC_INTERVAL)

if __name__ == "__main__":
    main()
