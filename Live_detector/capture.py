"""
BirdSong Observatory - Audio Capture Engine
===========================================
Spawns continuous ALSA audio capture stream via FFmpeg subprocess or sounddevice.
Streams 48 kHz mono float32 samples directly into the thread-safe circular ring buffer.
Automatically detects USB microphones, un-mutes hardware ALSA capture mixer,
and handles reconnection with exponential backoff.
"""

import os
import re
import time
import subprocess
import threading
import logging
import numpy as np
from ring_buffer import CircularRingBuffer
from config import SAMPLE_RATE, CHANNELS, AUDIO_INPUT_DEVICE, MIC_CAPTURE_GAIN

logger = logging.getLogger("CaptureEngine")

def unmute_alsa_card(card_id: str | int):
    """Attempt to un-mute and set optimal gain (65% default to prevent clipping) on ALSA capture mixer controls."""
    gain = MIC_CAPTURE_GAIN
    commands = [
        ["amixer", "-c", str(card_id), "sset", "Capture", "cap"],
        ["amixer", "-c", str(card_id), "sset", "Capture", gain],
        ["amixer", "-c", str(card_id), "sset", "Mic", "cap"],
        ["amixer", "-c", str(card_id), "sset", "Mic", gain],
        ["amixer", "-c", str(card_id), "sset", "Internal Mic", "cap"],
        ["amixer", "-c", str(card_id), "sset", "Internal Mic", gain],
        ["amixer", "sset", "Capture", "cap"],
        ["amixer", "sset", "Capture", gain],
    ]
    for cmd in commands:
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        except Exception:
            pass

def auto_detect_audio_input(preferred: str = AUDIO_INPUT_DEVICE) -> tuple[str, str]:
    """
    Scans for ALSA audio capture devices.
    Returns (alsa_device_string, friendly_description).
    """
    # 1. Query arecord -l to list all capture hardware
    usb_candidates = []
    other_candidates = []
    available_cards = set()

    try:
        proc = subprocess.run(["arecord", "-l"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if proc.returncode == 0:
            for line in proc.stdout.splitlines():
                # Format: card 2: Device [USB Audio Device], device 0: USB Audio [USB Audio]
                m = re.search(r"card\s*(\d+):\s*([^,\[]+)(?:\[([^\]]+)\])?,\s*device\s*(\d+):", line)
                if m:
                    card_idx = m.group(1)
                    available_cards.add(card_idx)
                    card_name = (m.group(3) or m.group(2)).strip()
                    dev_idx = m.group(4)
                    
                    # Ignore HDMI outputs or non-input controllers
                    if any(x in card_name.lower() for x in ["hdmi", "bcm2835", "dummy", "loopback"]):
                        continue

                    cand = (f"plughw:{card_idx},{dev_idx}", f"Card {card_idx} ({card_name})", card_idx)
                    if any(x in card_name.lower() for x in ["usb", "mic", "audio", "headset", "samson", "rode", "blue", "ab13x"]):
                        usb_candidates.append(cand)
                    else:
                        other_candidates.append(cand)
    except Exception as e:
        logger.debug(f"arecord -l query notice: {e}")

    # 2. Check if user preferred device actually exists
    if preferred and preferred.lower() not in ("auto", "default", ""):
        if "CARD=" in preferred:
            return preferred, f"Configured named ALSA device: {preferred}"
        m = re.search(r"card\s*(\d+)|hw:(\d+)|plughw:(\d+)", preferred)
        card_num = m.group(1) or m.group(2) or m.group(3) if m else None
        if card_num and card_num in available_cards:
            unmute_alsa_card(card_num)
            return preferred, f"Configured device: {preferred}"
        elif not card_num:
            return preferred, f"Configured device: {preferred}"
        else:
            logger.warning(f"⚠️ Preferred device '{preferred}' (Card {card_num}) not found in ALSA capture devices. Auto-detecting fallback...")

    # 3. Check /proc/asound/cards as fallback
    if not usb_candidates and not other_candidates and os.path.exists("/proc/asound/cards"):
        try:
            with open("/proc/asound/cards", "r") as f:
                content = f.read()
            for m in re.finditer(r"^\s*(\d+)\s*\[([^\]]+)\]:\s*(.+)$", content, re.MULTILINE):
                card_idx = m.group(1)
                desc = m.group(3)
                if any(x in desc.lower() for x in ["hdmi", "bcm2835", "dummy", "loopback"]):
                    continue
                cand = (f"plughw:{card_idx},0", f"Card {card_idx} ({desc.strip()})", card_idx)
                if any(x in desc.lower() for x in ["usb", "audio", "mic"]):
                    usb_candidates.append(cand)
                else:
                    other_candidates.append(cand)
        except Exception as e:
            logger.debug(f"/proc/asound/cards parsing notice: {e}")

    # Pick the best device (USB microphone preferred)
    chosen = None
    if usb_candidates:
        chosen = usb_candidates[0]
    elif other_candidates:
        chosen = other_candidates[0]

    if chosen:
        dev_str, dev_desc, card_num = chosen
        unmute_alsa_card(card_num)
        return dev_str, f"Auto-detected {dev_desc}"

    return "plughw:0,0", "Fallback default device"
    unmute_alsa_card(0)
    unmute_alsa_card(1)
    return "default", "Default ALSA capture device"

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

        # Resolve active audio device and unmute hardware mixer
        active_device, dev_desc = auto_detect_audio_input(self.device)
        self.device = active_device
        logger.info(f"🎤 Starting Audio Capture Worker using: '{self.device}' ({dev_desc}) @ {SAMPLE_RATE} Hz")

        while self.running:
            try:
                # Launch FFmpeg to capture raw uncompressed float32 audio from ALSA
                # Using plughw ensures ALSA automatically performs hardware rate conversion
                # to exactly 48,000 Hz, preventing slow-motion or fast-motion distortion!
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
                    stderr=subprocess.DEVNULL,
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
