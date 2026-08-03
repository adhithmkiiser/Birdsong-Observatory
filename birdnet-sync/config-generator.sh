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

# Generate .env from example if missing
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "Created .env from .env.example — please edit it after this script."
fi

# Make sure Python deps are present
if [ -f "requirements.txt" ]; then
  pip3 install -q -r requirements.txt
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
