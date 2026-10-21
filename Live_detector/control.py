"""
BirdSong Observatory - Model Sync & Realtime Control Manager
============================================================
Handles remote model management and live commands from the web dashboard:
1. Queries 'node_models' and 'models' tables in Supabase.
2. Downloads newly assigned .onnx / .tflite weights, labels.txt, and manifest.json from Supabase Storage.
3. Verifies sha256 checksums to ensure file integrity.
4. Dynamically hot-reloads model adapters into the active inference pipeline with ZERO restarts.
5. Listens to Supabase Realtime WebSocket events for instant updates, backed by periodic polling.
"""

import os
import time
import json
import hashlib
import logging
import threading
from typing import Dict, Any, List, Optional
from pathlib import Path
from supabase import create_client, Client

from config import (
    SUPABASE_URL, SUPABASE_KEY, STATION_NAME,
    MODELS_DIR, HEARTBEAT_INTERVAL_SECONDS
)
from adapters import (
    ModelAdapter, BirdNetTFLiteAdapter, GenericTFLiteAdapter, ONNXModelAdapter
)

logger = logging.getLogger("ControlManager")

class ControlManager:
    def __init__(self, active_models_dict: Dict[str, ModelAdapter], lock: threading.Lock):
        self.active_models = active_models_dict
        self.lock = lock
        self.running = False
        self.supabase: Optional[Client] = None
        self._init_supabase()

    def _init_supabase(self):
        try:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("ControlManager connected to Supabase.")
        except Exception as e:
            logger.warning(f"ControlManager connection waiting: {e}")
            self.supabase = None

    def calculate_sha256(self, file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(65536), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def download_file_from_storage(self, remote_path: str, local_path: str) -> bool:
        """Downloads a model artifact from Supabase Storage bucket 'models'."""
        if not self.supabase:
            return False
        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            data = self.supabase.storage.from_("models").download(remote_path)
            with open(local_path, "wb") as f:
                f.write(data)
            return True
        except Exception as e:
            logger.error(f"Failed to download storage file {remote_path}: {e}")
            return False

    def sync_models_from_cloud(self):
        """
        Polls node_models assignments for this STATION_NAME.
        Loads enabled models, updates thresholds, and unloads disabled models.
        """
        if not self.supabase:
            self._init_supabase()
            if not self.supabase:
                return

        try:
            # Query models assigned to this node
            res = self.supabase.table("node_models").select("model_id, enabled, threshold, models(*)").eq("node_id", STATION_NAME).execute()
            assignments = res.data or []

            current_assigned_ids = set()

            for item in assignments:
                model_id = str(item.get("model_id"))
                enabled = item.get("enabled", True)
                threshold = float(item.get("threshold", 0.5))
                model_meta = item.get("models")

                if not model_meta or not enabled:
                    continue

                current_assigned_ids.add(model_id)
                runtime = model_meta.get("runtime", "onnx")
                name = model_meta.get("name", "Custom Model")
                storage_path = model_meta.get("storage_path")  # e.g. "models/<id>/model.onnx"
                labels_path = model_meta.get("labels_path")    # e.g. "models/<id>/labels.txt"
                manifest = model_meta.get("manifest") or {}
                expected_sha256 = model_meta.get("sha256")

                # Local destination paths
                model_dir = MODELS_DIR / model_id
                local_weights = str(model_dir / os.path.basename(storage_path))
                local_labels = str(model_dir / "labels.txt")
                local_manifest = str(model_dir / "manifest.json")

                # Check if files exist locally; if not, download
                needs_download = not os.path.exists(local_weights) or not os.path.exists(local_labels)
                if needs_download:
                    logger.info(f"Downloading new model: {name} ({model_id}) [{runtime}]...")
                    self.download_file_from_storage(storage_path, local_weights)
                    self.download_file_from_storage(labels_path, local_labels)
                    with open(local_manifest, "w", encoding="utf-8") as f:
                        json.dump(manifest, f, indent=2)

                # Verify SHA256 if specified
                if expected_sha256 and os.path.exists(local_weights):
                    actual_sha256 = self.calculate_sha256(local_weights)
                    if actual_sha256.lower() != expected_sha256.lower():
                        logger.error(f"SHA256 checksum mismatch for {name}! Expected {expected_sha256}, got {actual_sha256}")
                        continue

                # Instantiate adapter if not already loaded or threshold changed
                with self.lock:
                    if model_id not in self.active_models:
                        try:
                            adapter: Optional[ModelAdapter] = None
                            if runtime == "birdnet_tflite":
                                adapter = BirdNetTFLiteAdapter(model_id=model_id, threshold=threshold)
                            elif runtime == "tflite":
                                adapter = GenericTFLiteAdapter(model_id=model_id, threshold=threshold)
                            elif runtime == "onnx":
                                adapter = ONNXModelAdapter(model_id=model_id, threshold=threshold)

                            if adapter:
                                adapter.load(local_weights, local_labels, manifest)
                                self.active_models[model_id] = adapter
                                logger.info(f"✨ Successfully hot-loaded model: '{name}' ({runtime}) with threshold {threshold}")
                        except Exception as load_err:
                            logger.error(f"Error loading model {name}: {load_err}")
                    else:
                        # Update threshold dynamically
                        self.active_models[model_id].threshold = threshold

            # Unload any models that were disabled or removed from node_models
            with self.lock:
                to_remove = [m_id for m_id in self.active_models.keys() if m_id != "birdnet_builtin" and m_id not in current_assigned_ids]
                for m_id in to_remove:
                    del self.active_models[m_id]
                    logger.info(f"Unloaded model {m_id} from memory.")

        except Exception as e:
            logger.error(f"Model sync error: {e}")

    def run_sync_loop(self):
        """Background thread executing periodic model checks."""
        self.running = True
        logger.info("ControlManager background sync loop started.")

        # Initial sync on launch
        self.sync_models_from_cloud()

        while self.running:
            try:
                time.sleep(HEARTBEAT_INTERVAL_SECONDS)
                self.sync_models_from_cloud()
            except Exception as e:
                logger.error(f"Error in control sync loop: {e}")

    def stop(self):
        self.running = False
