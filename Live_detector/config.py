"""
BirdSong Observatory - Live Detector Configuration
===================================================
Manages edge device configuration, audio parameters, paths, 
frequency bands for DSP activity analysis, and Supabase credentials.
Values can be overridden using environment variables or a local .env file.
"""

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent

# Load local .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    # Lightweight fallback parser if python-dotenv is not installed
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        try:
            with open(env_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except Exception:
            pass

DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
MODELS_DIR = DATA_DIR / "models"
CLIPS_DIR = DATA_DIR / "clips"
QUEUE_DB_PATH = DATA_DIR / "live_detector_outbox.db"

# Ensure runtime directories exist
for p in [DATA_DIR, MODELS_DIR, CLIPS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# Station & Node Identity & GPS Coordinates (used for BirdNET species filtering and Observatory maps)
STATION_NAME = os.getenv("STATION_NAME", "Test_01")
PROJECT_NAME = os.getenv("PROJECT_NAME", "Test_custom")
SITE_NAME = os.getenv("SITE_NAME", "Tirupati")
NODE_LATITUDE = float(os.getenv("NODE_LATITUDE", os.getenv("LATITUDE", "13.6288")))
NODE_LONGITUDE = float(os.getenv("NODE_LONGITUDE", os.getenv("LONGITUDE", "79.4192")))
BIRDNET_USE_LAT_LON_FILTER = os.getenv("BIRDNET_USE_LAT_LON_FILTER", "true").lower() in ("true", "1", "yes")

# Supabase Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ktihcjfxxxazohimtiav.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI2MDU4NiwiZXhwIjoyMTAwODM2NTg2fQ.idvkAZGKVtilS0NJ4PD9Lw9T__xz_10oAHLnoyIdZnA")

# Audio Capture Settings
SAMPLE_RATE = int(os.getenv("SAMPLE_RATE", "48000"))  # 48 kHz standard
CHANNELS = 1                                           # Mono audio
WINDOW_SECONDS = float(os.getenv("WINDOW_SECONDS", "3.0"))   # 3-second slices
WINDOW_SAMPLES = int(SAMPLE_RATE * WINDOW_SECONDS)           # 144,000 samples
HOP_SECONDS = float(os.getenv("HOP_SECONDS", "1.5"))         # 50% overlap by default
HOP_SAMPLES = int(SAMPLE_RATE * HOP_SECONDS)

# Mic Device Specification (ALSA hardware string or 'auto' to auto-detect USB mic)
AUDIO_INPUT_DEVICE = os.getenv("AUDIO_INPUT_DEVICE", "auto")

# DSP Activity Analysis Frequency Bands (in Hz)
BAND_LOW_FREQ = (150, 1200)      # Low band: mammals (deer, elephants, primates), anurans
BAND_MID_FREQ = (1200, 8000)     # Mid band: dominant avian vocalization range
BAND_HIGH_FREQ = (8000, 20000)   # High band: bats, cicadas, insects

# DSP Thresholds
ACTIVITY_SNR_THRESHOLD_DB = float(os.getenv("ACTIVITY_SNR_THRESHOLD_DB", "4.5"))
OCCUPIED_AREA_THRESHOLD = float(os.getenv("OCCUPIED_AREA_THRESHOLD", "0.08"))
SPECTRAL_FLATNESS_RAIN_THRESHOLD = float(os.getenv("SPECTRAL_FLATNESS_RAIN_THRESHOLD", "0.35"))
INSECT_VARIANCE_THRESHOLD = float(os.getenv("INSECT_VARIANCE_THRESHOLD", "0.015"))

# Telemetry Intervals
TELEMETRY_INTERVAL_SECONDS = int(os.getenv("TELEMETRY_INTERVAL_SECONDS", "60"))
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "10"))
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "300"))

# Live Audio Stream Server Port (for on-demand streaming to web dashboard)
STREAM_PORT = int(os.getenv("STREAM_PORT", "8888"))
PUBLIC_STREAM_URL = os.getenv("PUBLIC_STREAM_URL", "")
AUTO_CLOUDFLARE_TUNNEL = os.getenv("AUTO_CLOUDFLARE_TUNNEL", "true").lower() in ("true", "1", "yes")
