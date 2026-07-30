# BirdNET-Pi to Supabase Live Sync Daemon

A lightweight, non-intrusive background sync service for Raspberry Pi 4 running BirdNET-Pi.
It continuously uploads new bird call detections and extracted MP3 clips to your Supabase project in real time.

---

## ⚡ Setup Instructions (via SSH)

### Step 1: Copy folder to Raspberry Pi
Transfer the `birdnet-sync` directory to your Raspberry Pi home folder: `/home/livedetector/birdnet-sync`.

Alternatively, directly via SCP from your computer:
```bash
scp -r birdnet-sync livedetector@<PI_IP_ADDRESS>:/home/livedetector/
```

---

### Step 2: Install Python dependencies
SSH into your Raspberry Pi and install requirements:
```bash
ssh livedetector@<PI_IP_ADDRESS>
cd /home/livedetector/birdnet-sync
pip3 install -r requirements.txt
```

---

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
nano .env
```

Set your station ID and Supabase credentials:
```env
SUPABASE_URL=https://ktihcjfxxxazohimtiav.supabase.co
SUPABASE_KEY=your_supabase_anon_key
STATION_ID=node-shola-01
STATION_NAME=Shola Canopy Recorder Node 01
```

---

### Step 4: Test Manually First
Run a manual test cycle to verify everything connects:
```bash
python3 main.py
```
You will see output indicating detected calls being synced and uploaded to Supabase. Press `Ctrl + C` to stop.

---

### Step 5: Install as 24/7 Systemd Service (Auto-Start on Boot)
Execute these 3 commands to register and start the background service:
```bash
sudo cp birdnet-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable birdnet-sync
sudo systemctl start birdnet-sync
```

---

## 🔍 Service Control Commands

- **Check Live Status**: `sudo systemctl status birdnet-sync`
- **View Real-Time Logs**: `journalctl -u birdnet-sync -f`
- **Restart Daemon**: `sudo systemctl restart birdnet-sync`
- **Stop Daemon**: `sudo systemctl stop birdnet-sync`
