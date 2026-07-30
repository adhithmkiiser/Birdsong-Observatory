import sqlite3
import os
import logging

logger = logging.getLogger("birdnet_sync")

class SQLiteReader:
    def __init__(self, db_path: str, audio_root: str):
        self.db_path = db_path
        self.audio_root = audio_root

    def get_connection(self):
        # Open in immutable/read-only mode so we NEVER lock or alter BirdNET-Pi's DB
        uri = f"file:{self.db_path}?mode=ro"
        return sqlite3.connect(uri, uri=True)

    def get_detections_after(self, last_rowid: int):
        if not os.path.exists(self.db_path):
            logger.warning(f"SQLite DB file {self.db_path} does not exist yet.")
            return []

        try:
            conn = self.get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = """
                SELECT rowid, Date, Time, Sci_Name, Com_Name, Confidence, Lat, Lon, File_Name
                FROM detections
                WHERE rowid > ?
                ORDER BY rowid ASC
                LIMIT 100
            """
            cursor.execute(query, (last_rowid,))
            rows = cursor.fetchall()
            conn.close()

            detections = []
            for r in rows:
                detections.append({
                    "rowid": r["rowid"],
                    "date": r["Date"],
                    "time": r["Time"],
                    "sci_name": r["Sci_Name"],
                    "com_name": r["Com_Name"],
                    "confidence": r["Confidence"],
                    "lat": r["Lat"],
                    "lon": r["Lon"],
                    "file_name": r["File_Name"]
                })
            return detections
        except Exception as e:
            logger.error(f"Error querying SQLite database: {e}")
            return []

    def locate_mp3(self, file_name: str, date_str: str, com_name: str) -> str:
        # Standard BirdNET-Pi folder layout: /home/livedetector/BirdSongs/Extracted/By_Date/YYYY-MM-DD/Species_Name/filename.mp3
        species_folder = com_name.replace(" ", "_")
        expected_path = os.path.join(self.audio_root, date_str, species_folder, file_name)
        if os.path.exists(expected_path):
            return expected_path

        # Fallback search by date directory
        date_dir = os.path.join(self.audio_root, date_str)
        if os.path.exists(date_dir):
            for root, _, files in os.walk(date_dir):
                if file_name in files:
                    return os.path.join(root, file_name)

        return ""
