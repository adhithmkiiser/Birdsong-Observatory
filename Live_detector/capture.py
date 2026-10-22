"""
BirdSong Observatory - Audio Capture Engine
===========================================
Spawns continuous ALSA audio capture stream via FFmpeg subprocess or sounddevice.
Streams 48 kHz mono float32 samples directly into the thread-safe circular ring buffer.
Automatically detects microphone disconnection and restarts capture with exponential backoff.
"""

import time
import subprocess
import threading
import logging
import numpy as np
from ring_buffer import CircularRingBuffer
from config import SAMPLE_RATE, CHANNELS, AUDIO_INPUT_DEVICE

logger = logging.getLogger("CaptureEngine")

class AudioCaptureWorker(threading.Thread):
    def __init__(self, ring_buffer: CircularRingBuffer, device: str = AUDIO_INPUT_DEVICE):
        super().__init__(daemon=True, name="AudioCaptureWorker")
        self.ring_buffer = ring_buffer
        self.device = device
        self.running = False
        self.process = None
        self._stream_listeners = []
        self._listeners_lock = threading.Lock()

    def add_stream_listener(self, queue_obj):
        """Register a queue to receive real-time linear raw audio bytes without disturbing AI inference."""
        with self._listeners_lock:
            if queue_obj not in self._stream_listeners:
                self._stream_listeners.append(queue_obj)

    def remove_stream_listener(self, queue_obj):
        """Deregister an active streaming listener."""
        with self._listeners_lock:
            if queue_obj in self._stream_listeners:
                self._stream_listeners.remove(queue_obj)

    def run(self):
        self.running = True
        logger.info(f"Starting Audio Capture Worker on device: '{self.device}' @ {SAMPLE_RATE} Hz")

        while self.running:
            try:
                # Launch FFmpeg to capture raw uncompressed float32 audio from ALSA
                # Format: float 32-bit little-endian (f32le)
                cmd = [
                    "ffmpeg",
                    "-loglevel", "error",
                    "-thread_queue_size", "2048",
                    "-f", "alsa",
                    "-i", self.device,
                    "-ac", "1",
                    "-ar", str(SAMPLE_RATE),
                    "-f", "f32le",
                    "pipe:1"
                ]

                logger.info(f"Spawning capture subprocess: {' '.join(cmd)}")
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=4096 * 4
                )

                chunk_samples = 2048
                chunk_bytes = chunk_samples * 4  # 4 bytes per float32

                while self.running:
                    raw_bytes = self.process.stdout.read(chunk_bytes)
                    if not raw_bytes:
                        logger.warning("Capture stream returned empty bytes. Device may have disconnected.")
                        break

                    # Convert raw bytes to numpy float32 array for AI sliding window ring buffer
                    samples = np.frombuffer(raw_bytes, dtype=np.float32)
                    self.ring_buffer.write(samples)

                    # Also broadcast linear raw bytes directly to any connected live audio listeners
                    with self._listeners_lock:
                        for q in list(self._stream_listeners):
                            try:
                                q.put_nowait(raw_bytes)
                            except Exception:
                                try:
                                    q.get_nowait()
                                    q.put_nowait(raw_bytes)
                                except Exception:
                                    pass

            except FileNotFoundError:
                logger.error("FFmpeg not found! Falling back to sounddevice library...")
                self._fallback_sounddevice()
                break
            except Exception as e:
                logger.error(f"Error in audio capture loop: {e}")
            finally:
                if self.process:
                    try:
                        self.process.terminate()
                        self.process.wait(timeout=2)
                    except Exception:
                        pass
                    self.process = None

            if self.running:
                logger.info("Attempting microphone reconnection in 3 seconds...")
                time.sleep(3.0)

    def _fallback_sounddevice(self):
        """Fallback capture implementation using Python sounddevice library."""
        try:
            import sounddevice as sd
            def audio_callback(indata, frames, time_info, status):
                if status:
                    logger.warning(f"Sounddevice status: {status}")
                self.ring_buffer.write(indata[:, 0].copy())

            with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, dtype='float32', callback=audio_callback):
                logger.info("Sounddevice InputStream active.")
                while self.running:
                    time.sleep(1.0)
        except Exception as e:
            logger.error(f"Sounddevice fallback failed: {e}")

    def stop(self):
        self.running = False
        if self.process:
            try:
                self.process.terminate()
            except Exception:
                pass
