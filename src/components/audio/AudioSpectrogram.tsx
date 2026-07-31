'use client';

import React, { useEffect, useRef } from 'react';

interface AudioSpectrogramProps {
  audioUrl: string;
  isPlaying: boolean;
}

export function AudioSpectrogram({ audioUrl, isPlaying }: AudioSpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize canvas with a dark background
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Create audio element and audio graph
    const audio = new Audio(audioUrl);
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    audioCtxRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    sourceRef.current = source;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      audio.pause();
      audioCtx.close().catch(() => {});
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    const audioCtx = audioCtxRef.current;
    if (!audio || !audioCtx) return;

    const drawSpectrogram = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const analyser = analyserRef.current;
      if (!canvas || !ctx || !analyser) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      // Shift existing spectrogram left by 2 pixels
      const existing = ctx.getImageData(2, 0, width - 2, height);
      ctx.putImageData(existing, 0, 0);

      // Draw new frequency column on the right
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const y = height - Math.floor((i / bufferLength) * height);
        const h = Math.max(1, Math.ceil(height / bufferLength));
        const hue = 160 + (value / 255) * 120; // emerald -> cyan -> blue
        const saturation = 60 + (value / 255) * 40;
        const lightness = 10 + (value / 255) * 60;
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(width - 2, y - h, 2, h);
      }

      rafRef.current = requestAnimationFrame(drawSpectrogram);
    };

    if (isPlaying) {
      audioCtx.resume().then(() => {
        audio.play().catch((err) => console.error('Audio play error:', err));
        rafRef.current = requestAnimationFrame(drawSpectrogram);
      });
    } else {
      audio.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [isPlaying]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#060b19] p-4 text-white shadow-inner">
      <canvas
        ref={canvasRef}
        width={600}
        height={176}
        className="w-full h-44 rounded-xl"
      />
      <div className="absolute top-6 right-6 bg-slate-900/90 backdrop-blur px-3 py-1 rounded-xl border border-emerald-500/30 text-xs font-black text-emerald-400 flex items-center gap-1.5 shadow-sm">
        <span>Live Spectrogram</span>
      </div>
    </div>
  );
}
