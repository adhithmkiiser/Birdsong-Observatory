# BirdSong Observatory — Live Detector Edge Agent
> **Next-Generation Bioacoustic Edge Agent for Raspberry Pi**  
> Supports simultaneous multi-model inference (BirdNET TFLite + Custom ONNX/TFLite), classical DSP watchdog discrepancy analysis, local SQLite outbox caching, solar powerbank & battery telemetry, deduplicated Opus clip compression, and zero-restart hot-reloading via Supabase.

---

## 🏛️ 1. Architecture Overview

```
                      ☁️ SUPABASE CLOUD BACKEND
   ┌───────────────────────────────────────────────────────────────┐
   │ Tables: models, node_models, window_summaries, detections,    │
   │         station_telemetry                                     │
   │ Storage: models/ (weights & labels), clips/ (.opus audio)    │
   └───────────────▲───────────────────────────────▲───────────────┘
                   │ Realtime Hot-Reload           │ Batched Sync
                   │ (model downloads/toggles)     │
┌──────────────────┼───────────────────────────────┼───────────────────────────┐
│ RASPBERRY PI     ▼                               │                           │
│  [USB Mic]                                       │                           │
│     │ (48 kHz mono)                              │                           │
│     ▼                                            │                           │
│  [capture.py] (FFmpeg continuous stream)         │                           │
│     │                                            │                           │
│     ▼                                            │                           │
│  [ring_buffer.py] (3s window / 1.5s hop)         │                           │
│     │                                            │                           │
│     ├─► [activity.py] (Physical DSP Watchdog)    │                           │
│     │      • Spectro-temporal Event Blobs        │                           │
│     │      • Rain / Wind / Insect Noise Filter   │                           │
│     │      • Frequency Bands (Mammals vs Birds)  │                           │
│     │                                            │                           │
│     ├─► [adapters/] (Simultaneous Inference)     │                           │
│     │      • BirdNET TFLite                      │                           │
│     │      • Custom ONNX (PyTorch/TF exports)    │                           │
│     │      • Generic Custom TFLite               │                           │
│     │                                            │                           │
│     └─► [streamer.py] (Live Opus HTTP Stream)    │                           │
│                                                  │                           │
│  [activity.py] + [adapters/]                     │                           │
│     │                                            │                           │
│     ▼ (Discrepancy Triage Decision:              │                           │
│        UNDER_DETECTED, MODEL_DISAGREEMENT, etc.) │                           │
│     │                                            │                           │
│     ▼                                            │                           │
│  [outbox.py] (Local SQLite Offline Queue)        │                           │
│     │ (Windows, Detections, Solar Telemetry)     │                           │
│     ▼                                            │                           │
│  [uploader.py] ──────────────────────────────────┘                           │
│     • Deduplicated Opus Compression (300KB -> 24KB)                          │
│     • Batched DB Inserts with Offline Retry                                  │
│                                                                              │
│  [telemetry.py] ──► Reads SD Space, CPU Temp, Solar Powerbank & Under-voltage│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 2. Explanation of Each Script

| File | Primary Role & Description |
| :--- | :--- |
| **[`config.py`](config.py)** | Central configuration. Holds station identity (`STATION_NAME`), audio sample rate (48 kHz), window duration (3.0s), frequency bands, Supabase credentials, paths, and thresholds. Can be overridden via `.env`. |
| **[`capture.py`](capture.py)** | Runs an FFmpeg subprocess that continuously reads 48 kHz mono float32 audio from the USB microphone ALSA device (`default` or `hw:1,0`) and streams chunks to the ring buffer. Automatically reconnects if the USB microphone unplugs. |
| **[`ring_buffer.py`](ring_buffer.py)** | A thread-safe circular memory buffer. Continuously buffers audio and slices 3.0-second sliding windows with a 1.5-second hop (50% overlap). Produces deterministic, synchronized `window_id` strings. |
| **[`activity.py`](activity.py)** | **Classical DSP Watchdog Engine**. Computes STFT spectrograms, signal-to-noise ratio (SNR), band energies (low: mammals/frogs, mid: birds, high: insects), blob-based acoustic event counters, spectral flatness (rain filter), and issues triage flags (`UNDER_DETECTED`, `MODEL_DISAGREEMENT`, `BAND_MISMATCH`, `POSSIBLE_OVERLAP`, `UNCOVERED_TAXA`, `LOW_SNR`, `AMBIENT_NOISE`). Runs in <15ms on a Pi 4 CPU! |
| **[`telemetry.py`](telemetry.py)** | **Solar & Hardware Monitor**. Measures available SD card space in GB and %, CPU temperature (°C), RAM/CPU load, and inspects Raspberry Pi firmware (`vcgencmd get_throttled`) to detect powerbank under-voltage (< 4.63V) caused by solar dips. Can also be executed standalone from CLI for instant diagnostics. |
| **[`adapters/base.py`](adapters/base.py)** | `ModelAdapter` abstract base class. Implements rational polyphase audio resampling (`scipy.signal.resample_poly`) to convert 48 kHz into any model's expected rate (e.g. 32 kHz or 16 kHz), Log-Mel spectrogram generation, and label file parsing. |
| **[`adapters/birdnet_tflite.py`](adapters/birdnet_tflite.py)** | Official BirdNET TFLite adapter. Runs the official BirdNET model with 48 kHz 1D waveform input and sigmoid probability extraction. |
| **[`adapters/generic_tflite.py`](adapters/generic_tflite.py)** | Custom TFLite adapter that reads model `manifest.json`. Supports arbitrary inputs (raw waveforms or Mel spectrograms) and activations (Sigmoid or Softmax). |
| **[`adapters/onnx_adapter.py`](adapters/onnx_adapter.py)** | High-performance ONNX Runtime adapter (`onnxruntime`). Optimized for Raspberry Pi ARM64 CPU with zero PyTorch/TensorFlow framework overhead. |
| **[`outbox.py`](outbox.py)** | Local SQLite outbox (`data/live_detector_outbox.db`). Atomically stages windows, detections, and telemetry. Ensures 100% data retention even during multi-day cellular outages. Automatically prunes old uploaded records after 7 days. |
| **[`uploader.py`](uploader.py)** | Background cloud synchronizer. Encodes 3-second audio slices to compact Opus format (dropping file size from 300 KB to ~24 KB), uploads the clip once per window to Supabase Storage, and batch-inserts records into `window_summaries`, `detections`, and `station_telemetry`. |
| **[`control.py`](control.py)** | Cloud model manager. Connects to Supabase, checks `node_models` assignments, downloads newly added models from Supabase Storage (`models/`), validates SHA256 checksums, and dynamically hot-reloads them into memory without restarting the Pi. |
| **[`streamer.py`](streamer.py)** | On-demand HTTP chunked Opus live audio streamer. When a visitor on the observatory website clicks "Listen Live", it encodes and streams real-time audio on port 8888. Automatically stops encoding when no listeners are connected to save battery. |
| **[`main.py`](main.py)** | Master supervisor daemon. Orchestrates capture, inference, activity analysis, telemetry, uploading, and clean OS signal handling (`SIGINT`/`SIGTERM`). |
| **[`schema.sql`](schema.sql)** | Ready-to-run Supabase SQL script creating `models`, `node_models`, `window_summaries`, and `station_telemetry` tables and indexes. |

---

## 💻 3. SSH Command Guide: Setup, Install & Run on Raspberry Pi

### Step 1: SSH into your Raspberry Pi
From your terminal on your computer, connect to the Raspberry Pi:
```bash
ssh pi@<pi_ip_address>
# Or if using default hostname:
ssh pi@raspberrypi.local
```
*(Default password is typically what you configured in Raspberry Pi Imager).*

---

### Step 2: System Packages & Dependencies
Update package lists and install essential system audio & compilation libraries:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv ffmpeg alsa-utils git libopenblas-dev
```

