"""
BirdSong Observatory - On-Demand Live Audio Stream Server
=========================================================
Lightweight HTTP chunked Opus audio streaming server.
Enables real-time listening directly through web browser without Icecast setup.
Automatically shuts down encoding when no web listeners are connected to conserve solar power!
"""

import time
import socket
import logging
import threading
import subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import queue
import numpy as np

from config import STREAM_PORT, SAMPLE_RATE

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

    def run(self):
        StreamHandler.capture_worker = self.capture_worker
        try:
            self.server = ThreadingHTTPServer(("0.0.0.0", self.port), StreamHandler)
            logger.info(f"📻 Live Audio HTTP Streamer listening on port {self.port} (URL: http://<pi_ip>:{self.port}/stream.opus)")
            logger.info(f"🌐 Remote listening tip: To listen outside local Wi-Fi, run: cloudflared tunnel --url http://localhost:{self.port}")
            self.server.serve_forever()
        except Exception as e:
            logger.warning(f"Could not bind streaming port {self.port}: {e}")

    def stop(self):
        if self.server:
            self.server.shutdown()
