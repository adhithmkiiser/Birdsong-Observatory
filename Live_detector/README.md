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

### Step 3: Verify Your USB Microphone & Tune Input Gain
Plug in your USB microphone and verify the Raspberry Pi detects it:
```bash
arecord -l
```
You should see your USB microphone listed, for example:
`card 1: Audio [AB13X USB Audio], device 0: USB Audio [USB Audio]`

#### 🎙️ Adjust Microphone Gain (Avoid Distorted / Clipped Audio)
If the microphone hardware input volume in ALSA is boosted to 100% (+30 dB digital gain), incoming audio will digital-clip into a square wave, creating terrible distortion, buzzing, and crackling.
To calibrate clean acoustic levels:
```bash
alsamixer
```
1. Press `F6` and select your USB Audio Device.
2. Press `F4` to switch to **Capture / Input** controls.
3. Use the arrow keys to adjust the capture volume to **65% – 75%** (in the green/mild yellow range).
4. Press `ESC` to exit, and make the setting permanent across reboots:
```bash
sudo alsactl store
```

Test recording 5 seconds of audio to confirm clean sound capture:
```bash
arecord -D plughw:1,0 -d 5 -f S16_LE -r 48000 test.wav
ls -lh test.wav
# Play it back if speakers / headphones attached:
aplay test.wav
rm test.wav
```

---

### Step 4: Clone Only the `Live_detector` Folder from GitHub
Run these commands in your Raspberry Pi SSH terminal:

```bash
# 1. Clean up any empty directory if previously created
rm -rf ~/Live_detector

# 2. Clone only the repository tree (without downloading the rest of the web app)
git clone --depth 1 --filter=blob:none --sparse https://github.com/adhithmkiiser/Birdsong-Observatory.git ~/Birdsong-Observatory

# 3. Download only the Live_detector folder
cd ~/Birdsong-Observatory
git sparse-checkout set Live_detector

# 4. Create a convenient shortcut link at ~/Live_detector
ln -s ~/Birdsong-Observatory/Live_detector ~/Live_detector

# 5. Enter the Live_detector directory
cd ~/Live_detector

# 6. Set your microphone hardware card in .env (e.g. card 1)
echo "AUDIO_INPUT_DEVICE=plughw:1,0" >> .env
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

# Install required dependencies (NumPy, SciPy, Supabase, Sounddevice, ONNXRuntime)
pip install -r requirements.txt
```
*(Note: `requirements.txt` installs `onnxruntime` which powers fast multi-model edge inference natively on Python 3.11, 3.12, and 3.13).*

---

### Step 5b: Official Cornell BirdNET-Pi v2.4 Edge Model Setup
The Raspberry Pi runs **Cornell BirdNET v2.4 directly on the edge hardware** to classify 6,000+ species with zero cloud latency.

The agent's `control.py` will automatically download the model on first launch if missing. Alternatively, you can download the official model weights and taxonomy labels immediately via terminal:

```bash
# 1. Create default model assets directory
mkdir -p ~/Live_detector/models/birdnet_default

# 2. Download official taxonomy labels (6,522 species)
curl -L -o ~/Live_detector/models/birdnet_default/labels.txt \
  https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt

# 3. Download official Cornell BirdNET v2.4 FP32 TFLite core model (~51 MB)
curl -L -o ~/Live_detector/models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite \
  https://raw.githubusercontent.com/woheller69/whoBIRD-TFlite/master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite
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
🕒 Timestamp:          2026-10-21T18:00:00Z
🌡️  CPU Temperature:    40.4 °C
💾 SD Card Free:       25.5 GB (94.0% free)
⚠️  SD Low Space Alert: False
🔋 Solar Power Status: Stable 5V Power Supply
⚡ Under-Voltage Alert: False (Powerbank nominal)
🧠 RAM Usage:          182.4 MB (18.6%)
⏱️  System Uptime:      5.5 hours
============================================================
```

---

