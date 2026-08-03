# BirdNET-Pi to Supabase Live Sync Daemon

A lightweight, non-intrusive background sync service for Raspberry Pi 4 running BirdNET-Pi.
It continuously uploads new bird call detections and extracted MP3 clips to your Supabase project in real time.

---

## ⚡ Setup Instructions (via SSH)

### Step 1: Copy folder to Raspberry Pi

Transfer the `birdnet-sync` directory to your Raspberry Pi home folder, e.g. `/home/pi/birdnet-sync`.

```bash
scp -r birdnet-sync <your-pi-username>@<PI_IP_ADDRESS>:~/
```

---

### Step 2: Run the Pi Python Sync Daemon Config Generator

The `birdnet-sync.service` file uses the old `livedetector` username as an example. The config generator auto-detects the current user, installs Python dependencies, creates `.env` interactively, and installs the correct systemd service.

```bash
ssh <your-pi-username>@<PI_IP_ADDRESS>
cd ~/birdnet-sync
bash config-generator.sh
```

It will ask you for:

1. **Project Name** — must match the website project (e.g. `Test`)
2. **Site Name** — must match the website site (e.g. `BirdLab`)
3. **Unique Recorder ID** — the recorder node shown on the live dashboard (e.g. `BirdLab (Test Lab 2)`)
4. **Supabase URL**
5. **Supabase Key** (service role key recommended)
6. **Sync Interval**, **Latitude**, **Longitude**

Use the same project and site names as shown in the Birdsong Observatory live dashboard.

### Step 3: Test manually (optional)

```bash
python3 main.py
```

Press `Ctrl + C` to stop.

### Step 4: Verify the 24/7 systemd service

```bash
sudo systemctl status birdnet-sync
journalctl -u birdnet-sync -f
```

---

## 🔍 Service Control Commands

- **Check Live Status**: `sudo systemctl status birdnet-sync`
- **View Real-Time Logs**: `journalctl -u birdnet-sync -f`
- **Restart Daemon**: `sudo systemctl restart birdnet-sync`
- **Stop Daemon**: `sudo systemctl stop birdnet-sync`
