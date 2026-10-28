'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Radio, 
  Activity,
  Bird,
  Wifi,
  X,
  Globe,
  Layers,
  Settings,
  AlertTriangle,
  Music,
  Check
} from 'lucide-react';

interface DetectionAnnotation {
  id: string | number;
  common_name: string;
  scientific_name?: string;
  confidence: number;
  timestamp: string;
  low_freq?: number;
  high_freq?: number;
  audio_url?: string;
  verification_status?: string;
}

interface RavenProLiveSpectrogramProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  streamUrl: string;
  onStreamUrlChange: (url: string) => void;
  stationName: string;
  stationIp?: string;
  detections: DetectionAnnotation[];
  onPlayDetectionClip?: (clipUrl: string) => void;
  onCloseStream?: () => void;
  onPlayLatestClip?: () => void;
  errorMessage?: string | null;
}

// Module-level persistent cache for Web Audio nodes attached to an HTMLAudioElement.
// This prevents the browser DOMException "HTMLMediaElement already connected to an AudioContext"
// when React components unmount and remount during tab switching or stream toggling.
interface BioAudioNodes {
  ctx: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
}
const audioNodesCache = new WeakMap<HTMLAudioElement, BioAudioNodes>();

// Scientific Colormaps
function getColormapPixel(val: number, scheme: 'raven-fire' | 'raven-gray' | 'viridis'): [number, number, number] {
  // val is 0.0 to 1.0 (normalized dB)
  if (scheme === 'raven-fire') {
    // Professional High-contrast Inferno / Fire colormap
    if (val < 0.15) {
      const t = val / 0.15;
      return [Math.floor(10 + t * 45), 0, Math.floor(25 + t * 45)];
    } else if (val < 0.40) {
      const t = (val - 0.15) / 0.25;
      return [Math.floor(55 + t * 140), Math.floor(t * 20), Math.floor(70 - t * 40)];
    } else if (val < 0.70) {
      const t = (val - 0.40) / 0.30;
      return [Math.floor(195 + t * 60), Math.floor(20 + t * 130), Math.floor(30 - t * 25)];
    } else {
      const t = (val - 0.70) / 0.30;
      return [255, Math.floor(150 + t * 105), Math.floor(5 + t * 180)];
    }
  } else if (scheme === 'raven-gray') {
    // Greyscale publication style (white background, dark ink traces)
    const ink = 255 - Math.floor(Math.pow(val, 0.9) * 250);
    return [ink, ink, ink];
  } else {
    // Viridis
    if (val < 0.25) {
      const t = val / 0.25;
      return [Math.floor(68 - t * 20), Math.floor(1 + t * 80), Math.floor(84 + t * 50)];
    } else if (val < 0.65) {
      const t = (val - 0.25) / 0.40;
      return [Math.floor(48 - t * 15), Math.floor(81 + t * 100), Math.floor(134 - t * 40)];
    } else {
      const t = (val - 0.65) / 0.35;
      return [Math.floor(33 + t * 220), Math.floor(181 + t * 74), Math.floor(94 - t * 60)];
    }
  }
}