---

### Step 3: Verify Your USB Microphone
Plug in your USB microphone and verify the Raspberry Pi detects it:
```bash
arecord -l
```
You should see a device like:
`card 1: Device [USB PnP Audio Device], device 0: USB Audio [USB Audio]`

Test recording 5 seconds of audio to confirm sound capture:
```bash
arecord -D default -d 5 -f S16_LE -r 48000 test.wav
ls -lh test.wav
# Play it back if speakers attached:
aplay test.wav
rm test.wav
```

---

### Step 4: Clone Only the `Live_detector` Folder from GitHub
Run these commands in your Raspberry Pi SSH terminal:

```bash
# 1. Clone only the repository tree (without downloading the rest of the web app)
git clone --depth 1 --filter=blob:none --sparse https://github.com/adhithmkiiser/Birdsong-Observatory.git ~/Birdsong-Observatory

# 2. Download only the Live_detector folder
cd ~/Birdsong-Observatory
git sparse-checkout set Live_detector

# 3. Create a convenient shortcut link at ~/Live_detector
ln -s ~/Birdsong-Observatory/Live_detector ~/Live_detector

# 4. Enter the Live_detector directory
cd ~/Live_detector
```
*(In the future, you can simply type `git pull` inside this folder to update your detector code whenever you push changes to GitHub!)*

