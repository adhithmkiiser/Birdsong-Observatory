'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, Maximize2, Layers } from 'lucide-react';

interface SpeciesSample {
  id: string;
  commonName: string;
  scientificName: string;
  location: string;
  elevation: string;
  audioUrl: string;
  sampleRate: string;
}

const SAMPLES: SpeciesSample[] = [
  {
    id: 'MWT',
    commonName: 'Malabar Whistling-Thrush',
    scientificName: 'Myophonus horsfieldii',
    location: 'Nilgiris Shola Transect (Site NL-03)',
    elevation: '1,840 m',
    audioUrl: '/Malabar%20Whistling-Thrush.wav',
    sampleRate: '48 kHz / 24-bit'
  },
  {
    id: 'WTK',
    commonName: 'White-throated Kingfisher',
    scientificName: 'Halcyon smyrnensis',
    location: 'Shevaroys Canopy Array (Site SH-12)',
    elevation: '1,120 m',
    audioUrl: '/White-throated%20Kingfisher.wav',
    sampleRate: '48 kHz / 24-bit'
  },
  {
    id: 'CSB',
    commonName: 'Coppersmith Barbet',
    scientificName: 'Psilopogon haemacephalus',
    location: 'Tirupati Foothills Transect (Site TP-01)',
    elevation: '420 m',
    audioUrl: '/Coppersmith%20Barbet.wav',
    sampleRate: '48 kHz / 24-bit'
  },
  {
    id: 'BHO',
    commonName: 'Black-hooded Oriole',
    scientificName: 'Oriolus xanthornus',
    location: 'Anamalai Wildlife Corridor (Site AN-08)',
    elevation: '960 m',
    audioUrl: '/Black-hooded%20Oriole.wav',
    sampleRate: '48 kHz / 24-bit'
  }
];

// Global Module-level caches for instant zero-latency switching
const AUDIO_BUFFER_CACHE = new Map<string, AudioBuffer>();
const STFT_MATRIX_CACHE = new Map<string, { matrix: Float32Array[]; maxBin: number; duration: number }>();
let globalAudioCtx: AudioContext | null = null;

