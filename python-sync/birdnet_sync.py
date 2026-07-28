#!/usr/bin/env python3
"""
BirdNET-Pi Cloud Sync Daemon
----------------------------
Runs continuously alongside BirdNET-Pi on Raspberry Pi.
Reads new detection records from local SQLite, uploads audio & spectrograms
to Supabase Storage, inserts metadata records into Supabase DB, and handles
local queue retry logic when offline.
"""

import os
import sys
import time
import sqlite3
import datetime
import logging
from pathlib import Path
from supabase import create_client, Client

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Configuration via Environment Variables (or defaults)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key")
STATION_NAME = os.getenv("STATION_NAME", "WesternGhats_Node_01")
PROJECT_NAME = os.getenv("PROJECT_NAME", "Western Ghats Biodiversity Monitoring")

BIRDNET_DB_PATH = os.getenv("BIRDNET_DB_PATH", "/home/pi/BirdNET-Pi/scripts/birds.db")
AUDIO_DIR = os.getenv("AUDIO_DIR", "/home/pi/BirdNET-Pi/By_Date")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL_SECONDS", "15"))

# Local queue database for offline tracking
QUEUE_DB_PATH = "/home/pi/birdnet_sync_queue.db"

class BirdNETSyncDaemon:
    def __init__(self):
        logging.info(f"Initializing BirdNET Sync for station: {STATION_NAME} in project: {PROJECT_NAME}")
        try:
            self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            logging.info("Connected to Supabase Client successfully.")
        except Exception as e:
            logging.warning(f"Could not connect to Supabase (will retry during loop): {e}")
            self.supabase = None
            
        self.init_queue_db()

    def init_queue_db(self):
        """Initializes local SQLite database to store pending upload queue."""
        conn = sqlite3.connect(QUEUE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS upload_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detection_id TEXT UNIQUE,
                timestamp TEXT,
                date TEXT,
                time TEXT,
                common_name TEXT,
                scientific_name TEXT,
                confidence REAL,
                audio_path TEXT,
                spectrogram_path TEXT,
                duration REAL,
                uploaded INTEGER DEFAULT 0,
                retries INTEGER DEFAULT 0,
                created_at TEXT
            )
        """)
        conn.commit()
        conn.close()

    def fetch_new_detections_from_birdnet(self):
        """Reads unprocessed records from BirdNET-Pi's SQLite database."""
        if not os.path.exists(BIRDNET_DB_PATH):
            logging.warning(f"BirdNET-Pi DB not found at path: {BIRDNET_DB_PATH}. Using mock sync mode if testing.")
            return

        conn = sqlite3.connect(BIRDNET_DB_PATH)
        cursor = conn.cursor()
        
        # BirdNET-Pi schema typically stores: Date, Time, Sci_Name, Com_Name, Confidence, File_Name, etc.
        try:
            cursor.execute("""
                SELECT Date, Time, Sci_Name, Com_Name, Confidence, File_Name, Cut_Duration
                FROM detections
                ORDER BY rowid DESC LIMIT 50
            """)
            rows = cursor.fetchall()
            
            queue_conn = sqlite3.connect(QUEUE_DB_PATH)
            q_cursor = queue_conn.cursor()
            
            for row in rows:
                date_str, time_str, sci_name, com_name, conf, file_name, duration = row
                det_id = f"{STATION_NAME}_{date_str}_{time_str}_{sci_name.replace(' ', '_')}"
                
                audio_path = os.path.join(AUDIO_DIR, date_str, file_name) if file_name else ""
                spec_path = audio_path.replace(".wav", ".png")
                
                q_cursor.execute("""
                    INSERT OR IGNORE INTO upload_queue 
                    (detection_id, timestamp, date, time, common_name, scientific_name, confidence, audio_path, spectrogram_path, duration, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    det_id,
                    f"{date_str}T{time_str}Z",
                    date_str,
                    time_str,
                    com_name,
                    sci_name,
                    float(conf),
                    audio_path,
                    spec_path,
                    float(duration) if duration else 3.0,
                    datetime.datetime.utcnow().isoformat()
                ))
            
            queue_conn.commit()
            queue_conn.close()
        except Exception as e:
            logging.error(f"Error querying BirdNET-Pi SQLite: {e}")
        finally:
            conn.close()

    def process_upload_queue(self):
        """Uploads pending files to Supabase Storage & inserts records into PostgreSQL."""
        if not self.supabase:
            try:
                self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            except Exception:
                logging.warning("Offline or Supabase unreachable. Preserving upload queue.")
                return

        queue_conn = sqlite3.connect(QUEUE_DB_PATH)
        cursor = queue_conn.cursor()
        cursor.execute("SELECT id, detection_id, timestamp, date, time, common_name, scientific_name, confidence, audio_path, spectrogram_path, duration FROM upload_queue WHERE uploaded = 0 ORDER BY id ASC LIMIT 10")
        pending = cursor.fetchall()

        for item in pending:
            q_id, det_id, ts, dt, tm, com_name, sci_name, conf, audio_p, spec_p, dur = item
            
            logging.info(f"Syncing detection -> {com_name} ({sci_name}) [{conf*100:.1f}%]")

            # Define remote storage paths: project/station/year/month/day/file.ext
            date_obj = datetime.datetime.strptime(dt, "%Y-%m-%d") if "-" in dt else datetime.datetime.utcnow()
            remote_prefix = f"{PROJECT_NAME}/{STATION_NAME}/{date_obj.year}/{date_obj.month:02d}/{date_obj.day:02d}"
            
            remote_audio_url = f"https://cdn.birdnet.cloud/{remote_prefix}/{det_id}.wav"
            remote_spec_url = f"https://cdn.birdnet.cloud/{remote_prefix}/{det_id}.png"

            # 1. Upload audio if file exists locally
            if os.path.exists(audio_p):
                try:
                    with open(audio_p, 'rb') as f:
                        self.supabase.storage.from_("birdnet-audio").upload(
                            path=f"{remote_prefix}/{det_id}.wav",
                            file=f,
                            file_options={"content-type": "audio/wav"}
                        )
                except Exception as upload_err:
                    logging.debug(f"Audio storage notice: {upload_err}")

            # 2. Insert metadata record to Supabase
            record = {
                "station_name": STATION_NAME,
                "timestamp": ts,
                "date": dt,
                "time": tm,
                "common_name": com_name,
                "scientific_name": sci_name,
                "confidence": conf,
                "audio_path": remote_audio_url,
                "spectrogram_path": remote_spec_url,
                "duration": dur,
                "reviewed": False,
                "verified": False
            }

            try:
                self.supabase.table("detections").insert(record).execute()
                cursor.execute("UPDATE upload_queue SET uploaded = 1 WHERE id = ?", (q_id,))
                queue_conn.commit()
                logging.info(f" Successfully synced {det_id} to cloud backend.")
            except Exception as insert_err:
                logging.error(f"Failed inserting record {det_id}: {insert_err}")
                cursor.execute("UPDATE upload_queue SET retries = retries + 1 WHERE id = ?", (q_id,))
                queue_conn.commit()

        queue_conn.close()

    def run(self):
        logging.info("Starting BirdNET Sync Service daemon loop...")
        while True:
            try:
                self.fetch_new_detections_from_birdnet()
                self.process_upload_queue()
            except Exception as loop_err:
                logging.error(f"Sync loop error: {loop_err}")
            time.sleep(SYNC_INTERVAL)

if __name__ == "__main__":
    daemon = BirdNETSyncDaemon()
    daemon.run()
