'use client';

import React, { useState } from 'react';
import { 
  Radio, 
  Search, 
  Play, 
  CheckCircle2, 
  Volume2,
  Filter,
  Activity,
  Sliders,
  Calendar,
  Sparkles
} from 'lucide-react';
import { DETECTIONS_DATA, STATIONS_DATA } from '@/lib/mockData';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';

export default function LiveDetectionsPage() {
  const { currentRole } = useRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  const filteredDetections = DETECTIONS_DATA.filter((det) => {
    const matchesSearch = det.common_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          det.scientific_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStation = selectedStation === 'ALL' || det.station_name === selectedStation;
    const matchesConf = det.confidence >= minConfidence;
    return matchesSearch && matchesStation && matchesConf;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Live Bioacoustic Detection Recorder</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Realtime acoustic classifications ingested directly from Raspberry Pi field daemons running BirdNET-Pi model v2.4.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Realtime Ingestion Daemon Active
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter detections by species common or scientific name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-semibold"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-slate-600 font-extrabold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" /> Station Node:
          </label>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Field Stations</option>
            {STATIONS_DATA.map((s) => (
              <option key={s.id} value={s.station_name}>{s.station_name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 min-w-[220px]">
          <label className="text-slate-600 font-extrabold flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-slate-500" /> Min Confidence:
          </label>
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="flex-1 accent-indigo-600"
          />
          <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{formatPercent(minConfidence)}</span>
        </div>
      </div>

      {/* Detection Cards Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDetections.map((det) => (
          <div
            key={det.id}
            className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition duration-300">
                  <Volume2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition">{det.common_name}</h3>
                  <p className="text-xs italic text-slate-500 font-medium">{det.scientific_name}</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-mono">
                {formatPercent(det.confidence)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 font-medium">
              <div>
                Station Node: <strong className="text-slate-900">{det.station_name}</strong>
              </div>
              <div className="flex items-center gap-1 text-slate-500 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> {det.time} ({det.timestamp || 'Today'})
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {det.verified ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Expert Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-xl border border-amber-200">
                  AI Automated Classifier
                </span>
              )}

              <button
                onClick={() => setSelectedDetection(det)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2 group-hover:scale-105"
              >
                <Play className="w-4 h-4 fill-white" /> Listen Audio
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Audio Player Modal */}
      <AudioPlayerModal
        detection={selectedDetection}
        onClose={() => setSelectedDetection(null)}
        currentRole={currentRole}
      />
    </div>
  );
}
