#!/bin/bash
# Pi Python Sync Daemon Config Generator
# Adapts the birdnet-sync systemd service to the current Pi user and copies it into place.

set -e

USER=$(whoami)
HOME_DIR=$(eval echo ~$USER)
SERVICE_DIR="$HOME_DIR/birdnet-sync"
SERVICE_FILE="$SERVICE_DIR/birdnet-sync.service"
INSTALL_PATH="/etc/systemd/system/birdnet-sync.service"

echo "=========================================================="
echo "  Pi Python Sync Daemon Config Generator"
echo "=========================================================="
echo "Detected user: $USER"
echo "Service dir:   $SERVICE_DIR"
echo ""

if [ ! -d "$SERVICE_DIR" ]; then
  echo "ERROR: $SERVICE_DIR not found."
  echo "Copy the birdnet-sync directory to $HOME_DIR first."
  exit 1
fi

cd "$SERVICE_DIR"

# Generate / update .env
if [ -f ".env" ]; then
  read -p "A .env file already exists. Keep it and only fix the Pi username paths? [Y/n]: " keep_env
  keep_env=${keep_env:-Y}
  if [[ "$keep_env" =~ ^[Yy]$ ]]; then
    sed -i "s|/home/livedetector|/home/$USER|g" .env
    echo "Updated .env paths to /home/$USER."
  else
    echo "Reconfiguring .env — just press Enter to accept each default."
  fi
fi

if [ ! -f ".env" ] || [[ ! "$keep_env" =~ ^[Yy]$ ]]; then
  # Read defaults from .env.example if present
  default_supabase_url="https://ktihcjfxxxazohimtiav.supabase.co"
  default_supabase_key=""
  if [ -f ".env.example" ]; then
    default_supabase_url=$(grep '^SUPABASE_URL=' .env.example | cut -d= -f2- | tr -d ' "')
    default_supabase_key=$(grep '^SUPABASE_KEY=' .env.example | cut -d= -f2- | tr -d ' "')
  fi
  [ -z "$default_supabase_url" ] && default_supabase_url="https://<your-project>.supabase.co"

  echo "=========================================================="
  echo "  Enter your Project, Site, and Recorder details"
  echo "=========================================================="

  read -p "Project Name [Western Ghats Live Observatory]: " project_name
  project_name=${project_name:-Western Ghats Live Observatory}
  read -p "Site Name [Inside BirdLab]: " site_name
  site_name=${site_name:-Inside BirdLab}
  read -p "Unique Recorder ID [Test_Lab_1]: " recorder_id
  recorder_id=${recorder_id:-Test_Lab_1}
  read -p "Supabase URL [$default_supabase_url]: " supabase_url
  supabase_url=${supabase_url:-$default_supabase_url}
  read -s -p "Supabase Key (service role recommended) [hidden]: " supabase_key
  echo ""
  supabase_key=${supabase_key:-$default_supabase_key}
  read -p "Sync Interval in seconds [10]: " sync_interval
  sync_interval=${sync_interval:-10}
  read -p "Latitude [13.6288]: " latitude
  latitude=${latitude:-13.6288}
  read -p "Longitude [79.4192]: " longitude
  longitude=${longitude:-79.4192}

  cat > .env <<EOF
SUPABASE_URL=$supabase_url
SUPABASE_KEY=$supabase_key
PROJECT_NAME=$project_name
PROJECT_ID=$project_name
SITE_NAME=$site_name
STATION_NAME=$site_name
SITE_ID=$(echo "$site_name" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
STATION_ID=$recorder_id
RECORDER_ID=$recorder_id
SQLITE_DB=/home/$USER/BirdNET-Pi/scripts/birds.db
AUDIO_ROOT=/home/$USER/BirdSongs/Extracted/By_Date
LATITUDE=$latitude
LONGITUDE=$longitude
SYNC_INTERVAL=$sync_interval
STATE_FILE=state.json
EOF

  echo "Created .env for:"
  echo "  Project : $project_name"
  echo "  Site    : $site_name"
  echo "  Recorder: $recorder_id"
  echo "  User    : $USER"
fi

# Make sure Python deps are present
if [ -f "requirements.txt" ]; then
  pip3 install -q -r requirements.txt --break-system-packages
  echo "Python dependencies installed."
else
  echo "requirements.txt not found — skipping dependency install."
fi

if [ ! -f "birdnet-sync.service" ]; then
  echo "ERROR: birdnet-sync.service not found in $SERVICE_DIR"
  exit 1
fi

# Generate the service file for this user
sed -e "s|/home/livedetector|/home/$USER|g" \
    -e "s/^User=.*/User=$USER/" \
    -e "s/^Group=.*/Group=$USER/" \
    birdnet-sync.service > /tmp/birdnet-sync.service

# Install and start
sudo cp /tmp/birdnet-sync.service "$INSTALL_PATH"
sudo systemctl daemon-reload
sudo systemctl enable birdnet-sync
sudo systemctl start birdnet-sync

echo ""
echo "=========================================================="
echo "  birdnet-sync is installed and running"
echo "=========================================================="
echo "Check status: sudo systemctl status birdnet-sync"
echo "View logs:    sudo journalctl -u birdnet-sync -f"