---

### Step 5: Python Virtual Environment & Python Packages
On the Raspberry Pi:
```bash
cd /home/pi/Live_detector

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install required libraries
pip install --upgrade pip
pip install -r requirements.txt

# Install TFLite runtime for Raspberry Pi OS:
pip install tflite-runtime
```

---

### Step 6: Test Solar & Battery Telemetry
Run the telemetry tool standalone to check SD card space, CPU temp, and powerbank supply:
```bash
python3 telemetry.py
```
**Sample Output:**
```
============================================================
📡 BIRDSONG OBSERVATORY - EDGE NODE TELEMETRY REPORT
============================================================
🕒 Timestamp:          2026-10-19T18:00:00Z
🌡️  CPU Temperature:    46.2 °C
💾 SD Card Free:       24.8 GB (82.1% free)
⚠️  SD Low Space Alert: False
🔋 Solar Power Status: Stable Solar Powerbank Supply (5V Active)
⚡ Under-Voltage Alert: False (Powerbank dip alert)
🧠 RAM Usage:          182.4 MB (18.6%)
⏱️  System Uptime:      4.2 hours
============================================================
```

---

### Step 7: Test Run the Full Live Detector Agent Manually
Run the supervisor manually to verify mic ingestion, windowing, and cloud connectivity:
```bash
python3 main.py
```
You should see:
```
[2026-10-19 18:02:00] [INFO] [LiveDetectorMain] 🌿 INITIALIZING LIVE DETECTOR AGENT: WesternGhats_Node_01
[2026-10-19 18:02:01] [INFO] [CaptureEngine] Starting Audio Capture Worker on device: 'default' @ 48000 Hz
[2026-10-19 18:02:01] [INFO] [LiveAudioStreamer] 📻 Live Audio HTTP Streamer listening on port 8888
[2026-10-19 18:02:02] [INFO] [CloudUploader] Connected to Supabase successfully.
[2026-10-19 18:02:03] [INFO] [LiveDetectorMain] 🚀 All systems operational! Beginning real-time audio analysis loop...
```
*(Press `Ctrl + C` to stop the test).*

---

## ⚙️ 4. Setting Up Auto-Start as a System Service (Systemd)

To make sure the Live Detector starts automatically when the solar powerbank boots up the Pi, and automatically restarts if an error occurs, install it as a `systemd` service:

```bash
# 1. Copy service file to systemd directory
sudo cp /home/pi/Live_detector/service/live-detector.service /etc/systemd/system/

# 2. Reload systemd daemon
sudo systemctl daemon-reload

# 3. Enable service to start on every boot
sudo systemctl enable live-detector

# 4. Start the service immediately
sudo systemctl start live-detector
```

### Essential SSH Commands for Managing the Service:
- **Check Status**: `sudo systemctl status live-detector`
- **View Live Logs in Real-Time**: `sudo journalctl -u live-detector -f`
- **Restart the Agent**: `sudo systemctl restart live-detector`
- **Stop the Agent**: `sudo systemctl stop live-detector`

