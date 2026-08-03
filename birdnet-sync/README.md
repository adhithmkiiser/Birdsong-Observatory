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

### Step 2: Pi Python Sync Daemon Config Generator

The `birdnet-sync.service` file uses the old Pi username `livedetector`. If your new Pi has a different username, run the config generator from the `birdnet-sync` folder. It auto-detects the current user, installs Python dependencies, creates `.env` from `.env.example` if missing, and installs the correct systemd service:

```bash
ssh <your-pi-username>@<PI_IP_ADDRESS>
cd ~/birdnet-sync
bash config-generator.sh
```

After it finishes, move on to Step 3 to edit the generated `.env` file.

### Step 3: Install Python dependencies
If you did not run the config generator, SSH into your Pi and install the Python requirements manually:
```bash
ssh <your-pi-username>@<PI_IP_ADDRESS>
cd ~/birdnet-sync
pip3 install -r requirements.txt
```

---

### Step 4: Configure Environment Variables
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

### Step 5: Test Manually First
Run a manual test cycle to verify everything connects:
```bash
python3 main.py
```
You will see output indicating detected calls being synced and uploaded to Supabase. Press `Ctrl + C` to stop.

---

### Step 6: Install as 24/7 Systemd Service (Auto-Start on Boot)
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