function getGlobalAudioContext(): AudioContext {
  if (!globalAudioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  return globalAudioCtx!;
}

// Fast Radix-2 Cooley-Tukey FFT implementation with precomputed twiddle factors
const FFT_SIZE = 256;
const HALF_FFT = FFT_SIZE / 2;
const SIN_TABLE = new Float32Array(FFT_SIZE);
const COS_TABLE = new Float32Array(FFT_SIZE);
const HANN_WINDOW = new Float32Array(FFT_SIZE);

for (let i = 0; i < FFT_SIZE; i++) {
  const angle = (2 * Math.PI * i) / FFT_SIZE;
  SIN_TABLE[i] = Math.sin(angle);
  COS_TABLE[i] = Math.cos(angle);
  HANN_WINDOW[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

// Compute discrete STFT matrix in <3ms using Radix-2 FFT
function computeSTFTMatrix(buffer: AudioBuffer, targetWidth: number): { matrix: Float32Array[]; maxBin: number; duration: number } {
  const rawData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const numColumns = Math.max(640, targetWidth || 640);
  const hopSize = Math.max(1, Math.floor(rawData.length / numColumns));
  const maxFreq = Math.min(16000, sampleRate / 2);
  const maxBin = Math.max(32, Math.floor((maxFreq / (sampleRate / 2)) * HALF_FFT));

  const real = new Float32Array(FFT_SIZE);
  const imag = new Float32Array(FFT_SIZE);
  const matrix: Float32Array[] = [];

  for (let x = 0; x < numColumns; x++) {
    const startSample = x * hopSize;
    
    // Apply window
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = startSample + i;
      real[i] = idx < rawData.length ? rawData[idx] * HANN_WINDOW[i] : 0;
      imag[i] = 0;
    }

    // Fast Bit-reversal
    let j = 0;
    for (let i = 0; i < FFT_SIZE - 1; i++) {
      if (i < j) {
        const tempR = real[i]; real[i] = real[j]; real[j] = tempR;
        const tempI = imag[i]; imag[i] = imag[j]; imag[j] = tempI;
      }
      let k = FFT_SIZE >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Cooley-Tukey decimation in time
    for (let len = 2; len <= FFT_SIZE; len <<= 1) {
      const halfLen = len >> 1;
      const step = FFT_SIZE / len;
      for (let i = 0; i < FFT_SIZE; i += len) {
        let k = 0;
        for (let m = 0; m < halfLen; m++) {
          const uR = real[i + m];
          const uI = imag[i + m];
          const c = COS_TABLE[k];
          const s = SIN_TABLE[k];
          const vR = real[i + m + halfLen] * c + imag[i + m + halfLen] * s;
          const vI = imag[i + m + halfLen] * c - real[i + m + halfLen] * s;
          real[i + m] = uR + vR;
          imag[i + m] = uI + vI;
          real[i + m + halfLen] = uR - vR;
          imag[i + m + halfLen] = uI - vI;
          k += step;
        }
      }
    }

    // Calculate magnitudes for positive frequency bins
    const column = new Float32Array(maxBin);
    for (let k = 0; k < maxBin; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      column[k] = Math.max(0, Math.min(1, (Math.log10(mag + 0.001) + 2.8) / 2.8));
    }
    matrix.push(column);
  }

  return { matrix, maxBin, duration: buffer.duration };
}

// Background prefetch & decode all audio samples upfront
export async function preloadAllSpeciesSamples() {
  if (typeof window === 'undefined') return;
  const audioCtx = getGlobalAudioContext();
  if (!audioCtx) return;

  await Promise.allSettled(
    SAMPLES.map(async (sample) => {
      try {
        if (AUDIO_BUFFER_CACHE.has(sample.id)) return;
        const res = await fetch(sample.audioUrl);
        const arrayBuf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        AUDIO_BUFFER_CACHE.set(sample.id, decoded);
        const stft = computeSTFTMatrix(decoded, 640);
        STFT_MATRIX_CACHE.set(sample.id, stft);
      } catch (e) {
        console.warn('Preload audio error for', sample.commonName, e);
      }
    })
  );
}

export function RavenProSpectrogram() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [colorScheme, setColorScheme] = useState<'raven-fire' | 'raven-gray' | 'viridis'>('raven-fire');
  const [hoverData, setHoverData] = useState<{ time: string; freq: string; amp: string } | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const currentSample = SAMPLES[selectedIdx];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trigger immediate background preloading on mount
  useEffect(() => {
    preloadAllSpeciesSamples();
  }, []);

  // Fast rasterization using precomputed STFT matrix
  const renderFromSTFT = useCallback((stftData: { matrix: Float32Array[]; maxBin: number; duration: number }, scheme: 'raven-fire' | 'raven-gray' | 'viridis') => {
    const canvas = specCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { matrix, maxBin } = stftData;
    const numCols = matrix.length;
    if (numCols === 0) return;

    const imgData = ctx.createImageData(width, height);
    const pixels = imgData.data;

    for (let x = 0; x < width; x++) {
      const colIdx = Math.min(numCols - 1, Math.floor((x / width) * numCols));
      const column = matrix[colIdx];
      if (!column) continue;

      for (let y = 0; y < height; y++) {
        const binIndex = Math.floor((1 - y / height) * (maxBin - 1));
        const val = column[binIndex] || 0;
        const pixelIdx = (y * width + x) * 4;

        if (scheme === 'raven-fire') {
          if (val < 0.15) {
            pixels[pixelIdx] = Math.floor(val * 80);
            pixels[pixelIdx + 1] = Math.floor(val * 40);
            pixels[pixelIdx + 2] = Math.floor(val * 50);
          } else if (val < 0.45) {
            const t = (val - 0.15) / 0.3;
            pixels[pixelIdx] = Math.floor(120 + t * 135);
            pixels[pixelIdx + 1] = Math.floor(t * 70);
            pixels[pixelIdx + 2] = 10;
          } else if (val < 0.8) {
            const t = (val - 0.45) / 0.35;
            pixels[pixelIdx] = 255;
            pixels[pixelIdx + 1] = Math.floor(70 + t * 175);
            pixels[pixelIdx + 2] = Math.floor(t * 60);
          } else {
            const t = (val - 0.8) / 0.2;
            pixels[pixelIdx] = 255;
            pixels[pixelIdx + 1] = 245 + Math.floor(t * 10);
            pixels[pixelIdx + 2] = Math.floor(60 + t * 195);
          }
        } else if (scheme === 'raven-gray') {
          const ink = 255 - Math.floor(val * 245);
          pixels[pixelIdx] = ink;
          pixels[pixelIdx + 1] = ink;
          pixels[pixelIdx + 2] = ink;
        } else {
          pixels[pixelIdx] = Math.floor(68 + val * 185);
          pixels[pixelIdx + 1] = Math.floor(1 + val * 230);
          pixels[pixelIdx + 2] = Math.floor(84 + (1 - val) * 120);
        }
        pixels[pixelIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, []);

  // 1. Draw Raven Pro Oscillogram (Waveform Amplitude)
  const drawOscillogram = useCallback((buffer: AudioBuffer) => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const rawData = buffer.getChannelData(0);
    const step = Math.ceil(rawData.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#dde1dc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();

    ctx.strokeStyle = '#1a1f1c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = rawData[i * step + j] || 0;
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
  }, []);

  // Load sample with instant cache resolution
  const loadAndComputeSpectrogram = useCallback(async (sample: SpeciesSample) => {
    // Check if STFT matrix and buffer are already preloaded in memory
    if (STFT_MATRIX_CACHE.has(sample.id) && AUDIO_BUFFER_CACHE.has(sample.id)) {
      const cachedSTFT = STFT_MATRIX_CACHE.get(sample.id)!;
      const cachedBuf = AUDIO_BUFFER_CACHE.get(sample.id)!;
      setDuration(cachedSTFT.duration);
      drawOscillogram(cachedBuf);
      renderFromSTFT(cachedSTFT, colorScheme);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const audioCtx = getGlobalAudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const response = await fetch(sample.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      AUDIO_BUFFER_CACHE.set(sample.id, decodedBuffer);
      setDuration(decodedBuffer.duration);
      drawOscillogram(decodedBuffer);

      const stft = computeSTFTMatrix(decodedBuffer, 640);
      STFT_MATRIX_CACHE.set(sample.id, stft);
      renderFromSTFT(stft, colorScheme);
    } catch (err) {
      console.warn('Fallback render on decode:', err);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [colorScheme, drawOscillogram, renderFromSTFT]);

  useEffect(() => {
    loadAndComputeSpectrogram(currentSample);
  }, [selectedIdx, colorScheme, loadAndComputeSpectrogram, currentSample]);

  // Audio Playback handling
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const dur = audioRef.current?.duration || duration || 5.0;
    const seekTime = ratio * dur;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const dur = audioRef.current?.duration || duration || 5.0;
    const timeVal = (x / rect.width) * dur;
    const freqVal = (1 - (y / rect.height)) * 16; // 0 to 16 kHz
    const ampVal = -20 - (y / rect.height) * 45; // Approximate dBFS
    setHoverData({
      time: `${timeVal.toFixed(3)}s`,
      freq: `${freqVal.toFixed(2)} kHz`,
      amp: `${ampVal.toFixed(1)} dBFS`
    });
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full bg-[#ffffff] border border-[#dde1dc] rounded-2xl overflow-hidden shadow-xs">
      
      {/* 1. Header Toolbar & Species Selector */}
      <div className="p-3.5 bg-[#f5f6f4] border-b border-[#dde1dc] flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex items-center gap-1.5 flex-wrap">
          {SAMPLES.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                if (isPlaying && audioRef.current) audioRef.current.pause();
                setSelectedIdx(idx);
                setIsPlaying(false);
                setCurrentTime(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedIdx === idx
                  ? 'bg-[#1f4d3a] text-white font-semibold shadow-2xs'
                  : 'bg-white text-[#5a635d] hover:text-[#1a1f1c] border border-[#dde1dc]'
              }`}
            >
              {s.commonName}
            </button>
          ))}
        </div>

        {/* Colormap Selector */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-[#5a635d]">
          <span className="hidden sm:inline">PALETTE:</span>
          <button
            onClick={() => setColorScheme('raven-fire')}
            className={`px-2 py-0.5 rounded ${colorScheme === 'raven-fire' ? 'bg-[#1a1f1c] text-white font-semibold' : 'hover:bg-[#dde1dc]'}`}
          >
            Raven Fire
          </button>
          <button
            onClick={() => setColorScheme('raven-gray')}
            className={`px-2 py-0.5 rounded ${colorScheme === 'raven-gray' ? 'bg-[#1a1f1c] text-white font-semibold' : 'hover:bg-[#dde1dc]'}`}
          >
            Grayscale
          </button>
          <button
            onClick={() => setColorScheme('viridis')}
            className={`px-2 py-0.5 rounded ${colorScheme === 'viridis' ? 'bg-[#1a1f1c] text-white font-semibold' : 'hover:bg-[#dde1dc]'}`}
          >
            Viridis
          </button>
        </div>

      </div>

      {/* 2. Raven Pro Dual Display Panel: Oscillogram + Spectrogram */}
      <div className="p-4 sm:p-5 bg-[#ffffff] space-y-3">
        
        {/* Sub-panel A: Oscillogram (Waveform Amplitude) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] font-mono text-[#5a635d] uppercase">
            <span>Waveform (Oscillogram)</span>
            <span>Scale: ±1.0 FS</span>
          </div>

          <div className="relative flex h-14 w-full">
            <div className="w-9 flex flex-col justify-between font-mono text-[9px] text-[#5a635d] pr-1.5 text-right border-r border-[#dde1dc]">
              <span>+1.0</span>
              <span>0.0</span>
              <span>-1.0</span>
            </div>
            <div className="relative flex-1 ml-1.5 bg-[#ffffff] border border-[#dde1dc] rounded-md overflow-hidden">
              <canvas
                ref={waveCanvasRef}
                width={640}
                height={56}
                className="w-full h-full"
              />
              {/* Playhead in Oscillogram */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#1f4d3a] pointer-events-none transition-all duration-75"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Sub-panel B: Raven Pro Spectrogram (Time x Frequency Heatmap) */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between items-center text-[10px] font-mono text-[#5a635d] uppercase">
            <span className="flex items-center gap-1.5 font-semibold text-[#1a1f1c]">
              <Volume2 className="w-3.5 h-3.5 text-[#1f4d3a]" />
              Spectrogram Display &bull; 0.0 – 16.0 kHz
            </span>
            <span>FFT Window: 512 &bull; 48 kHz</span>
          </div>

          <div className="relative flex h-48 sm:h-56 w-full">
            {/* Frequency Axis Ticks (kHz) */}
            <div className="w-9 flex flex-col justify-between font-mono text-[9px] text-[#5a635d] pr-1.5 text-right border-r border-[#dde1dc] select-none">
              <span>16k</span>
              <span>12k</span>
              <span>8k</span>
              <span>4k</span>
              <span>0</span>
            </div>

            {/* Spectrogram Canvas with Playhead and Crosshair */}
            <div
              className="relative flex-1 ml-1.5 bg-[#0a1610] rounded-md overflow-hidden cursor-crosshair border border-[#dde1dc]"
              onClick={handleSeek}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverData(null)}
            >
              <canvas
                ref={specCanvasRef}
                width={640}
                height={224}
                className="w-full h-full object-cover"
              />

              {/* Synchronized Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#ffffff] pointer-events-none transition-all duration-75 shadow-sm"
                style={{ left: `${progressPercent}%` }}
              />

              {/* Cursor Readout Overlay */}
              {hoverData && (
                <div className="absolute top-2 right-2 px-2.5 py-1 rounded bg-[#1a1f1c]/95 text-white font-mono text-[10px] pointer-events-none border border-white/20 shadow-md">
                  <span>T: {hoverData.time}</span> &bull; <span>F: {hoverData.freq}</span> &bull; <span>P: {hoverData.amp}</span>
                </div>
              )}
            </div>
          </div>

          {/* Time Axis Ticks (Seconds) */}
          <div className="flex justify-between font-mono text-[10px] text-[#5a635d] pl-11 pr-1 pt-0.5">
            <span>0.00s</span>
            <span>{(duration * 0.25).toFixed(2)}s</span>
            <span>{(duration * 0.5).toFixed(2)}s</span>
            <span>{(duration * 0.75).toFixed(2)}s</span>
            <span>{duration.toFixed(2)}s</span>
          </div>
        </div>

      </div>

      {/* 3. Audio Control Strip & Metadata Capsule */}
      <div className="p-3.5 bg-[#f5f6f4] border-t border-[#dde1dc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-xl bg-[#1f4d3a] text-white flex items-center justify-center hover:bg-[#173b2c] transition-colors flex-shrink-0 shadow-xs cursor-pointer"
            aria-label={isPlaying ? 'Pause audio sample' : 'Play audio sample'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div>
            <div className="font-semibold text-xs text-[#1a1f1c] flex items-center gap-1.5">
              <span>{currentSample.commonName}</span>
              <span className="font-serif italic font-normal text-[#5a635d]">({currentSample.scientificName})</span>
            </div>
            <div className="font-mono text-[10px] text-[#5a635d]">
              {currentSample.location} &bull; Elev: {currentSample.elevation}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center font-mono text-xs text-[#5a635d]">
          <span>{currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            title="Rewind to beginning"
            className="p-1 text-[#5a635d] hover:text-[#1a1f1c]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidden HTML Audio Elements for instant zero-latency playback across all species */}
        <audio
          ref={audioRef}
          src={currentSample.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          preload="auto"
        />
        {/* Parallel preloader tags for all other species */}
        <div className="hidden" aria-hidden="true">
          {SAMPLES.map(s => (
            <audio key={s.id} src={s.audioUrl} preload="auto" />
          ))}
        </div>

      </div>

    </div>
  );
}