---

## 🔋 5. Solar Powerbank & Battery Monitoring Guide

### How the Solar + Powerbank Setup Works
When powering a Raspberry Pi from a solar panel through a powerbank (pass-through charging):
1. **Bright Sunlight**: Solar panel supplies sufficient current; powerbank charges; Pi receives stable 5.1V.
2. **Passing Cloud / Low Sun**: Solar output drops. Some powerbanks briefly drop output voltage while switching from solar-input to battery-discharge.
3. **Deep Night / Depleted Battery**: Powerbank output drops below 4.63V.

### How `telemetry.py` Detects Solar Issues:
Raspberry Pi hardware has a built-in PMIC comparator connected to the SoC. If the 5V rail dips below **4.63V**, the hardware registers an **under-voltage flag**.
`telemetry.py` reads this via `vcgencmd get_throttled`:
- **Under-Voltage Now (`0x1`)**: The solar panel / powerbank is currently struggling to provide 5V.
- **Under-Voltage Has Occurred (`0x10000`)**: A momentary solar dip occurred earlier.

All under-voltage events and battery levels are logged to `station_telemetry` in Supabase, allowing you to plot solar power health directly in the web dashboard!

---

## 🛠️ 6. Troubleshooting & Error Recovery

### Issue 1: "FFmpeg not found"
**Cause**: FFmpeg is not installed on the system.  
**Fix**:
```bash
sudo apt update && sudo apt install -y ffmpeg
```

---

### Issue 2: "Capture stream returned empty bytes / Device disconnected"
**Cause**: USB microphone lost power due to a solar dip or was bumped.  
**Fix**:
1. Check `arecord -l` to verify the microphone card index.
2. If the mic is on card 1, update `AUDIO_INPUT_DEVICE` in `config.py` or `.env`:
   ```bash
   export AUDIO_INPUT_DEVICE="hw:1,0"
   ```
3. The script automatically retries reconnecting every 3 seconds.

---

### Issue 3: "Under-voltage alert detected / Yellow lightning bolt icon"
**Cause**: Powerbank output voltage dropped below 4.63V. Common causes:
- Thin or long USB power cable (high resistance).
- Powerbank cannot supply 3A continuous.
- Solar panel wattage is insufficient for battery charging during cloudy hours.  
**Fix**:
1. Use a short, thick, high-quality 20 AWG USB-C power cable.
2. In `config.py`, reduce CPU load by increasing `HOP_SECONDS` from `1.5` to `2.5`.

---

### Issue 4: "Cellular connection down / Outbox database size"
**Behavior**: The agent stores all detections, windows, and telemetry in `data/live_detector_outbox.db`. When internet connectivity returns, `uploader.py` uploads the backlog in batches.  
To verify pending queue count on the Pi:
```bash
sqlite3 /home/pi/Live_detector/data/live_detector_outbox.db "SELECT count(*) FROM outbox_windows WHERE uploaded=0;"
```

---

### Issue 5: SD Card Space Filling Up
**Behavior**: The outbox automatically removes uploaded records older than 7 days, and deleted local temporary audio clips as soon as they are uploaded to cloud storage.  
To check disk space manually via SSH:
```bash
df -h /
```

---

## 🧠 7. Deploying Custom Models (ONNX / TFLite) via Dashboard

To deploy a custom model (e.g. for Western Ghats endemics or nocturnal animals) to your Raspberry Pi without restarting it:

1. Package your model into a folder:
   - `model.onnx` (or `model.tflite`)
   - `labels.txt` (one species name per line)
   - `manifest.json`:
     ```json
     {
       "target_sample_rate": 32000,
       "input_type": "mel_spectrogram",
       "n_mels": 128,
       "n_fft": 1024,
       "hop_length": 320,
       "output_activation": "sigmoid"
     }
     ```
2. Upload the model files to Supabase Storage in the `models/` bucket.
3. Insert a record into `models` and link it to your node in `node_models`.
4. Your Raspberry Pi agent hears the update, automatically downloads the files, verifies SHA256, and begins multi-model inference on the very next 3-second window!
