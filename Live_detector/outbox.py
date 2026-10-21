"""
BirdSong Observatory - Local SQLite Outbox
==========================================
Provides rock-solid offline reliability when cellular/WiFi drops.
Inferences, activity metrics, and telemetry records are enqueued locally,
then uploaded to Supabase Storage and PostgreSQL in batches once online.
"""

import sqlite3
import threading
from typing import List, Dict, Any, Optional
from pathlib import Path
from config import QUEUE_DB_PATH

class OutboxDatabase:
    def __init__(self, db_path: Path = QUEUE_DB_PATH):
        self.db_path = str(db_path)
        self.lock = threading.Lock()
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        return conn

    def _init_db(self):
        with self.lock:
            conn = self._get_connection()
            cursor = conn.cursor()

            # 1. Windows Table (summaries, activity metrics, flags)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS outbox_windows (
                    window_id TEXT PRIMARY KEY,
                    node_id TEXT,
                    timestamp TEXT,
                    event_count INTEGER,
                    occupied_area_ratio REAL,
                    low_band_energy REAL,
                    mid_band_energy REAL,
                    snr_db REAL,
                    is_ambient_noise INTEGER,
                    species_detected TEXT, -- JSON array string
                    model_count INTEGER,
                    explained_ratio REAL,
                    review_flags TEXT,     -- JSON array string
                    clip_local_path TEXT,
                    uploaded INTEGER DEFAULT 0,
                    retries INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 2. Detections Table (per-model individual classifications)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS outbox_detections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    window_id TEXT,
                    model_id TEXT,
                    node_id TEXT,
                    timestamp TEXT,
                    common_name TEXT,
                    scientific_name TEXT,
                    confidence REAL,
                    uploaded INTEGER DEFAULT 0,
                    retries INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 3. Telemetry Table (solar, battery, temperature, SD card space)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS outbox_telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    node_id TEXT,
                    timestamp TEXT,
                    cpu_temp_c REAL,
                    disk_free_gb REAL,
                    disk_percent_free REAL,
                    is_low_space INTEGER,
                    battery_capacity_percent REAL,
                    battery_voltage_v REAL,
                    power_status TEXT,
                    under_voltage_flag INTEGER,
                    throttling_flag INTEGER,
                    cpu_percent REAL,
                    ram_percent REAL,
                    uptime_hours REAL,
                    uploaded INTEGER DEFAULT 0
                )
            """)

            conn.commit()
            conn.close()

    def add_window_and_detections(
        self,
        window_id: str,
        node_id: str,
        timestamp: str,
        activity_dict: Dict[str, Any],
        species_list: List[str],
        model_count: int,
        explained_ratio: float,
        flags: List[str],
        clip_local_path: Optional[str],
        detections: List[Dict[str, Any]]
    ):
        """Atomically saves the window activity and all associated model detections."""
        import json
        with self.lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()

                # Insert Window
                cursor.execute("""
                    INSERT OR REPLACE INTO outbox_windows (
                        window_id, node_id, timestamp, event_count, occupied_area_ratio,
                        low_band_energy, mid_band_energy, snr_db, is_ambient_noise,
                        species_detected, model_count, explained_ratio, review_flags,
                        clip_local_path, uploaded
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (
                    window_id,
                    node_id,
                    timestamp,
                    activity_dict.get("event_count", 0),
                    activity_dict.get("occupied_area_ratio", 0.0),
                    activity_dict.get("low_band_energy", 0.0),
                    activity_dict.get("mid_band_energy", 0.0),
                    activity_dict.get("snr_db", 0.0),
                    1 if activity_dict.get("is_ambient_noise") else 0,
                    json.dumps(species_list),
                    model_count,
                    explained_ratio,
                    json.dumps(flags),
                    clip_local_path or ""
                ))

                # Insert Detections
                for det in detections:
                    cursor.execute("""
                        INSERT INTO outbox_detections (
                            window_id, model_id, node_id, timestamp,
                            common_name, scientific_name, confidence, uploaded
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                    """, (
                        window_id,
                        det.get("model_id", "default"),
                        node_id,
                        timestamp,
                        det.get("common_name", ""),
                        det.get("scientific_name", ""),
                        float(det.get("confidence", 0.0))
                    ))

                conn.commit()
            finally:
                conn.close()

    def add_telemetry(self, node_id: str, report: Dict[str, Any]):
        """Queues a hardware/solar telemetry snapshot."""
        with self.lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO outbox_telemetry (
                        node_id, timestamp, cpu_temp_c, disk_free_gb, disk_percent_free,
                        is_low_space, battery_capacity_percent, battery_voltage_v,
                        power_status, under_voltage_flag, throttling_flag,
                        cpu_percent, ram_percent, uptime_hours, uploaded
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (
                    node_id,
                    report.get("timestamp"),
                    report.get("cpu_temp_c"),
                    report.get("disk_free_gb"),
                    report.get("disk_percent_free"),
                    1 if report.get("is_low_space") else 0,
                    report.get("battery_capacity_percent"),
                    report.get("battery_voltage_v"),
                    report.get("power_status"),
                    1 if report.get("under_voltage_flag") else 0,
                    1 if report.get("throttling_flag") else 0,
                    report.get("cpu_percent"),
                    report.get("ram_percent"),
                    report.get("uptime_hours")
                ))
                conn.commit()
            finally:
                conn.close()

    def get_pending_windows(self, limit: int = 10) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM outbox_windows WHERE uploaded = 0 ORDER BY created_at ASC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_pending_detections(self, limit: int = 50) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM outbox_detections WHERE uploaded = 0 ORDER BY id ASC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_pending_telemetry(self, limit: int = 20) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM outbox_telemetry WHERE uploaded = 0 ORDER BY id ASC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def mark_windows_uploaded(self, window_ids: List[str]):
        if not window_ids:
            return
        with self.lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                placeholders = ",".join("?" for _ in window_ids)
                cursor.execute(f"UPDATE outbox_windows SET uploaded = 1 WHERE window_id IN ({placeholders})", window_ids)
                conn.commit()
            finally:
                conn.close()

    def mark_detections_uploaded(self, detection_ids: List[int]):
        if not detection_ids:
            return
        with self.lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                placeholders = ",".join("?" for _ in detection_ids)
                cursor.execute(f"UPDATE outbox_detections SET uploaded = 1 WHERE id IN ({placeholders})", detection_ids)
                conn.commit()
            finally:
                conn.close()

    def mark_telemetry_uploaded(self, ids: List[int]):
        if not ids:
            return
        with self.lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                placeholders = ",".join("?" for _ in ids)
                cursor.execute(f"UPDATE outbox_telemetry SET uploaded = 1 WHERE id IN ({placeholders})", ids)
                conn.commit()
            finally:
                conn.close()

    def prune_uploaded(self, retention_days: int = 7):
        """Cleans up old uploaded records to conserve SD card space."""
        with self.lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute(f"DELETE FROM outbox_windows WHERE uploaded = 1 AND created_at < datetime('now', '-{retention_days} days')")
                cursor.execute(f"DELETE FROM outbox_detections WHERE uploaded = 1 AND created_at < datetime('now', '-{retention_days} days')")
                cursor.execute(f"DELETE FROM outbox_telemetry WHERE uploaded = 1 AND timestamp < datetime('now', '-{retention_days} days')")
                conn.commit()
            finally:
                conn.close()
