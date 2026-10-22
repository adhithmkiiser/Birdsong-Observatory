#!/usr/bin/env python3
"""
BirdSong Observatory - Edge Microphone & Audio Diagnostic Tool
=============================================================
Quickly tests your USB microphone on the Raspberry Pi:
1. Lists all ALSA audio input devices (arecord -l)
2. Checks & un-mutes the hardware ALSA capture mixer (amixer)
3. Records a 3-second test clip
4. Measures Peak amplitude and RMS dBFS volume to verify human voice clarity
5. Shows the exact device string to set in your .env file

Usage on Raspberry Pi:
    python3 test_mic.py
"""

import os
import re
import sys
import time
import wave
import subprocess
import numpy as np

def run_cmd(cmd):
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        return res.stdout.strip(), res.stderr.strip(), res.returncode
    except Exception as e:
        return "", str(e), -1

def print_header(title):
    print("\n" + "=" * 65)
    print(f"🎙️  {title}")
    print("=" * 65)

def main():
    print_header("BirdSong Observatory - Microphone Audio Diagnostic")

    # 1. Scan ALSA hardware devices
    print("\n1. Scanning ALSA Audio Hardware Devices (arecord -l)...")
    stdout, stderr, code = run_cmd(["arecord", "-l"])
    
    if code != 0 or not stdout:
        print("⚠️  Warning: 'arecord -l' did not return devices. Make sure ALSA utils are installed.")
        print("   Run: sudo apt-get install -y alsa-utils")
    else:
        print(stdout)

    # Parse devices
    devices = []
    if stdout:
        for line in stdout.splitlines():
            m = re.search(r"card\s*(\d+):\s*([^,\[]+)(?:\[([^\]]+)\])?,\s*device\s*(\d+):", line)
            if m:
                card_idx = m.group(1)
                name = (m.group(3) or m.group(2)).strip()
                dev_idx = m.group(4)
                is_usb = any(x in name.lower() for x in ["usb", "audio", "mic", "headset"])
                devices.append({
                    "card": card_idx,
                    "dev": dev_idx,
                    "name": name,
                    "str": f"plughw:{card_idx},{dev_idx}",
                    "is_usb": is_usb
                })

    if not devices:
        print("\n❌ No ALSA audio recording devices found!")
        print("   Please check that your USB microphone is plugged securely into the Raspberry Pi.")
        return

    print(f"\nFound {len(devices)} capture device(s):")
    for d in devices:
        tag = "⭐ RECOMMENDED (USB Mic)" if d["is_usb"] else "Audio Device"
        print(f"   • {d['str']} -> {d['name']} [{tag}]")

    # 2. Pick candidate device
    preferred = [d for d in devices if d["is_usb"]]
    target = preferred[0] if preferred else devices[0]
    dev_str = target["str"]
    card_idx = target["card"]

    print(f"\n2. Testing Primary Device: {dev_str} ({target['name']})")

    # 3. Check and unmute ALSA mixer controls
    print(f"\n3. Unmuting ALSA Hardware Capture Mixer on Card {card_idx}...")
    unmute_cmds = [
        ["amixer", "-c", str(card_idx), "sset", "Capture", "cap"],
        ["amixer", "-c", str(card_idx), "sset", "Capture", "100%"],
        ["amixer", "-c", str(card_idx), "sset", "Mic", "cap"],
        ["amixer", "-c", str(card_idx), "sset", "Mic", "100%"],
        ["amixer", "sset", "Capture", "cap"],
        ["amixer", "sset", "Capture", "100%"],
    ]
    for c in unmute_cmds:
        run_cmd(c)
    print("   ✅ Mixer un-muted and capture volume set to 100%.")

    # 4. Live 3-Second Audio Test
    test_wav = "/tmp/test_mic_output.wav"
    if os.path.exists(test_wav):
        try:
            os.remove(test_wav)
        except Exception:
            pass

    print("\n" + "-" * 65)
    print("🔴 RECORDING 3 SECONDS OF AUDIO NOW...")
    print("🗣️  PLEASE SPEAK, CLAP, OR TALK NEAR THE MICROPHONE NOW!")
    print("-" * 65)

    rec_cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "alsa", "-i", dev_str,
        "-t", "3", "-ac", "1", "-ar", "48000",
        test_wav
    ]
    _, rec_err, rec_code = run_cmd(rec_cmd)

    if rec_code != 0 or not os.path.exists(test_wav):
        # Fallback to arecord
        rec_cmd2 = ["arecord", "-D", dev_str, "-d", "3", "-f", "cd", "-t", "wav", test_wav]
        _, rec_err, rec_code = run_cmd(rec_cmd2)

    if not os.path.exists(test_wav) or os.path.getsize(test_wav) < 1000:
        print(f"\n❌ Recording failed on {dev_str}: {rec_err}")
        print("   Try checking if another process has locked the microphone.")
        return

    print("✅ Recording finished! Analyzing audio levels...")

    # 5. Measure Peak and RMS
    try:
        with wave.open(test_wav, 'rb') as wf:
            frames = wf.readframes(wf.getnframes())
            data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0

        peak = float(np.max(np.abs(data)))
        rms = float(np.sqrt(np.mean(data**2)))
        rms_dbfs = 20 * np.log10(rms) if rms > 1e-7 else -100.0

        print(f"\n📊 Acoustic Analysis Results:")
        print(f"   • Peak Amplitude:  {peak:.4f} (Scale: 0.0000 silence to 1.0000 max)")
        print(f"   • RMS Volume:      {rms_dbfs:.1f} dBFS")

        if peak < 0.01 or rms_dbfs < -65.0:
            print("\n⚠️  WARNING: DIGITAL SILENCE DETECTED!")
            print("   The recorded file contains zero or near-zero sound.")
            print("   Causes & Fixes:")
            print("   1. Check if the microphone has a physical MUTE button or switch turned ON.")
            print(f"   2. Verify that {dev_str} is the real USB microphone and not HDMI or dummy.")
            print(f"   3. Open 'alsamixer' in terminal, press F6 to select Card {card_idx}, and ensure 'Capture' is not set to 00.")
        elif -45.0 <= rms_dbfs <= -10.0:
            print("\n🎉 SUCCESS! LIVE SPEECH / ROOM SOUND DETECTED LOUD AND CLEAR!")
            print(f"   Microphone is working perfectly on {dev_str}!")
        else:
            print(f"\nℹ️  Low-level ambient audio detected ({rms_dbfs:.1f} dBFS). Speak louder to verify voice capture.")

        print("\n" + "=" * 65)
        print("🔧 TO APPLY THIS MICROPHONE CONFIGURATION:")
        print(f"   Open: Live_detector/.env")
        print(f"   Add or update this line:")
        print(f"   AUDIO_INPUT_DEVICE={dev_str}")
        print("=" * 65 + "\n")

    except Exception as e:
        print(f"Error during audio analysis: {e}")

if __name__ == "__main__":
    main()
