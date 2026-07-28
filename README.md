# 🦅 Birdsong Observatory Platform & PAM Bioacoustics Hub
### IISER Tirupati Bird Ecology Lab

A continuous, landscape-scale bioacoustic monitoring platform for biodiversity, avian community tracking, and ecological restoration evaluation across South Asian ecosystems (Western Ghats, Sheshachalam Biosphere Reserve, and Shola forest transects).

---

## 🏗️ System Architecture & Live Sync Workflow

```
                        FIELD SENSOR (Raspberry Pi 4)
                                    │
                              BirdNET-Pi
                                    │
                   ┌────────────────┴────────────────┐
                   │                                 │
             SQLite Database                   Audio Clips (.wav)
            (birds.db / rows)                 (clips/YYYY/MM/DD/*.wav)
                   │                                 │
                   └──────────────┬──────────────────┘
                                  │
                       Python Sync Service (birdnet_sync.py)
                                  │
                  ┌───────────────┼─────────────────┐
                  │               │                 │
             Read newest    Upload audio      Retry if offline
             un-uploaded    to Storage        (zero duplicates)
                  │               │
                  └───────────────┴─────────────────┘
                                  │
                               Internet
                                  │
                                  ▼
                         SUPABASE CLOUD
              ┌───────────────────┴───────────────────┐
              │                                       │
         PostgreSQL                              Storage
     (`detections` table)                  (`birdnet-audio` bucket)
              │                                       │
              └───────────────────┬───────────────────┘
                                  │
                          Supabase Realtime
                                  │
                                  ▼
                            YOUR WEBSITE
       (Live Feed · Dashboards · Maps · Species · Audio Player)
```

---

## 🔍 Detailed Component Workflow

### 1. 🍓 Field Sensor Node (Raspberry Pi 4)
* **BirdNET-Pi** continuously records ambient soundscapes at **48.0 kHz 16-bit PCM**.
* Native 3.0-second audio windows are evaluated by local TensorFlow Lite CNN models.
* When a bird species is detected (e.g. *Indian Pitta*, confidence `0.98`):
  * **Metadata Row:** Inserted into local SQLite database (`/home/pi/BirdNET-Pi/scripts/birds.db`).
  * **Audio Snippet:** Saved to local storage (`/home/pi/BirdNET-Pi/clips/2026/07/28/064215.wav`).
* **Offline Local Storage:** Nothing goes to the internet yet; all data is buffered safely on the local SD card.

### 2. 🐍 Background Python Sync Service (`python-sync/birdnet_sync.py`)
* Runs as a `systemd` daemon service on the Raspberry Pi every 15–30 seconds.
* **Delta Reading:** Queries local SQLite for new un-uploaded detections (`WHERE uploaded = 0`). Only delta rows are processed; the database itself is never re-uploaded.
* **Audio Upload:** Uploads audio clip to Supabase Storage:
  ```
  birdnet-audio/<station_id>/YYYY/MM/DD/064215.wav
  ```
* **Metadata Insertion:** Writes detection record into Supabase PostgreSQL table (`station_id`, `timestamp`, `species`, `confidence`, `latitude`, `longitude`, `audio_path`).
* **State Update:** Updates local status (`uploaded = 1`) to guarantee **zero duplicate uploads**.
* **Offline Resilience:** Auto-retries failed uploads if field cellular/Wi-Fi connection drops.

### 3. ⚡ Supabase Cloud Engine
* **PostgreSQL Database:** Stores structured detection records, field stations, species ecological traits, and project directories.
* **Storage Buckets:** Serves high-speed audio `.wav` clips and spectrogram images.
* **Supabase Realtime:** Broadcasts database `INSERT` triggers instantly to subscribed web clients.

### 4. 🌐 Next.js Web Platform & User Interface
* **Zero Direct Pi Communication:** The website never connects directly to the Raspberry Pi field nodes.
* **Realtime Live Feed:** Listens to Supabase Realtime triggers for instant live feed updates without page refreshes.
* **Audio Player:** Plays audio clips directly from Supabase Storage CDN URLs.

---

## 📋 5-Step Deployment Guide

### Step 1: Set up Raspberry Pi Hardware
* Flash Raspberry Pi OS (64-bit) onto high-speed microSD card.
* Connect USB microphone or audio pre-amplifier injector.

### Step 2: Install BirdNET-Pi
* Run official BirdNET-Pi installer:
  ```bash
  curl -s font.birdnet-pi.com/install.sh | bash
  ```
* Verify BirdNET-Pi web server is running and detecting local bird calls.

### Step 3: Locate Database & Audio Clip Folders
* **SQLite DB Path:** `/home/pi/BirdNET-Pi/scripts/birds.db`
* **Audio Clips Directory:** `/home/pi/BirdNET-Pi/By_Date/` or `/home/pi/BirdNET-Pi/clips/`

### Step 4: Install & Run Python Sync Daemon
* Copy `python-sync/birdnet_sync.py` to `/home/pi/birdnet_sync.py`.
* Set environment variables:
  ```bash
  export SUPABASE_URL="https://<your-project-id>.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
  export STATION_NAME="WesternGhats_Node_01"
  export PROJECT_NAME="Western Ghats Bioacoustics"
  ```
* Enable systemd background service:
  ```bash
  sudo systemctl enable --now birdnet-sync.service
  ```

### Step 5: Connect Web Platform & Realtime
* Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
* Start Next.js web application:
  ```bash
  npm run dev
  ```

---

## 🚀 Web Platform Features & Dashboard Formats

### 1. 🏠 Public Landing Pages & Portfolio (`/home`, `/about`)
* Parallax hero banner with topographical overlays and IISER Tirupati lab credentials.
* **Projects Section (`#projects`):**
  * **1. Passive Acoustic Monitoring (PAM) Projects**
  * **2. Live Recorder Projects**

### 2. 📊 Dual Dashboard System
* **TST Format Dashboard (`/dashboard/tst`):** Dedicated dashboard layout for The Shola Trust dataset using genuine field data (`data.json` & `config.json` with 110,384 call detections across 186 species, Lantana-Cleared vs Infested indicators, 24-hr diurnal distribution).
* **Common Format Dashboard (`/dashboard/common`):** Flexible, modular dashboard template for all newly created research projects.

### 3. 🛡️ Dual Admin Consoles & User Permissions Governance
* **PAM Data Admin Console (`/admin/pam`):** Multi-file BirdNET CSV result parser, filename site code auto-detection, inline site registration, and species ecological trait curator.
* **Live Recorder Admin Console (`/admin/live`):** Mic pre-amp gain (+dB) sliders, BirdNET CNN confidence threshold sliders, RTSP stream node registration, and fixed hardware specifications (`48.0 kHz`, `3.0s chunk`, `RTSP/WebRTC`).
* **User Accounts Governance (`/users`):** Admin control center to assign manager permissions (**PAM Only**, **Live Only**, or **Both**).

---

## 🛠️ Tech Stack & Dependencies
* **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Leaflet GIS Maps.
* **Backend Cloud:** Supabase PostgreSQL, Supabase Storage, Supabase Realtime.
* **Field Edge Node:** Raspberry Pi 4, BirdNET-Pi, Python 3, SQLite, `supabase-py`.

---

© 2026 IISER Tirupati Bird Ecology Lab & The Shola Trust. All Rights Reserved.
