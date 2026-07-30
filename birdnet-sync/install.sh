#!/bin/bash
# BirdNET-Pi to Supabase Live Sync Daemon Installer Script
# IISER Tirupati Bird Lab / BirdSong Observatory

echo "=========================================================="
echo "⚡ Installing BirdNET-Pi Live Sync Daemon..."
echo "=========================================================="

sudo apt-get update -y && sudo apt-get install -y python3-pip python3-setuptools git

pip3 install requests python-dotenv

echo "✅ Dependencies Installed!"
echo ""
echo "To run the daemon with your project name, site name, and recorder ID:"
echo "python3 main.py --project \"Bird_Lab_demo\" --site \"Test_lab_1\" --recorder \"station_01\""
echo "=========================================================="
