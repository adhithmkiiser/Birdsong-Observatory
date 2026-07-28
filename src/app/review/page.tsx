'use client';

import React, { useState } from 'react';
import { CheckSquare, Play, Check, X, RotateCcw } from 'lucide-react';
import { DETECTIONS_DATA } from '@/lib/mockData';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';

export default function ReviewQueuePage() {
  const { currentRole } = useRole();
  const [queue, setQueue] = useState(DETECTIONS_DATA);
  const [activeIdx, setActiveIdx] = useState(0);

  const activeItem = queue[activeIdx];

  const handleDecision = (decision: 'confirm' | 'reject') => {
    if (activeIdx < queue.length - 1) {
      setActiveIdx(activeIdx + 1);
    }
  };

  if (!activeItem) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Review Queue Clear!</h2>
        <p className="text-xs text-slate-400">All low-confidence bioacoustic detections have been verified by researchers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-400" /> Researcher Bioacoustic Review Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1">Human-in-the-loop verification for uncertain predictions (60-85% confidence threshold).</p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold">
            Queue: {activeIdx + 1} of {queue.length} Visits to Review
          </span>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">{activeItem.common_name}</h2>
              <span className="text-xs italic text-slate-400">({activeItem.scientific_name})</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Uncertain ID ({formatPercent(activeItem.confidence)})
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Station: <strong className="text-white">{activeItem.station_name}</strong> · Timestamp: {activeItem.timestamp}
            </p>
          </div>

          <div className="text-right text-[11px] text-slate-400 font-mono">
            Hotkeys: <span className="text-emerald-400">[Y] Confirm</span> · <span className="text-rose-400">[N] Reject</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300">Target Recording Spectrogram:</span>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-56 relative">
              <img src={activeItem.spectrogram_url || '/placeholder-spec.png'} alt="Spectrogram" className="w-full h-full object-cover" />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
              <button className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center font-bold">
                <Play className="w-4 h-4 ml-0.5" />
              </button>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>00:00</span>
                  <span className="text-emerald-400">Play Audio Call</span>
                  <span>00:03</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-1/3"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300">Compare with Station Benchmark (99% Match):</span>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="h-28 rounded overflow-hidden bg-slate-900">
                    <img src={activeItem.spectrogram_url || '/placeholder-spec.png'} alt="Ref" className="w-full h-full object-cover opacity-80" />
                  </div>
                  <div className="text-[10px] font-bold text-center text-emerald-400">99.2% Reference</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <button
            onClick={() => handleDecision('confirm')}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
          >
            <Check className="w-4 h-4" /> Confirm Species [Y]
          </button>
          <button
            onClick={() => handleDecision('reject')}
            className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition"
          >
            <X className="w-4 h-4" /> Reject Detection [N]
          </button>
          <button className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition">
            <RotateCcw className="w-4 h-4" /> Reassign... [R]
          </button>
        </div>
      </div>
    </div>
  );
}
