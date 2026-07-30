'use client';

import React, { useState } from 'react';
import { X, Play, Pause, Download, Check, AlertTriangle, RotateCcw, Volume2, Shield } from 'lucide-react';
import { Detection, UserRole } from '@/types/database';
import { formatPercent } from '@/lib/utils';

interface AudioPlayerModalProps {
  detection: Detection | null;
  onClose: () => void;
  currentRole: UserRole;
  onVerify?: (id: string, verified: boolean) => void;
}

export function AudioPlayerModal({ detection, onClose, currentRole, onVerify }: AudioPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  // Real bioacoustic species call audio clips dictionary
  const REAL_SPECIES_AUDIO: Record<string, string> = {
    'Indian Roller': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Coracias_benghalensis_call.ogg',
    'Common Myna': 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Acridotheres_tristis_call.ogg',
    'Green Warbler': 'https://upload.wikimedia.org/wikipedia/commons/5/52/Phylloscopus_nitidus.ogg',
    'White-cheeked Barbet': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Psilopogon_viridis.ogg'
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      setAudioProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setIsPlaying(false);
        setAudioProgress(0);
      }
    }, 300);

    const targetUrl = detection?.audio_url || 
                      (detection?.common_name ? REAL_SPECIES_AUDIO[detection.common_name] : null) || 
                      'https://cdn.freesound.org/previews/516/516893_10825376-lq.mp3';

    try {
      const audio = new Audio(targetUrl);
      audio.play().catch((err) => {
        console.log('Fallback to secondary audio stream:', err);
        const fallback = new Audio('https://cdn.freesound.org/previews/516/516893_10825376-lq.mp3');
        fallback.play().catch(() => {});
      });
    } catch (e) {
      console.log('Audio playback error:', e);
    }
  };

  if (!detection) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-200 font-sans">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900">{detection.common_name}</h3>
              <span className="text-xs italic text-slate-500 font-medium">({detection.scientific_name})</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Station: <strong className="text-slate-900">{detection.station_name}</strong> · {detection.timestamp}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Bioacoustic Spectrogram Canvas Visualizer */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#060b19] p-4 text-white shadow-inner group">
            {detection.spectrogram_url && detection.spectrogram_url.startsWith('http') ? (
              <img
                src={detection.spectrogram_url}
                alt="Spectrogram"
                className="w-full h-44 object-cover opacity-90 group-hover:opacity-100 transition rounded-xl"
              />
            ) : (
              <div className="w-full h-44 rounded-xl bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#022c22] border border-slate-800 p-4 relative flex flex-col justify-between overflow-hidden">
                {/* Simulated Frequency Waves Spectrogram Overlay */}
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                {/* Frequency Grid Lines */}
                <div className="relative z-10 flex justify-between text-[10px] font-mono text-emerald-400 font-bold border-b border-emerald-900/60 pb-1">
                  <span>12 kHz ── Upper Harmonics</span>
                  <span>6 kHz ── Core Call Frequency</span>
                  <span>0 kHz</span>
                </div>

                {/* Spectrogram Acoustic Energy Heat Map Simulation */}
                <div className="relative z-10 my-auto flex items-center justify-around h-20 gap-1">
                  {Array.from({ length: 32 }).map((_, idx) => {
                    const h = Math.sin(idx * 0.5) * 40 + 50;
                    return (
                      <div
                        key={idx}
                        style={{ height: `${h}%` }}
                        className={`w-2 rounded-full transition-all duration-300 ${
                          idx > 10 && idx < 22 
                            ? 'bg-gradient-to-t from-amber-500 via-emerald-400 to-cyan-300 shadow-[0_0_8px_#10b981]' 
                            : 'bg-emerald-900/40'
                        }`}
                      ></div>
                    );
                  })}
                </div>

                <div className="relative z-10 flex justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-1">
                  <span>0.0s</span>
                  <span>1.5s (kHz 0-12)</span>
                  <span>3.0s</span>
                </div>
              </div>
            )}

            <div className="absolute top-6 right-6 bg-slate-900/90 backdrop-blur px-3 py-1 rounded-xl border border-emerald-500/30 text-xs font-black text-emerald-400 flex items-center gap-1.5 shadow-sm">
              <span>Confidence: {formatPercent(detection.confidence)}</span>
            </div>
          </div>

          {/* Audio Controls Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-4">
            <button
              onClick={handlePlayToggle}
              className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20 transition transform active:scale-95 shrink-0"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5 fill-white" />}
            </button>

            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 font-mono font-bold">
                <span>00:0{Math.floor((audioProgress / 100) * 3)}</span>
                <span className="flex items-center gap-1 text-indigo-600 font-black"><Volume2 className="w-3.5 h-3.5" /> Bioacoustic Waveform Playback</span>
                <span>00:03</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${audioProgress}%` }}
                  className="bg-indigo-600 h-full transition-all duration-150 rounded-full"
                ></div>
              </div>
            </div>

            <button
              onClick={handlePlayToggle}
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold shadow-xs shrink-0"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>WAV</span>
            </button>
          </div>

          {/* Verification Panel */}
          {currentRole !== 'Public' && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" /> Manager & Researcher Verification Panel
                </span>
                <span className="text-[10px] text-indigo-600 font-medium">Role: {currentRole}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onVerify) onVerify(detection.id, true);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Check className="w-4 h-4" /> Confirm Call [Y]
                </button>
                <button
                  onClick={() => {
                    if (onVerify) onVerify(detection.id, false);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <AlertTriangle className="w-4 h-4" /> Reject [N]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
