'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, Info } from 'lucide-react';

interface SpeciesSample {
  id: string;
  commonName: string;
  scientificName: string;
  site: string;
  elevation: string;
  audioUrl: string;
  duration: number;
  freqRange: string;
  harmonics: { t: number; f: number; dur: number; amp: number }[];
}

const SAMPLES: SpeciesSample[] = [
  {
    id: 'MWT',
    commonName: 'Malabar Whistling-Thrush',
    scientificName: 'Myophonus horsfieldii',
    site: 'Station NG-03 &bull; Nilgiris Transect',
    elevation: '1,840m',
    audioUrl: '/Malabar%20Whistling-Thrush.wav',
    duration: 5.0,
    freqRange: '1.8 kHz – 7.2 kHz',
    harmonics: [
      { t: 0.4, f: 3.2, dur: 0.6, amp: 0.9 },
      { t: 1.2, f: 4.8, dur: 0.8, amp: 1.0 },
      { t: 2.2, f: 3.6, dur: 0.5, amp: 0.85 },
      { t: 3.0, f: 5.4, dur: 0.9, amp: 0.95 },
      { t: 4.1, f: 4.2, dur: 0.7, amp: 0.88 },
    ]
  },
  {
    id: 'WTK',
    commonName: 'White-throated Kingfisher',
    scientificName: 'Halcyon smyrnensis',
    site: 'Station SH-12 &bull; Shevaroys Transect',
    elevation: '1,120m',
    audioUrl: '/White-throated%20Kingfisher.wav',
    duration: 4.2,
    freqRange: '2.4 kHz – 9.6 kHz',
    harmonics: [
      { t: 0.3, f: 4.2, dur: 0.4, amp: 0.9 },
      { t: 0.9, f: 5.1, dur: 0.5, amp: 0.95 },
      { t: 1.6, f: 5.8, dur: 0.6, amp: 1.0 },
      { t: 2.4, f: 4.9, dur: 0.5, amp: 0.92 },
      { t: 3.2, f: 3.8, dur: 0.6, amp: 0.85 },
    ]
  },
  {
    id: 'CSB',
    commonName: 'Coppersmith Barbet',
    scientificName: 'Psilopogon haemacephalus',
    site: 'Station TP-01 &bull; Tirupati Foothills',
    elevation: '420m',
    audioUrl: '/Coppersmith%20Barbet.wav',
    duration: 4.8,
    freqRange: '0.9 kHz – 2.8 kHz',
    harmonics: [
      { t: 0.2, f: 1.4, dur: 0.25, amp: 0.95 },
      { t: 0.8, f: 1.4, dur: 0.25, amp: 0.95 },
      { t: 1.4, f: 1.4, dur: 0.25, amp: 1.0 },
      { t: 2.0, f: 1.4, dur: 0.25, amp: 0.98 },
      { t: 2.6, f: 1.4, dur: 0.25, amp: 0.95 },
      { t: 3.2, f: 1.4, dur: 0.25, amp: 0.92 },
      { t: 3.8, f: 1.4, dur: 0.25, amp: 0.95 },
    ]
  },
  {
    id: 'BHO',
    commonName: 'Black-hooded Oriole',
    scientificName: 'Oriolus xanthornus',
    site: 'Station AN-08 &bull; Anamalai Corridors',
    elevation: '960m',
    audioUrl: '/Black-hooded%20Oriole.wav',
    duration: 4.5,
    freqRange: '1.2 kHz – 4.5 kHz',
    harmonics: [
      { t: 0.5, f: 2.4, dur: 0.7, amp: 0.92 },
      { t: 1.5, f: 3.1, dur: 0.8, amp: 1.0 },
      { t: 2.6, f: 2.8, dur: 0.6, amp: 0.88 },
      { t: 3.5, f: 2.2, dur: 0.7, amp: 0.85 },
    ]
  }
];