### Step 7: Test Run the Full Live Detector Agent Manually
Run the supervisor manually to verify mic ingestion, BirdNET edge inference, live streaming, and cloud synchronization:
```bash
python3 main.py
```
You should see:
```
[2026-10-21 18:02:00] [INFO] [LiveDetectorMain] =================================================================
[2026-10-21 18:02:00] [INFO] [LiveDetectorMain] 🌿 INITIALIZING LIVE DETECTOR AGENT: Test_01
[2026-10-21 18:02:00] [INFO] [LiveDetectorMain] 📍 Project Scope: Test_custom
[2026-10-21 18:02:00] [INFO] [LiveDetectorMain] =================================================================
[2026-10-21 18:02:01] [INFO] [CloudUploader] Connected to Supabase successfully.
[2026-10-21 18:02:01] [INFO] [ControlManager] ControlManager connected to Supabase.
[2026-10-21 18:02:01] [INFO] [CaptureEngine] Starting Audio Capture Worker on device: 'plughw:1,0' @ 48000 Hz
[2026-10-21 18:02:01] [INFO] [LiveAudioStreamer] 📻 Live Audio HTTP Streamer listening on port 8888 (URL: http://<pi_ip>:8888/stream.opus)
[2026-10-21 18:02:02] [INFO] [ControlManager] ✓ Successfully hot-loaded model 'BirdNET-Pi v2.4 (Official)' into live inference pipeline!
[2026-10-21 18:02:02] [INFO] [BirdNetAdapter] 🌿 BirdNET GPS species filter active for (13.6288, 79.4192)
[2026-10-21 18:02:03] [INFO] [LiveDetectorMain] 🚀 All systems operational! Beginning real-time audio analysis loop...
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

## 🛠️ 6. Troubleshooting & Error Recovery Guide

### Issue 1: "WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! Host key verification failed."
**Cause**: You re-flashed your SD card. The Pi generated a fresh security fingerprint, but your computer remembers the old key in `known_hosts`.  
**Fix**: On your **Windows PC** Command Prompt / PowerShell, clear the old key:
```cmd
ssh-keygen -R livedetector.local
# Or if using IP:
ssh-keygen -R <pi_ip_address>
```
Then run `ssh pi@livedetector.local` again and type `yes` when prompted.

---

### Issue 2: "user@livedetector.local: Permission denied (publickey,password)"
**Cause**: You ran `ssh livedetector.local` without specifying the username, so Windows defaulted to your Windows username (`user` or `USER`).  
**Fix**: Always explicitly include **`pi@`**:
```cmd
ssh pi@livedetector.local
```

---

### Issue 3: "Package 'libatlas-base-dev' has no installation candidate" or "Unmet dependencies"
**Cause**: In modern 64-bit Debian Bookworm and Debian Trixie (Debian 12/13), ATLAS has been replaced by OpenBLAS.  
**Fix**: Run:
```bash
sudo apt --fix-broken install -y
sudo apt install -y git python3-pip python3-venv ffmpeg alsa-utils libopenblas-dev
```

---

### Issue 4: "-bash: git: command not found"
**Cause**: Git was not installed or an earlier package install command was interrupted.  
**Fix**: Run:
```bash
sudo apt update && sudo apt install -y git
git --version
```

---

### Issue 5: `arecord -l` shows no capture devices / Empty list
**Cause**:
1. ⚠️ **The 3.5mm round jack on Raspberry Pi is Audio OUT only** (headphones). It has no microphone input. If using a 3.5mm microphone, you must plug it into a small USB soundcard adapter.
2. The USB microphone is loose, plugged into an unpowered hub, or hasn't enumerated.  
**Fix**:
1. Check if the Linux USB bus sees the device:
   ```bash
   lsusb
   ```
2. Unplug and firmly plug the mic into one of the **blue USB 3.0 ports**.
3. Check the kernel log to see physical connection messages:
   ```bash
   sudo dmesg | tail -n 20
   ```
4. Once detected, run `arecord -l` to find the card number.

---

### Issue 6: Setting the ALSA audio device for your microphone
**Cause**: The USB microphone might be enumerated on `card 1`, `card 2`, or `card 3`.  
**Fix**:
1. Run `arecord -l` and note the card number (e.g. `card 3: Audio [AB13X USB Audio]`).
2. Add the hardware string (`plughw:X,0`) to your `.env` file:
   ```bash
   echo "AUDIO_INPUT_DEVICE=plughw:3,0" >> ~/Live_detector/.env
   ```
3. Test recording 5 seconds with that specific device:
   ```bash
   arecord -D plughw:3,0 -d 5 -f S16_LE -r 48000 test.wav
   ls -lh test.wav
   rm test.wav
   ```

---

### Issue 7: Empty folder collision when cloning from GitHub
**Cause**: An empty directory `~/Live_detector` was created before running the git sparse-checkout command.  
**Fix**: Remove the empty directory first, then clone and create the symlink:
```bash
rm -rf ~/Live_detector
git clone --depth 1 --filter=blob:none --sparse https://github.com/adhithmkiiser/Birdsong-Observatory.git ~/Birdsong-Observatory
cd ~/Birdsong-Observatory
git sparse-checkout set Live_detector
ln -s ~/Birdsong-Observatory/Live_detector ~/Live_detector
cd ~/Live_detector
```

---

### Issue 8: "Capture stream returned empty bytes / Device disconnected"
**Cause**: USB microphone lost power due to a solar dip or was bumped.  
**Fix**:
1. Check `arecord -l` to verify the microphone card index.
2. The capture engine in `capture.py` automatically detects device disconnection and retries every 3 seconds with exponential backoff.

---

### Issue 9: Distorted, Scratchy, or Repeating / Stuttering Live Audio
**Cause**:
1. **ALSA Microphone Input Gain Too High (Clipping)**: If the USB microphone capture gain in Linux is at 100% (+30 dB digital gain), all incoming sound digital-clips into a harsh, buzzy square wave.
2. **Old Streamer Hop Loop**: In older versions, `streamer.py` was pulling from the 1.5s sliding window buffer, causing audio to repeat every 1.5 seconds.
**Fix**:
1. Open `alsamixer` on your Raspberry Pi:
   ```bash
   alsamixer
   ```
   - Press `F6` and select your USB Audio Device.
   - Press `F4` to enter **Capture** settings.
   - Lower the volume bar to **65% – 75%** (nominal green range).
   - Press `ESC` to exit, and run `sudo alsactl store` to persist across reboots.
2. Run `git pull` in `~/Live_detector` to ensure you have the updated `streamer.py` and `capture.py`, which use direct linear audio queues with zero overlap and zero stutter.

---

### Issue 10: 0 Live Detections / "Awaiting incoming species detections..." (Missing BirdNET Model)
**Cause**: In the cloud registry, the model `BirdNET-Pi v2.4 (Official)` is assigned to your node, but the Cornell BirdNET model weights (`BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite` ~51 MB) and class labels (`labels.txt`) have not been downloaded to the Raspberry Pi yet. Without model weights, edge AI inference cannot run.  
**Fix**:
Download the official Cornell BirdNET v2.4 model assets onto your Raspberry Pi:
```bash
mkdir -p ~/Live_detector/models/birdnet_default

