"""
BirdSong Observatory - On-Demand Live Audio Stream Server
=========================================================
Lightweight HTTP chunked Opus audio streaming server.
Enables real-time listening directly through web browser without Icecast setup.
Automatically shuts down encoding when no web listeners are connected to conserve solar power!
"""

import os
import re
import shutil
import time
import socket
import logging
import threading
import subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import queue
import numpy as np

from config import (
    STREAM_PORT, SAMPLE_RATE, DATA_DIR,
    PUBLIC_STREAM_URL, AUTO_CLOUDFLARE_TUNNEL
)

logger = logging.getLogger("LiveAudioStreamer")

class StreamHandler(BaseHTTPRequestHandler):
    capture_worker = None
    active_listeners: int = 0
    listener_lock = threading.Lock()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        if self.path not in ["/live", "/stream.opus", "/stream"]:
            self.send_response(404)
            self.end_headers()
            return

        with StreamHandler.listener_lock:
            StreamHandler.active_listeners += 1
            logger.info(f"🎧 New live audio listener connected! (Total active: {StreamHandler.active_listeners})")

        self.send_response(200)
        self.send_header("Content-Type", "audio/ogg; codecs=opus")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "close")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

        ffmpeg_proc = None
        audio_queue = queue.Queue(maxsize=30)
        if StreamHandler.capture_worker:
            StreamHandler.capture_worker.add_stream_listener(audio_queue)

        try:
            # Spawn FFmpeg encoder streaming to HTTP response socket
            # -application lowdelay + -frame_duration 20 + -flush_packets 1 guarantee zero buffering
            cmd = [
                "ffmpeg",
                "-loglevel", "error",
                "-f", "f32le",
                "-ar", str(SAMPLE_RATE),
                "-ac", "1",
                "-i", "pipe:0",
                "-c:a", "libopus",
                "-b:a", "64k",
                "-vbr", "on",
                "-application", "lowdelay",
                "-frame_duration", "20",
                "-flush_packets", "1",
                "-f", "ogg",
                "pipe:1"
            ]

            ffmpeg_proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                bufsize=0
            )

            # Thread to pipe linear capture audio directly into FFmpeg stdin
            streaming = True
            def pipe_audio():
                while streaming and ffmpeg_proc.poll() is None:
                    try:
                        raw_bytes = audio_queue.get(timeout=0.5)
                        ffmpeg_proc.stdin.write(raw_bytes)
                        ffmpeg_proc.stdin.flush()
                    except queue.Empty:
                        continue
                    except Exception:
                        break

            pipe_thread = threading.Thread(target=pipe_audio, daemon=True)
            pipe_thread.start()

            # Read Opus chunks from FFmpeg and stream out over HTTP immediately
            import os
            while True:
                chunk = os.read(ffmpeg_proc.stdout.fileno(), 4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()

        except (BrokenPipeError, ConnectionResetError):
            logger.info("Listener disconnected.")
        except Exception as e:
            logger.debug(f"Streaming notice: {e}")
        finally:
            streaming = False
            if StreamHandler.capture_worker:
                StreamHandler.capture_worker.remove_stream_listener(audio_queue)
            if ffmpeg_proc:
                try:
                    ffmpeg_proc.terminate()
                except Exception:
                    pass
            with StreamHandler.listener_lock:
                StreamHandler.active_listeners = max(0, StreamHandler.active_listeners - 1)
                logger.info(f"Listener disconnected. (Remaining: {StreamHandler.active_listeners})")

    def log_message(self, format, *args):
        # Suppress standard HTTP request logging to keep console clean
        return

class LiveAudioStreamServer(threading.Thread):
    def __init__(self, capture_worker=None, port: int = STREAM_PORT):
        super().__init__(daemon=True, name="LiveAudioStreamServer")
        self.capture_worker = capture_worker
        self.port = port
        self.server = None
        self.tunnel_process = None
        self.public_stream_url = None

    def start_cloudflare_tunnel(self):
        """Spawns Cloudflare Tunnel or detects configured URL to auto-link stream target."""
        # Check if statically configured in environment
        if PUBLIC_STREAM_URL:
            self.public_stream_url = PUBLIC_STREAM_URL
            self._save_stream_url(self.public_stream_url)
            logger.info(f"🌐 [AutoTunnel] Configured stream target: {self.public_stream_url}")
            return

        cloudflared_bin = shutil.which("cloudflared")
        if not cloudflared_bin:
            logger.info("ℹ️ cloudflared binary not found on PATH. Remote auto-tunnel skipped.")
            return

        try:
            logger.info(f"🚀 Spawning Cloudflare Tunnel for port {self.port}...")
            cmd = [cloudflared_bin, "tunnel", "--url", f"http://localhost:{self.port}"]
            self.tunnel_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )

            url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

            def parse_tunnel_output():
                while self.tunnel_process and self.tunnel_process.poll() is None:
                    line = self.tunnel_process.stderr.readline()
                    if not line:
                        break
                    match = url_pattern.search(line)
                    if match and not self.public_stream_url:
                        base_url = match.group(0)
                        self.public_stream_url = f"{base_url}/stream.opus"
                        self._save_stream_url(self.public_stream_url)
                        logger.info("=" * 65)
                        logger.info("✨ CLOUDFLARE PUBLIC LIVE STREAM TUNNEL CONNECTED!")
                        logger.info(f"🔗 Stream Target: {self.public_stream_url}")
                        logger.info("📡 Automatically linking to your BirdSong Observatory Dashboard...")
                        logger.info("=" * 65)

            t = threading.Thread(target=parse_tunnel_output, daemon=True)
            t.start()
        except Exception as e:
            logger.warning(f"Could not spawn cloudflared tunnel: {e}")

    def _save_stream_url(self, url: str):
        try:
            (DATA_DIR / "stream_url.txt").write_text(url.strip())
        except Exception:
            pass

    def run(self):
        StreamHandler.capture_worker = self.capture_worker
        if AUTO_CLOUDFLARE_TUNNEL:
            self.start_cloudflare_tunnel()
        try:
            self.server = ThreadingHTTPServer(("0.0.0.0", self.port), StreamHandler)
            logger.info(f"📻 Live Audio HTTP Streamer listening on port {self.port} (Local: http://<pi_ip>:{self.port}/stream.opus)")
            self.server.serve_forever()
        except Exception as e:
            logger.warning(f"Could not bind streaming port {self.port}: {e}")

    def stop(self):
        if self.tunnel_process:
            try:
                self.tunnel_process.terminate()
            except Exception:
                pass
        if self.server:
            self.server.shutdown()
