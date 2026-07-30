import json
import os
import logging

logger = logging.getLogger("birdnet_sync")

class StateManager:
    def __init__(self, filepath: str = "state.json"):
        self.filepath = filepath

    def get_last_rowid(self) -> int:
        if not os.path.exists(self.filepath):
            return 0
        try:
            with open(self.filepath, "r") as f:
                data = json.load(f)
                return data.get("last_rowid", 0)
        except Exception as e:
            logger.error(f"Error reading state file {self.filepath}: {e}")
            return 0

    def update_last_rowid(self, rowid: int):
        try:
            with open(self.filepath, "w") as f:
                json.dump({"last_rowid": rowid}, f)
        except Exception as e:
            logger.error(f"Error writing state file {self.filepath}: {e}")
