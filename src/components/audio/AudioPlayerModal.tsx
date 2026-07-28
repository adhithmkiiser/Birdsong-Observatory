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

  if (!detection) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-200">
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
          {/* Spectrogram Display */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 group">
            <img
              src={detection.spectrogram_url || '/placeholder-spec.png'}
              alt="Spectrogram"
              className="w-full h-48 object-cover opacity-90 group-hover:opacity-100 transition"
            />
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-xl border border-slate-200 text-xs font-black text-emerald-700 flex items-center gap-1.5 shadow-sm">
              <span>Confidence: {formatPercent(detection.confidence)}</span>
            </div>
            <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-300">
              0.0s ─── 1.5s ─── 3.0s (kHz 0-12)
            </div>
          </div>

          {/* Audio Controls Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20 transition transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs text-slate-500 font-mono font-medium">
                <span>00:01</span>
                <span className="flex items-center gap-1 text-indigo-600 font-bold"><Volume2 className="w-3.5 h-3.5" /> 3.0s Audio Waveform</span>
                <span>00:03</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className={`bg-indigo-600 h-full transition-all duration-300 ${isPlaying ? 'w-2/3' : 'w-1/4'}`}></div>
              </div>
            </div>

            <a
              href={detection.audio_url || '#'}
              download
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>WAV</span>
            </a>
          </div>

          {/* Verification Panel (Admin, Project Manager, Site Manager) */}
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
                  onClick={() => onVerify && onVerify(detection.id, true)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Check className="w-4 h-4" /> Confirm Call [Y]
                </button>
                <button
                  onClick={() => onVerify && onVerify(detection.id, false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <AlertTriangle className="w-4 h-4" /> Reject [N]
                </button>
                <button className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition shadow-xs">
                  <RotateCcw className="w-3.5 h-3.5" /> Reassign
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