# Download official class taxonomy (6,522 species)
curl -L -o ~/Live_detector/models/birdnet_default/labels.txt \
  https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt

# Download official FP32 TFLite model weights (~51 MB)
curl -L -o ~/Live_detector/models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite \
  https://raw.githubusercontent.com/woheller69/whoBIRD-TFlite/master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite
```
*(Alternatively, simply running `git pull` and `python3 main.py` will now trigger the built-in auto-downloader in `control.py` to fetch them automatically).*

---

### Issue 11: "Under-voltage alert detected / Solar powerbank dip"
**Cause**: Powerbank output voltage dropped below 4.63V from solar cloud cover or high resistance cable.  
**Fix**:
1. Use a short, thick, high-quality 20 AWG USB-C power cable.
2. In `config.py`, reduce CPU load by increasing `HOP_SECONDS` from `1.5` to `2.5`.

---

### Issue 12: SD Card Space Filling Up
**Behavior**: The outbox automatically removes uploaded records older than 7 days and cleans up local temporary 3s audio clips immediately after upload to Supabase storage.  
To check free disk space manually via SSH:
```bash
df -h /
```

---

## 📻 7. Audio Streaming Architecture: Direct Live Stream vs Cloud Call Clips

The observatory provides two distinct acoustic pipelines designed for different operational workflows:

```
                  ┌───────────────────────────────────────────────┐
                  │           Raspberry Pi Edge Node              │
                  │   (Continuous 48 kHz Mono USB Microphone)     │
                  └───────────────┬───────────────────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
   📻 DIRECT LIVE STREAM (PORT 8888)    ☁️ CLOUD CALL CLIPS (SUPABASE)
   • Dedicated linear streaming queue   • 3.0s sliding analysis windows
   • Real-time Opus encoding            • BirdNET & DSP triage evaluation
   • Sent directly to local browser     • On species detection / anomaly:
   • 0% buffer overlap, 0% stutter        compresses to 24 KB Opus clip &
   • Shuts down when no one listens       uploads to Supabase Storage ('clips/')
   • Purpose: Real-time live listening  • Purpose: Click-to-play past calls
