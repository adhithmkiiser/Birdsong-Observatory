import os
from dotenv import load_dotenv

class Config:
    def __init__(self):
        load_dotenv()
        self.SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
        self.SQLITE_DB = os.getenv("SQLITE_DB", "/home/livedetector/BirdNET-Pi/scripts/birds.db")
        self.AUDIO_ROOT = os.getenv("AUDIO_ROOT", "/home/livedetector/BirdSongs/Extracted/By_Date")
        self.STATION_ID = os.getenv("STATION_ID", "station-001")
        self.STATION_NAME = os.getenv("STATION_NAME", "Raspberry Pi Station 01")
        self.SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "10"))
        self.STATE_FILE = os.getenv("STATE_FILE", "state.json")

    def validate(self):
        if not self.SUPABASE_URL:
            raise ValueError("SUPABASE_URL is missing in environment variables.")
        if not self.SUPABASE_KEY:
            raise ValueError("SUPABASE_KEY is missing in environment variables.")
        if not os.path.exists(self.SQLITE_DB):
            print(f"WARNING: SQLite database not found at {self.SQLITE_DB}. It will be checked continuously.")