export function RavenProLiveSpectrogram({
  audioElement,
  isPlaying,
  onTogglePlay,
  streamUrl,
  onStreamUrlChange,
  stationName,
  stationIp,
  detections,
  onPlayDetectionClip,
  onCloseStream,
  onPlayLatestClip,
  errorMessage
}: RavenProLiveSpectrogramProps) {
  // Visualizer Settings (Raven Controls)
  const [colorScheme, setColorScheme] = useState<'raven-fire' | 'raven-gray' | 'viridis'>('raven-fire');
  const [contrast, setContrast] = useState(1.35); // 0.5 to 2.5
  const [brightness, setBrightness] = useState(12); // dB offset (-20 to +40)
  const [maxDisplayFreq, setMaxDisplayFreq] = useState<16000 | 24000 | 12000>(16000);
  const [showAvianBand, setShowAvianBand] = useState(true);
  const [cursorReadout, setCursorReadout] = useState<{ freqHz: number; timeSec: number; db: number } | null>(null);
  const [currentLevelDb, setCurrentLevelDb] = useState(-90);
  const [isContextSuspended, setIsContextSuspended] = useState(false);
  const [showUrlEditor, setShowUrlEditor] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(streamUrl);

  // Canvas and Web Audio Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Spectrogram History Buffer
  const SPECTRUM_WIDTH = 800;
  const SPECTRUM_HEIGHT = 280;

  // 1. Initialize Web Audio API Analyser on Audio Element safely
  useEffect(() => {
    if (!audioElement || typeof window === 'undefined') return;

    let cached = audioNodesCache.get(audioElement);
    if (!cached) {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const ctx = new AudioCtxClass();
          const source = ctx.createMediaElementSource(audioElement);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048; // 1024 frequency bins
          analyser.smoothingTimeConstant = 0.15;
          analyser.minDecibels = -95;
          analyser.maxDecibels = -10;

          source.connect(analyser);
          analyser.connect(ctx.destination);

          cached = { ctx, analyser, source };
          audioNodesCache.set(audioElement, cached);
        }
      } catch (err) {
        console.warn('Web Audio source connection notice:', err);
      }
    }

    if (cached) {
      audioCtxRef.current = cached.ctx;
      analyserRef.current = cached.analyser;
      sourceNodeRef.current = cached.source;

      if (cached.ctx.state === 'suspended') {
        setIsContextSuspended(true);
      }
    }

    const handlePlay = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => {
          setIsContextSuspended(false);
        }).catch(console.warn);
      }
    };

    audioElement.addEventListener('play', handlePlay);
    return () => {
      audioElement.removeEventListener('play', handlePlay);
    };
  }, [audioElement]);

  // Direct resume handler
  const resumeAudioContext = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().then(() => {
        setIsContextSuspended(false);
      }).catch(console.warn);
    }
  }, []);

  // 2. Offscreen buffer for continuous waterfall scrolling
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const offscreen = document.createElement('canvas');
    offscreen.width = SPECTRUM_WIDTH;
    offscreen.height = SPECTRUM_HEIGHT;
    const oCtx = offscreen.getContext('2d');
    if (oCtx) {
      oCtx.fillStyle = colorScheme === 'raven-gray' ? '#ffffff' : '#050a07';
      oCtx.fillRect(0, 0, SPECTRUM_WIDTH, SPECTRUM_HEIGHT);
    }
    offscreenCanvasRef.current = offscreen;
  }, [colorScheme]);

  // 3. Render Spectrogram Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    const analyser = analyserRef.current;
    const audioCtx = audioCtxRef.current;

    if (!canvas || !offscreen) {
      animFrameIdRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    const oCtx = offscreen.getContext('2d');
    if (!ctx || !oCtx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Check context state
    if (audioCtx) {
      if (audioCtx.state === 'suspended' && !isContextSuspended) {
        setIsContextSuspended(true);
      } else if (audioCtx.state === 'running' && isContextSuspended) {
        setIsContextSuspended(false);
      }
    }

    // Shift offscreen buffer left by 2 pixels (waterfall time progression)
    if (isPlaying && analyser) {
      const bufferLength = analyser.frequencyBinCount; // 1024 bins
      const freqData = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(freqData);

      // Measure current peak audio level for VU meter
      let maxByte = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (freqData[i] > maxByte) maxByte = freqData[i];
      }
      const peakDb = -95 + (maxByte / 255) * 85;
      setCurrentLevelDb(peakDb);

      // Scroll offscreen image 2px to the left
      oCtx.drawImage(offscreen, 2, 0, width - 2, height, 0, 0, width - 2, height);

      // Generate column for the rightmost 2 pixels
      const colImgData = oCtx.createImageData(2, height);
      const pixels = colImgData.data;

      const sampleRate = audioCtx ? audioCtx.sampleRate : 48000;
      const nyquist = sampleRate / 2;
      const maxBin = Math.min(bufferLength - 1, Math.floor((maxDisplayFreq / nyquist) * bufferLength));

      for (let y = 0; y < height; y++) {
        // Vertical axis: 0 Hz at bottom (y = height), maxDisplayFreq at top (y = 0)
        const normY = 1 - (y / height);
        const binIdx = Math.min(maxBin, Math.max(0, Math.floor(normY * maxBin)));
        
        let rawByte = freqData[binIdx] || 0;
        // Apply contrast & brightness
        let normVal = (rawByte / 255.0) * contrast + (brightness / 100.0);
        normVal = Math.max(0.0, Math.min(1.0, normVal));

        const [r, g, b] = getColormapPixel(normVal, colorScheme);

        for (let xCol = 0; xCol < 2; xCol++) {
          const pIdx = (y * 2 + xCol) * 4;
          pixels[pIdx] = r;
          pixels[pIdx + 1] = g;
          pixels[pIdx + 2] = b;
          pixels[pIdx + 3] = 255;
        }
      }

      oCtx.putImageData(colImgData, width - 2, 0);
    }

    // Copy offscreen canvas to main canvas
    ctx.drawImage(offscreen, 0, 0, width, height);

    // 4. Draw Raven Pro Bioacoustic Guidelines & Overlays
    // Avian Vocal Range Highlight (1,500 Hz to 8,000 Hz)
    if (showAvianBand) {
      const yAvianTop = height * (1 - (8000 / maxDisplayFreq));
      const yAvianBottom = height * (1 - (1500 / maxDisplayFreq));

      if (yAvianTop >= 0 && yAvianBottom <= height) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
        ctx.fillRect(0, yAvianTop, width, yAvianBottom - yAvianTop);

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yAvianTop);
        ctx.lineTo(width, yAvianTop);
        ctx.moveTo(0, yAvianBottom);
        ctx.lineTo(width, yAvianBottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Frequency Gridlines & Labels (Y-Axis)
    const freqSteps = [2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 20000, 24000];
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const f of freqSteps) {
      if (f > maxDisplayFreq) continue;
      const yPos = height * (1 - (f / maxDisplayFreq));

      ctx.strokeStyle = colorScheme === 'raven-gray' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(width, yPos);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = colorScheme === 'raven-gray' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
      ctx.fillText(`${f / 1000} kHz`, 8, yPos - 6);
    }

    animFrameIdRef.current = requestAnimationFrame(renderFrame);
  }, [isPlaying, colorScheme, contrast, brightness, maxDisplayFreq, showAvianBand, isContextSuspended]);

  useEffect(() => {
    animFrameIdRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [renderFrame]);

  // Handle Mouse Move for Raven Cursor Readout (Hz, Sec, dB)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normY = 1 - (y / canvas.height);
    const freqHz = Math.round(normY * maxDisplayFreq);
    const timeSec = -((canvas.width - x) / (canvas.width / 10)); // ~10 seconds history
    const estDb = Math.round(currentLevelDb);

    setCursorReadout({ freqHz, timeSec: parseFloat(timeSec.toFixed(2)), db: estDb });
  };

  const handleMouseLeave = () => {
    setCursorReadout(null);
  };

  return (
    <div className="rounded-2xl bg-[#0a110e] text-white border border-[#1f3a2b] shadow-2xl overflow-hidden space-y-0">
      {/* 1. TOP HEADER & STREAM CONTROL BAR */}
      <div className="p-4 bg-[#0e1713] border-b border-[#1f3a2b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            isPlaying 
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse' 
              : 'bg-white/5 text-white/50 border-white/10'
          }`}>
            <Radio className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-base text-white flex items-center gap-1.5">
                Live Acoustic Waterfall Spectrogram
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                isPlaying 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' 
                  : 'bg-white/10 text-white/60 border border-white/10'
              }`}>
                {isPlaying ? '● REAL-TIME FFT' : '○ STANDBY'}
              </span>

              {/* Real-Time Acoustic VU Decibel Pill */}
              {isPlaying && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition-all ${
                  currentLevelDb > -30 
                    ? 'bg-amber-950 text-amber-300 border border-amber-600 animate-pulse' 
                    : currentLevelDb > -65 
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' 
                      : 'bg-black/60 text-white/40 border border-white/10'
                }`}>
                  {currentLevelDb > -90 ? `${Math.round(currentLevelDb)} dBFS` : 'Quiet'}
                </span>
              )}
            </div>
            <p className="text-xs text-[#a0aba3]">
              Real-time 48 kHz continuous bioacoustic monitoring on <strong className="text-white">{stationName}</strong> &bull; Multi-label Avian Species Annotations
            </p>
          </div>
        </div>

        {/* Master Play Button & Disconnect Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Master Play / Pause Button */}
          <button
            onClick={() => {
              resumeAudioContext();
              onTogglePlay();
            }}
            className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-[#0a1e16]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause Live Stream</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Start Live Stream</span>
              </>
            )}
          </button>

          {/* Turn Off / Disconnect Stream */}
          {onCloseStream && (
            <button
              onClick={onCloseStream}
              className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Turn off live stream and disconnect audio"
            >
              <X className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STREAM DIAGNOSTICS & SOURCE CONFIGURATION BANNER */}
      <div className="px-4 py-2 bg-[#08110c] border-b border-[#1f3a2b] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-[#a0aba3]">
          <span className="flex items-center gap-1.5 text-white/80">
            <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <strong>Socket Source:</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10 text-emerald-300 font-mono text-[10px] truncate max-w-xs sm:max-w-md">
            {streamUrl}
          </span>
          <button
            onClick={() => setShowUrlEditor(!showUrlEditor)}
            className="p-1 text-white/60 hover:text-emerald-300 rounded hover:bg-white/10 transition cursor-pointer"
            title="Configure edge stream target URL"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Action: Stream Latest Uploaded Field Audio */}
        {onPlayLatestClip && (
          <button
            onClick={() => {
              resumeAudioContext();
              onPlayLatestClip();
            }}
            className="px-3 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="Stream and visualize the most recent verified bioacoustic detection recorded by this node"
          >
            <Music className="w-3 h-3 text-emerald-400" />
            <span>Stream Latest Recorded Field Call</span>
          </button>
        )}
      </div>

      {/* Optional Stream Target URL Editor Drawer */}
      {showUrlEditor && (
        <div className="p-3 bg-[#0c1a12] border-b border-emerald-500/30 flex flex-col sm:flex-row items-center gap-3 text-xs">
          <label className="text-[11px] font-mono text-emerald-200 shrink-0">
            Custom Stream / Tunnel URL:
          </label>
          <input
            type="text"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="http://<pi_ip>:8888/stream.opus or https://...trycloudflare.com/stream.opus"
            className="flex-1 w-full bg-black/60 border border-emerald-500/40 rounded-lg px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-400"
          />
          <button
            onClick={() => {
              onStreamUrlChange(customUrlInput.trim());
              setShowUrlEditor(false);
            }}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply URL</span>
          </button>
        </div>
      )}

      {/* Connection Notice / Error Alert */}
      {errorMessage && (
        <div className="p-3 bg-amber-950/70 border-b border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{errorMessage}</p>
            <p className="text-[11px] text-amber-200/80">
              Note: Continuous port 8888 live streaming requires your browser to be on the same local network as the Raspberry Pi, or routed through a Cloudflare Tunnel. To hear verified audio immediately, click <strong>Stream Latest Recorded Field Call</strong> above or click <strong>Play Clip</strong> on any detection card below.
            </p>
          </div>
        </div>
      )}
      <div className="px-4 py-2.5 bg-[#0e1713] border-b border-[#1f3a2b] flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Colormap Selectors */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#a0aba3] uppercase tracking-wider font-semibold">Colormap:</span>
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[11px]">
            <button
              onClick={() => setColorScheme('raven-fire')}
              className={`px-2.5 py-1 rounded cursor-pointer transition ${
                colorScheme === 'raven-fire' ? 'bg-amber-600 text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              Inferno (Fire)
            </button>
            <button
              onClick={() => setColorScheme('viridis')}
              className={`px-2.5 py-1 rounded cursor-pointer transition ${
                colorScheme === 'viridis' ? 'bg-emerald-600 text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              Viridis
            </button>
            <button
              onClick={() => setColorScheme('raven-gray')}
              className={`px-2.5 py-1 rounded cursor-pointer transition ${
                colorScheme === 'raven-gray' ? 'bg-gray-300 text-black font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              Greyscale (Paper)
            </button>
          </div>
        </div>

        {/* Contrast & Brightness Sliders */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] text-[#a0aba3]">
            <span>Contrast:</span>
            <input
              type="range"
              min="0.8"
              max="2.5"
              step="0.05"
              value={contrast}
              onChange={(e) => setContrast(parseFloat(e.target.value))}
              className="w-16 accent-emerald-400 h-1 cursor-pointer"
            />
            <span className="font-mono text-white text-[10px] w-6">{contrast.toFixed(1)}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#a0aba3]">
            <span>Brightness:</span>
            <input
              type="range"
              min="-20"
              max="40"
              step="5"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              className="w-16 accent-amber-400 h-1 cursor-pointer"
            />
            <span className="font-mono text-white text-[10px] w-6">{brightness > 0 ? `+${brightness}` : brightness}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#a0aba3]">
            <span>Max Freq:</span>
            <select
              value={maxDisplayFreq}
              onChange={(e) => setMaxDisplayFreq(parseInt(e.target.value) as any)}
              className="bg-black/60 border border-white/20 rounded px-2 py-0.5 text-[11px] text-white font-mono outline-none"
            >
              <option value="12000">12 kHz (Bird Core)</option>
              <option value="16000">16 kHz (Standard)</option>
              <option value="24000">24 kHz (Full Spectrum)</option>
            </select>
          </div>
        </div>

        {/* Toggle Overlays */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-[#a0aba3] cursor-pointer">
            <input
              type="checkbox"
              checked={showAvianBand}
              onChange={(e) => setShowAvianBand(e.target.checked)}
              className="accent-emerald-400 rounded"
            />
            <span>Avian Band (1.5-8 kHz)</span>
          </label>
        </div>
      </div>

      {/* 4. MAIN SPECTROGRAM CANVAS STAGE (RAVEN WATERFALL) */}
      <div 
        className="relative bg-[#050a07] select-none"
        onClick={resumeAudioContext}
      >
        <canvas
          ref={canvasRef}
          width={SPECTRUM_WIDTH}
          height={SPECTRUM_HEIGHT}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-[280px] block cursor-crosshair"
        />

        {/* AudioContext Autoplay Suspension Alert Overlay */}
        {isContextSuspended && isPlaying && (
          <div 
            onClick={resumeAudioContext}
            className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer backdrop-blur-[2px] transition-all z-10"
          >
            <div className="bg-emerald-950/95 border border-emerald-500/60 rounded-xl px-5 py-3 text-xs font-mono text-emerald-200 flex items-center gap-3 shadow-2xl hover:bg-emerald-900/90 hover:scale-105 transition-all">
              <Volume2 className="w-5 h-5 text-emerald-400 animate-bounce" />
              <span>Audio analysis waiting for user gesture &bull; <strong>Click anywhere to activate live spectrogram</strong></span>
            </div>
          </div>
        )}

        {/* Time Axis Legend along bottom */}
        <div className="absolute bottom-1 left-0 right-0 px-3 flex justify-between text-[9px] font-mono text-white/50 pointer-events-none bg-gradient-to-t from-black/80 to-transparent py-1">
          <span>-10.0s</span>
          <span>-8.0s</span>
          <span>-6.0s</span>
          <span>-4.0s</span>
          <span>-2.0s</span>
          <span className="text-emerald-400 font-bold">● LIVE CURRENT</span>
        </div>

        {/* Real-Time Cursor Readout Pill (Raven Style) */}
        {cursorReadout && (
          <div className="absolute top-2 right-3 pointer-events-none bg-black/80 border border-white/20 rounded-lg px-2.5 py-1 text-[11px] font-mono flex items-center gap-3 shadow-lg">
            <div>
              <span className="text-[#a0aba3]">Freq: </span>
              <strong className="text-emerald-400">{cursorReadout.freqHz} Hz</strong>
            </div>
            <div>
              <span className="text-[#a0aba3]">Time: </span>
              <strong className="text-cyan-400">{cursorReadout.timeSec} s</strong>
            </div>
            <div>
              <span className="text-[#a0aba3]">Level: </span>
              <strong className="text-amber-400">{cursorReadout.db} dB</strong>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