```

### 1. Direct Live Stream (Port 8888 & Cloudflare Public Tunnel) — *Recommended for Live Monitoring*
- **What it is**: Direct real-time Opus stream transmitted directly from your Raspberry Pi's local HTTP streamer on port 8888:
  ```
  http://<raspberry_pi_ip>:8888/stream.opus
  ```
- **🌐 Listening Outside Local Wi-Fi (Worldwide Access via Cloudflare Tunnel)**:
  Private IP addresses (`192.168.x.x`, `.local`) only work when your computer is connected to the exact same Wi-Fi router as the Pi. To listen remotely from mobile cellular data (4G/5G) or outside Wi-Fi:
  1. Install `cloudflared` on your Raspberry Pi:
     ```bash
     curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
     sudo dpkg -i cloudflared.deb
     ```
  2. When you run `python3 main.py`, the agent **automatically detects `cloudflared`**, launches an outbound HTTPS tunnel, and grabs a free public URL (e.g. `https://<tunnel-id>.trycloudflare.com/stream.opus`).
  3. **Automatic Dashboard Linking**: The agent immediately syncs this URL to your Supabase `recorders_registry`. When you open the Live Dashboard, the **Stream Target is linked automatically**—no typing or manual URL copying required!
- **Low-Latency Zero-Buffering Audio Engine**:
  Uses strict 48,000 Hz resampling with `-application lowdelay -frame_duration 20 -flush_packets 1`. Audio packets are flushed to the web browser in 20 ms frames without buffering delay, eliminating pitch drop and slow-motion distortion.
- **Power Efficiency**: The live encoder only runs when an active web browser is connected; when disconnected, it shuts down to conserve solar battery power.

### 2. Cloud Call Clips — *Stored Historical Recordings*
- **What it is**: High-fidelity 3.0-second `.opus` clips saved when a bird species is detected or when an anomalous acoustic event triggers the DSP triage watchdog.
- **Where it is stored**: Uploaded to Supabase Storage in the `clips/` bucket via global HTTPS CDN.
- **How it works**: These clips are linked to individual detection cards in the Live Dashboard and review queue, allowing researchers anywhere on earth to click "Play" on any historical bird detection card to inspect the spectrogram and listen to the call.
- **Auto-Play Alert**: Turn on "Auto-play on new detection" in the dashboard to automatically play audio whenever a bird is identified in the field!

---

## 🧠 8. Deploying Custom Models (ONNX / TFLite) via Dashboard

To deploy a custom model (e.g. for regional endemics, nocturnal mammals, or frogs) to your Raspberry Pi without restarting it:

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

