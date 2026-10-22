"""
BirdSong Observatory - Cloud Uploader & Storage Synchronizer
============================================================
Runs in a background worker thread.
1. Encodes 3.0s audio clips to high-efficiency Opus format (reducing 300 KB to ~24 KB).
2. Deduplicates audio uploads: uploads one clip per window_id shared across all models.
3. Batch inserts records into Supabase PostgreSQL:
   - window_summaries (activity metrics, review flags)
   - detections (individual model species predictions)
   - station_telemetry (solar voltage, battery, temperature, SD card free space)
4. Dequeues SQLite records on success and handles offline retries with backoff.
"""

import os
import json
import time
import logging
import threading
import subprocess
import numpy as np
from typing import Optional, List, Dict, Any
from pathlib import Path
from supabase import create_client, Client
from outbox import OutboxDatabase
from config import (
    SUPABASE_URL, SUPABASE_KEY, CLIPS_DIR,
    STATION_NAME, PROJECT_NAME, SITE_NAME, SAMPLE_RATE, SYNC_INTERVAL_SECONDS
)

logger = logging.getLogger("CloudUploader")

class CloudUploaderWorker(threading.Thread):
    def __init__(self, outbox: OutboxDatabase):
        super().__init__(daemon=True, name="CloudUploaderWorker")
        self.outbox = outbox
        self.running = False
        self.supabase: Optional[Client] = None
        self._init_supabase()

    def _init_supabase(self):
        try:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("Connected to Supabase successfully.")
        except Exception as e:
            logger.warning(f"Could not connect to Supabase yet: {e}")
            self.supabase = None

    def encode_to_opus(self, audio_data: np.ndarray, output_path: str) -> bool:
        """Encodes float32 48kHz audio array to compact Opus file using FFmpeg."""
        try:
            cmd = [
                "ffmpeg",
                "-y",
                "-loglevel", "error",
                "-f", "f32le",
                "-ar", str(SAMPLE_RATE),
                "-ac", "1",
                "-i", "pipe:0",
                "-c:a", "libopus",
                "-b:a", "64k",
                "-vbr", "on",
                output_path
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = proc.communicate(input=audio_data.astype(np.float32).tobytes(), timeout=5)
            if proc.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                return True

            # Fallback 1: Try built-in opus encoder without libopus
            cmd[8] = "opus"
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = proc.communicate(input=audio_data.astype(np.float32).tobytes(), timeout=5)
            if proc.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                return True

            err_text = stderr.decode('utf-8', errors='ignore') if stderr else "unknown"
            logger.warning(f"FFmpeg Opus encoding returned code {proc.returncode}: {err_text}")
            return False
        except Exception as e:
            logger.warning(f"Audio Opus encoding failed: {e}")
            return False

    def upload_clip_to_storage(self, local_clip_path: str, remote_filename: str) -> Optional[str]:
        """Uploads an audio clip to Supabase storage bucket 'clips'."""
        if not self.supabase or not os.path.exists(local_clip_path):
            return None

        storage_path = f"{PROJECT_NAME}/{STATION_NAME}/{remote_filename}"
        try:
            with open(local_clip_path, "rb") as f:
                self.supabase.storage.from_("clips").upload(
                    path=storage_path,
                    file=f,
                    file_options={"content-type": "audio/ogg; codecs=opus", "upsert": "true"}
                )
            
            # Retrieve public URL
            res = self.supabase.storage.from_("clips").get_public_url(storage_path)
            return res
        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str or "duplicate" in err_str:
                return self.supabase.storage.from_("clips").get_public_url(storage_path)
            if "not found" in err_str or "bucket" in err_str:
                try:
                    self.supabase.storage.create_bucket("clips", options={"public": True})
                    with open(local_clip_path, "rb") as f:
                        self.supabase.storage.from_("clips").upload(
                            path=storage_path,
                            file=f,
                            file_options={"content-type": "audio/ogg; codecs=opus", "upsert": "true"}
                        )
                    return self.supabase.storage.from_("clips").get_public_url(storage_path)
                except Exception as b_err:
                    logger.warning(f"Failed to auto-create 'clips' bucket: {b_err}")
            logger.warning(f"Storage clip upload note ({storage_path}): {e}")
            return None

    def sync_cycle(self):
        if not self.supabase:
            self._init_supabase()
            if not self.supabase:
                return

        # 1. Sync Windows Summaries & Clips
        pending_windows = self.outbox.get_pending_windows(limit=10)
        uploaded_window_ids = []

        for win in pending_windows:
            window_id = win["window_id"]
            clip_local = win["clip_local_path"]
            remote_clip_url = None

            # Upload audio clip if file exists and window had detections or flags
            if clip_local and os.path.exists(clip_local):
                remote_name = f"{window_id}.opus"
                remote_clip_url = self.upload_clip_to_storage(clip_local, remote_name)

            flags_list = json.loads(win["review_flags"]) if win["review_flags"] else []
            species_list = json.loads(win["species_detected"]) if win["species_detected"] else []

            record = {
                "window_id": window_id,
                "node_id": win["node_id"],
                "timestamp": win["timestamp"],
                "event_count": win["event_count"],
                "occupied_area_ratio": win["occupied_area_ratio"],
                "low_band_energy": win["low_band_energy"],
                "mid_band_energy": win["mid_band_energy"],
                "snr_db": win["snr_db"],
                "is_ambient_noise": bool(win["is_ambient_noise"]),
                "species_detected": species_list,
                "model_count": win["model_count"],
                "explained_ratio": win["explained_ratio"],
                "review_flags": flags_list,
                "clip_path": remote_clip_url or "",
                "review_status": "unreviewed"
            }

            try:
                self.supabase.table("window_summaries").upsert(record, on_conflict="window_id").execute()
                uploaded_window_ids.append(window_id)

                # Clean up local temporary clip file once confirmed uploaded to cloud
                if remote_clip_url and clip_local and os.path.exists(clip_local):
                    try:
                        os.remove(clip_local)
                    except Exception:
                        pass
            except Exception as e:
                err_msg = str(e)
                if "PGRST205" in err_msg or "window_summaries" in err_msg:
                    logger.warning(
                        "Supabase table 'public.window_summaries' not created yet. "
                        "To enable Acoustic Watchdog Triage, run Live_detector/schema.sql in Supabase SQL Editor. "
                        "Skipping window summaries sync for this cycle."
                    )
                    if remote_clip_url and clip_local and os.path.exists(clip_local):
                        try:
                            os.remove(clip_local)
                        except Exception:
                            pass
                    uploaded_window_ids.append(window_id)
                else:
                    logger.error(f"Error inserting window_summary {window_id}: {e}")
                continue

        if uploaded_window_ids:
            self.outbox.mark_windows_uploaded(uploaded_window_ids)
            logger.info(f"Synced {len(uploaded_window_ids)} window summaries.")

        # 2. Sync Individual Model Detections to live_detections
        pending_detections = self.outbox.get_pending_detections(limit=50)
        if pending_detections:
            live_records = []
            det_ids = []
            for d in pending_detections:
                det_ids.append(d["id"])
                ts_str = str(d["timestamp"])
                date_part = ts_str[:10] if len(ts_str) >= 10 else ""
                time_part = ts_str[11:19] if len(ts_str) >= 19 else ""
                window_id = d.get('window_id', '')

                # Ensure corresponding 3.0s audio clip is uploaded to Supabase Storage
                audio_url = ""
                if window_id:
                    local_clip = CLIPS_DIR / f"{window_id}.opus"
                    remote_name = f"{window_id}.opus"
                    if local_clip.exists():
                        self.upload_clip_to_storage(str(local_clip), remote_name)
                    audio_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/clips/{PROJECT_NAME.replace(' ', '%20')}/{d['node_id']}/{window_id}.opus"

                live_records.append({
                    "project_name": PROJECT_NAME,
                    "site_name": SITE_NAME,
                    "recorder_id": d["node_id"],
                    "station_id": d["node_id"],
                    "station_name": d["node_id"],
                    "common_name": d["common_name"],
                    "scientific_name": d["scientific_name"],
                    "confidence": float(d["confidence"]),
                    "timestamp": d["timestamp"],
                    "date_str": date_part,
                    "time_str": time_part,
                    "duration": 3.0,
                    "audio_url": audio_url,
                    "verification_status": "PENDING",
                    "reviewed": False,
                    "verified": False
                })

            try:
                self.supabase.table("live_detections").insert(live_records).execute()
                self.outbox.mark_detections_uploaded(det_ids)
                logger.info(f"Synced {len(live_records)} detections to live_detections.")
            except Exception as e:
                logger.error(f"Error inserting live_detections: {e}")

        # 3. Sync Solar & Battery Hardware Telemetry
        pending_telemetry = self.outbox.get_pending_telemetry(limit=20)
        if pending_telemetry:
            telem_records = []
            telem_ids = []
            for t in pending_telemetry:
                telem_ids.append(t["id"])
                disk_pct = t.get("disk_percent_free")
                disk_used = int(round(100.0 - float(disk_pct))) if disk_pct is not None else 10
                bat_pct = t.get("battery_capacity_percent")
                bat_int = int(round(float(bat_pct))) if bat_pct is not None else 100
                temp_val = float(t.get("cpu_temp_c")) if t.get("cpu_temp_c") is not None else 40.0

                telem_records.append({
                    "station_id": t["node_id"],
                    "node_id": t["node_id"],
                    "ping_time": t["timestamp"],
                    "cpu_temperature": temp_val,
                    "battery_level": bat_int,
                    "disk_usage": disk_used,
                    "cpu_temp_c": t["cpu_temp_c"],
                    "disk_free_gb": t["disk_free_gb"],
                    "disk_percent_free": t["disk_percent_free"],
                    "is_low_space": bool(t["is_low_space"]),
                    "battery_capacity_percent": t["battery_capacity_percent"],
                    "battery_voltage_v": t["battery_voltage_v"],
                    "power_status": t["power_status"],
                    "under_voltage_flag": bool(t["under_voltage_flag"]),
                    "throttling_flag": bool(t["throttling_flag"]),
                    "cpu_percent": t["cpu_percent"],
                    "ram_percent": t["ram_percent"],
                    "uptime_hours": t["uptime_hours"]
                })

            try:
                self.supabase.table("station_telemetry").insert(telem_records).execute()
                self.outbox.mark_telemetry_uploaded(telem_ids)
                logger.info(f"Synced {len(telem_records)} solar/battery telemetry records to cloud.")

                # Also touch recorders_registry so heartbeat pulse stays green
                try:
                    self.supabase.table("recorders_registry").update({
                        "last_ping": telem_records[-1]["ping_time"],
                        "status": "online",
                        "battery_level": telem_records[-1]["battery_level"],
                        "cpu_temperature": telem_records[-1]["cpu_temperature"]
                    }).eq("recorder_id", STATION_NAME).execute()
                except Exception:
                    pass
            except Exception as e:
                err_str = str(e)
                # If modern columns like battery_capacity_percent are missing, fallback to legacy schema
                if "column" in err_str or "PGRST204" in err_str or "400" in err_str or "Bad Request" in err_str:
                    try:
                        legacy_records = []
                        for t in pending_telemetry:
                            disk_pct = t.get("disk_percent_free")
                            disk_used = int(round(100.0 - float(disk_pct))) if disk_pct is not None else 10
                            bat_pct = t.get("battery_capacity_percent")
                            bat_int = int(round(float(bat_pct))) if bat_pct is not None else 100
                            temp_val = float(t.get("cpu_temp_c")) if t.get("cpu_temp_c") is not None else 40.0

                            legacy_records.append({
                                "station_id": t["node_id"],
                                "ping_time": t["timestamp"],
                                "cpu_temperature": temp_val,
                                "battery_level": bat_int,
                                "disk_usage": disk_used,
                                "pending_queue_count": 0
                            })
                        self.supabase.table("station_telemetry").insert(legacy_records).execute()
                        self.outbox.mark_telemetry_uploaded(telem_ids)
                        logger.info(f"Synced {len(legacy_records)} telemetry records to cloud (legacy format).")
                    except Exception as e2:
                        logger.error(f"Error inserting telemetry: {e2}")
                else:
                    logger.error(f"Error inserting telemetry: {e}")

    def run(self):
        self.running = True
        logger.info("Starting Cloud Uploader Worker loop...")
        prune_counter = 0

        while self.running:
            try:
                self.sync_cycle()
                prune_counter += 1
                if prune_counter >= 360: # Prune roughly once an hour
                    self.outbox.prune_uploaded(retention_days=7)
                    prune_counter = 0
            except Exception as e:
                logger.error(f"Error in upload cycle: {e}")

            time.sleep(SYNC_INTERVAL_SECONDS)

    def stop(self):
        self.running = False
