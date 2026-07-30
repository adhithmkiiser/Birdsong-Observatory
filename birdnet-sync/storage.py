import os
import logging
from supabase import create_client, Client

logger = logging.getLogger("birdnet_sync")

class SupabaseStorage:
    def __init__(self, url: str, key: str, bucket_name: str = "bird-audio"):
        self.supabase: Client = create_client(url, key)
        self.bucket_name = bucket_name
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            # Check if bucket exists, create if missing
            buckets = self.supabase.storage.list_buckets()
            existing = [b.name for b in buckets]
            if self.bucket_name not in existing:
                logger.info(f"Creating Supabase storage bucket '{self.bucket_name}'...")
                self.supabase.storage.create_bucket(self.bucket_name, options={"public": True})
        except Exception as e:
            logger.debug(f"Bucket check note: {e}")

    def upload_audio(self, local_path: str, station_id: str, date_str: str, filename: str) -> str:
        try:
            parts = date_str.split("-")
            if len(parts) == 3:
                year, month, day = parts
            else:
                year, month, day = "2026", "01", "01"

            # Structure: station_id/YYYY/MM/DD/filename.mp3
            remote_path = f"{station_id}/{year}/{month}/{day}/{filename}"

            with open(local_path, "rb") as f:
                file_bytes = f.read()

            # Upload file with upsert=True
            res = self.supabase.storage.from_(self.bucket_name).upload(
                path=remote_path,
                file=file_bytes,
                file_options={"content-type": "audio/mpeg", "x-upsert": "true"}
            )

            # Construct public URL
            public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(remote_path)
            return public_url
        except Exception as e:
            logger.error(f"Failed to upload audio file {filename} to Supabase storage: {e}")
            return ""
