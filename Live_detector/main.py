"""
BirdSong Observatory - Live Detector Master Supervisor
======================================================
The central edge agent daemon running on the Raspberry Pi:
1. Mic Audio Capture (FFmpeg / ALSA 48 kHz).
2. Lock-free Circular Ring Buffer (3s window, 1.5s hop).
3. DSP Acoustic Activity & Triage Watchdog (rain/insect filters, event blobs, SNR).
4. Multi-Model Inference (BirdNET + uploaded custom TFLite / ONNX models).
5. Side-by-side Window Comparison (identical window_id across models).
6. Deduplicated Audio Clip Outbox (Opus compression).
7. Solar Powerbank, Battery, CPU Temp & SD Card Space Monitor.
8. Cloud Synchronizer & Supabase Realtime Hot-Reload Manager.
"""

import os
import sys
import time
import signal
import logging
import threading
from typing import Dict, List, Tuple, Any

from config import (
    STATION_NAME, PROJECT_NAME, CLIPS_DIR,
    TELEMETRY_INTERVAL_SECONDS
)
from ring_buffer import CircularRingBuffer, AudioWindow
from capture import AudioCaptureWorker
from activity import compute_window_activity, evaluate_discrepancy_flags
from telemetry import SystemTelemetryMonitor
from outbox import OutboxDatabase
from uploader import CloudUploaderWorker
from control import ControlManager
from streamer import LiveAudioStreamServer
from adapters import ModelAdapter

# Configure Structured Terminal Logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("LiveDetectorMain")

class LiveDetectorAgent:
    def __init__(self):
        logger.info("=" * 65)
        logger.info(f"🌿 INITIALIZING LIVE DETECTOR AGENT: {STATION_NAME}")
        logger.info(f"📍 Project Scope: {PROJECT_NAME}")
        logger.info("=" * 65)

        self.running = False
        self.models_lock = threading.Lock()
        self.active_models: Dict[str, ModelAdapter] = {}

        # 1. Initialize Subsystems
        self.ring_buffer = CircularRingBuffer(capacity_seconds=30.0)
        self.outbox = OutboxDatabase()
        self.telemetry_monitor = SystemTelemetryMonitor()

        # 2. Workers
        self.capture_worker = AudioCaptureWorker(self.ring_buffer)
        self.uploader_worker = CloudUploaderWorker(self.outbox)
        self.control_manager = ControlManager(self.active_models, self.models_lock)
        self.stream_server = LiveAudioStreamServer(self.capture_worker)

        # 3. Setup OS Signal Handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, sig, frame):
        logger.info("Received termination signal. Shutting down gracefully...")
        self.stop()

    def telemetry_loop(self):
        """Dedicated background thread for solar powerbank, battery, CPU temp, and SD card space."""
        logger.info("Solar & Hardware Telemetry thread started.")
        while self.running:
            try:
                report = self.telemetry_monitor.collect_full_report()
                self.outbox.add_telemetry(STATION_NAME, report)
                
                # Check for critical warnings to log immediately
                if report.get("under_voltage_flag"):
                    logger.warning("⚡ UNDER-VOLTAGE ALERT: Powerbank output dropped below 4.63V (Solar dip).")
                if report.get("is_low_space"):
                    logger.warning(f"💾 LOW DISK ALERT: SD card has only {report.get('disk_free_gb')} GB free!")
                if report.get("cpu_temp_c", 0.0) > 75.0:
                    logger.warning(f"🌡️ HIGH TEMPERATURE ALERT: CPU temp reached {report.get('cpu_temp_c')} °C.")

            except Exception as e:
                logger.error(f"Error reading telemetry: {e}")

            time.sleep(TELEMETRY_INTERVAL_SECONDS)

    def start(self):
        self.running = True

        # Start Workers
        self.capture_worker.start()
        self.uploader_worker.start()
        self.stream_server.start()

        # Start Control Manager in background thread (syncs models via cloud)
        control_thread = threading.Thread(target=self.control_manager.run_sync_loop, daemon=True, name="ControlThread")
        control_thread.start()

        # Start Telemetry Worker in background thread
        telem_thread = threading.Thread(target=self.telemetry_loop, daemon=True, name="TelemetryThread")
        telem_thread.start()

        logger.info("🚀 All systems operational! Beginning real-time audio analysis loop...")

        # Main Real-Time Inference & Watchdog Loop
        while self.running:
            try:
                # 1. Fetch 3.0s window from ring buffer
                window: AudioWindow = self.ring_buffer.get_window(timeout=1.0)
                if not window:
                    continue

                window_id = window.window_id
                audio_48k = window.audio

                # 2. Compute Physical DSP Activity & Event Counting (< 15ms)
                activity = compute_window_activity(audio_48k)

                # 3. Multi-Model Inference Execution
                model_predictions: Dict[str, List[Tuple[str, float]]] = {}
                runtimes_map: Dict[str, str] = {}

                with self.models_lock:
                    models_to_run = list(self.active_models.items())

                for model_id, model in models_to_run:
                    try:
                        preds = model.predict(audio_48k)
                        model_predictions[model_id] = preds
                        runtimes_map[model_id] = model.__class__.__name__
                    except Exception as pred_err:
                        logger.error(f"Inference error on model '{model_id}': {pred_err}")
                        model_predictions[model_id] = []

                # 4. Watchdog Triage Decision Logic
                flags, explained_ratio = evaluate_discrepancy_flags(
                    activity, model_predictions, runtimes_map
                )

                # Collect all formatted detections
                detections_to_enqueue = []
                all_species_names = []

                for model_id, preds in model_predictions.items():
                    for common_name, conf in preds:
                        all_species_names.append(common_name)
                        detections_to_enqueue.append({
                            "model_id": model_id,
                            "common_name": common_name,
                            "scientific_name": common_name, # Can resolve via taxonomy map
                            "confidence": conf
                        })
                        logger.info(f"🎵 [{model_id}] {common_name} ({conf * 100:.1f}%) | Flags: {flags}")

                # 5. Audio Clip Handling: Save temporary Opus clip ONLY if there are detections or flags
                has_detections = len(detections_to_enqueue) > 0
                has_triage_flags = len(flags) > 0 and "AMBIENT_NOISE" not in flags

                clip_local_path = None
                if has_detections or has_triage_flags:
                    clip_filename = f"{window_id}.opus"
                    clip_local_path = str(CLIPS_DIR / clip_filename)
                    encoded = self.uploader_worker.encode_to_opus(audio_48k, clip_local_path)
                    if not encoded:
                        clip_local_path = None

                # 6. Enqueue Window Summary & Detections atomically to SQLite Outbox
                self.outbox.add_window_and_detections(
                    window_id=window_id,
                    node_id=STATION_NAME,
                    timestamp=window.timestamp,
                    activity_dict=activity.to_dict(),
                    species_list=list(set(all_species_names)),
                    model_count=len(models_to_run),
                    explained_ratio=explained_ratio,
                    flags=flags,
                    clip_local_path=clip_local_path,
                    detections=detections_to_enqueue
                )

            except Exception as loop_err:
                logger.error(f"Error in main processing loop: {loop_err}")
                time.sleep(0.1)

    def stop(self):
        self.running = False
        self.ring_buffer.stop()
        self.capture_worker.stop()
        self.uploader_worker.stop()
        self.control_manager.stop()
        self.stream_server.stop()
        logger.info("Live Detector Agent stopped cleanly.")

if __name__ == "__main__":
    agent = LiveDetectorAgent()
    agent.start()
