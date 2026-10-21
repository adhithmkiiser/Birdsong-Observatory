"""
BirdSong Observatory - Lock-Free Circular Window Buffer
======================================================
Stores continuous streaming audio samples and produces fixed-length 
(3.0s) windows with configurable overlap (e.g. 1.5s hop).
Thread-safe for real-time producer-consumer audio pipelines.
"""

import time
import threading
import numpy as np
from datetime import datetime
from typing import Generator, Tuple, Optional
from config import SAMPLE_RATE, WINDOW_SAMPLES, HOP_SAMPLES, STATION_NAME

class AudioWindow:
    def __init__(self, window_id: str, audio: np.ndarray, timestamp: str, start_time: float):
        self.window_id = window_id
        self.audio = audio          # 1D float32 numpy array, shape (144000,)
        self.timestamp = timestamp  # ISO8601 string
        self.start_time = start_time # Unix timestamp (seconds float)

class CircularRingBuffer:
    def __init__(self, capacity_seconds: float = 30.0):
        self.capacity_samples = int(capacity_seconds * SAMPLE_RATE)
        self.buffer = np.zeros(self.capacity_samples, dtype=np.float32)
        self.write_idx = 0
        self.read_idx = 0
        self.samples_available = 0
        self.lock = threading.Lock()
        self.data_ready = threading.Condition(self.lock)
        self.stopped = False

    def write(self, samples: np.ndarray):
        """Appends new incoming float32 audio samples to the circular buffer."""
        if len(samples) == 0:
            return

        with self.data_ready:
            num_samples = len(samples)
            if num_samples > self.capacity_samples:
                samples = samples[-self.capacity_samples:]
                num_samples = len(samples)

            first_chunk = min(num_samples, self.capacity_samples - self.write_idx)
            second_chunk = num_samples - first_chunk

            self.buffer[self.write_idx : self.write_idx + first_chunk] = samples[:first_chunk]
            if second_chunk > 0:
                self.buffer[0:second_chunk] = samples[first_chunk:]

            self.write_idx = (self.write_idx + num_samples) % self.capacity_samples
            self.samples_available = min(self.capacity_samples, self.samples_available + num_samples)
            self.data_ready.notify_all()

    def get_window(self, timeout: float = 1.0) -> Optional[AudioWindow]:
        """
        Retrieves the next overlapping window of length WINDOW_SAMPLES (3.0s).
        Advances the read pointer by HOP_SAMPLES (1.5s).
        Returns None if buffer has insufficient samples within timeout.
        """
        with self.data_ready:
            while self.samples_available < WINDOW_SAMPLES:
                if self.stopped:
                    return None
                if not self.data_ready.wait(timeout=timeout):
                    return None

            now = time.time()
            dt_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            ms = int((now % 1) * 1000)
            window_id = f"{STATION_NAME}_{dt_str}_{ms:03d}"
            iso_timestamp = datetime.utcnow().isoformat() + "Z"

            # Extract window of WINDOW_SAMPLES
            window_data = np.empty(WINDOW_SAMPLES, dtype=np.float32)
            first_chunk = min(WINDOW_SAMPLES, self.capacity_samples - self.read_idx)
            second_chunk = WINDOW_SAMPLES - first_chunk

            window_data[:first_chunk] = self.buffer[self.read_idx : self.read_idx + first_chunk]
            if second_chunk > 0:
                window_data[first_chunk:] = self.buffer[0:second_chunk]

            # Advance read index by hop length (for sliding window overlap)
            self.read_idx = (self.read_idx + HOP_SAMPLES) % self.capacity_samples
            self.samples_available -= HOP_SAMPLES

            return AudioWindow(
                window_id=window_id,
                audio=window_data,
                timestamp=iso_timestamp,
                start_time=now
            )

    def stop(self):
        with self.data_ready:
            self.stopped = True
            self.data_ready.notify_all()