export function InteractiveBioacousticPlayer() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverCoord, setHoverCoord] = useState<{ time: string; freq: string } | null>(null);

  const currentSample = SAMPLES[selectedIdx];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Switch sample
  const handleSelectSample = (idx: number) => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
    setSelectedIdx(idx);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
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
    const dur = audioRef.current?.duration || currentSample.duration;
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
    const dur = audioRef.current?.duration || currentSample.duration;
    const timeVal = (x / rect.width) * dur;
    const freqVal = (1 - (y / rect.height)) * 12; // 0 to 12 kHz
    setHoverCoord({
      time: `${timeVal.toFixed(2)}s`,
      freq: `${freqVal.toFixed(1)} kHz`
    });
  };

  const handleMouseLeave = () => {
    setHoverCoord(null);
  };

  // Draw scientific viridis/inferno spectrogram canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Fill background with dark forest obsidian
    ctx.fillStyle = '#0a1610';
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient background noise grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let f = 0; f < height; f += height / 6) {
      ctx.beginPath();
      ctx.moveTo(0, f);
      ctx.lineTo(width, f);
      ctx.stroke();
    }

    // 3. Draw authentic bioacoustic harmonic signatures
    const sample = currentSample;
    const dur = sample.duration;

    sample.harmonics.forEach(h => {
      const centerX = (h.t / dur) * width;
      const centerY = height - (h.f / 12) * height;
      const widthPx = (h.dur / dur) * width;

      // Radial energy field
      const grad = ctx.createRadialGradient(
        centerX, centerY, 2,
        centerX, centerY, 35 * h.amp
      );
      grad.addColorStop(0, '#fef08a'); // High energy yellow core
      grad.addColorStop(0.3, '#34d399'); // Emerald transition
      grad.addColorStop(0.7, '#1f4d3a'); // Deep green
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, widthPx / 2, 22 * h.amp, 0, 0, Math.PI * 2);
      ctx.fill();

      // Second harmonic overtone
      const overtoneY = height - ((h.f * 1.8) / 12) * height;
      if (overtoneY > 0) {
        const overtoneGrad = ctx.createRadialGradient(
          centerX, overtoneY, 1,
          centerX, overtoneY, 18 * h.amp
        );
        overtoneGrad.addColorStop(0, '#fde047');
        overtoneGrad.addColorStop(0.5, '#059669');
        overtoneGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = overtoneGrad;
        ctx.beginPath();
        ctx.ellipse(centerX, overtoneY, widthPx / 2.5, 10 * h.amp, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

  }, [currentSample]);

  const progressPercent = audioRef.current && audioRef.current.duration
    ? (currentTime / audioRef.current.duration) * 100
    : (currentTime / currentSample.duration) * 100;

  return (
    <div className="w-full bg-[#ffffff] border border-[#dde1dc] rounded-xl shadow-xs overflow-hidden">
      
      {/* 1. Species Capsule Selector Header */}
      <div className="p-3 bg-[#f5f6f4] border-b border-[#dde1dc] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {SAMPLES.map((sample, idx) => (
            <button
              key={sample.id}
              onClick={() => handleSelectSample(idx)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedIdx === idx
                  ? 'bg-[#1f4d3a] text-white font-semibold shadow-xs'
                  : 'bg-white text-[#5a635d] hover:text-[#1a1f1c] border border-[#dde1dc]'
              }`}
            >
              {sample.commonName}
            </button>
          ))}
        </div>

        <div className="font-mono text-[11px] text-[#5a635d] hidden sm:block">
          {currentSample.freqRange}
        </div>
      </div>

      {/* 2. Spectrogram Display Canvas */}
      <div className="p-4 sm:p-5 bg-[#ffffff] space-y-2">
        
        {/* Top Info Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-[#5a635d] border-b border-[#dde1dc] pb-2">
          <span className="flex items-center gap-1.5 font-semibold text-[#1a1f1c]">
            <Volume2 className="w-3.5 h-3.5 text-[#1f4d3a]" />
            BIOACOUSTIC SPECTROGRAM (0–12 kHz)
          </span>
          <span>{currentSample.site}</span>
        </div>

        {/* Spectrogram Canvas with Axes */}
        <div className="relative flex my-2 h-44 sm:h-52 w-full">
          
          {/* Y-axis (Frequency in kHz) */}
          <div className="w-8 flex flex-col justify-between font-mono text-[10px] text-[#5a635d] pr-2 text-right select-none border-r border-[#dde1dc]">
            <span>12k</span>
            <span>9k</span>
            <span>6k</span>
            <span>3k</span>
            <span>0</span>
          </div>

          {/* Interactive Spectrogram Area */}
          <div 
            className="relative flex-1 bg-[#0a1610] rounded-lg overflow-hidden ml-2 cursor-crosshair border border-[#dde1dc]"
            onClick={handleSeek}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <canvas
              ref={canvasRef}
              width={640}
              height={200}
              className="w-full h-full object-cover"
            />

            {/* Scanning Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#ffffff] shadow-md pointer-events-none transition-all duration-75"
              style={{ left: `${progressPercent}%` }}
            />

            {/* Real-time Cursor Readout */}
            {hoverCoord && (
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-[#1a1f1c]/90 text-white font-mono text-[10px] pointer-events-none border border-white/20">
                <span>T: {hoverCoord.time}</span> &bull; <span>F: {hoverCoord.freq}</span>
              </div>
            )}
          </div>
        </div>

        {/* X-axis (Time ticks) */}
        <div className="flex justify-between font-mono text-[10px] text-[#5a635d] pl-10 pr-1">
          <span>0.0s</span>
          <span>1.0s</span>
          <span>2.0s</span>
          <span>3.0s</span>
          <span>4.0s</span>
          <span>5.0s</span>
        </div>

      </div>

      {/* 3. Audio Controls & Species Information Ribbon */}
      <div className="bg-[#f5f6f4] px-4 py-3 border-t border-[#dde1dc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-[#1f4d3a] text-white flex items-center justify-center hover:bg-[#173b2c] transition-colors flex-shrink-0 shadow-xs"
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
              Elevation: {currentSample.elevation} &bull; Sampling: 48 kHz / 24-bit Lossless
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center font-mono text-xs text-[#5a635d]">
          <span>{currentTime.toFixed(1)}s / {currentSample.duration.toFixed(1)}s</span>
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setCurrentTime(0);
              }
            }}
            title="Reset playback"
            className="p-1 text-[#5a635d] hover:text-[#1a1f1c]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidden HTML Audio Tag */}
        <audio
          ref={audioRef}
          src={currentSample.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          preload="metadata"
        />

      </div>

    </div>
  );
}
