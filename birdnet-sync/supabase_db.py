import logging
from supabase import create_client, Client

logger = logging.getLogger("birdnet_sync")

class SupabaseDB:
    def __init__(self, url: str, key: str, table_name: str = "live_detections"):
        self.supabase: Client = create_client(url, key)
        self.table_name = table_name

    def insert_detection(self, payload: dict) -> bool:
        try:
            res = self.supabase.table(self.table_name).insert(payload).execute()
            if res.data:
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to insert detection payload into Supabase: {e}")
            return False
