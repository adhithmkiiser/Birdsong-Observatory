'use client';

import React, { useState } from 'react';
import { 
  Radio, 
  Cpu, 
  Bird, 
  FolderKanban, 
  Database, 
  Clock, 
  Play, 
  ChevronRight,
  ShieldCheck,
  Activity, 
  Volume2,
  Sparkles,
  TrendingUp,
  Filter,
  Plus
} from 'lucide-react';
import { STATIONS_DATA, DETECTIONS_DATA, PROJECTS_DATA } from '@/lib/mockData';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';

export default function DashboardPage() {
  const { currentRole, visibilitySettings } = useRole();
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  // Scope filter state: Project & Site
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL_PROJECTS');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL_SITES');

  // Filter available stations based on selected project
  const availableStations = selectedProjectId === 'ALL_PROJECTS'
    ? STATIONS_DATA
    : STATIONS_DATA.filter(s => s.project_id === selectedProjectId);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedStationId('ALL_SITES');
  };

  // Filter detections based on selected project and site
  const filteredDetections = DETECTIONS_DATA.filter(det => {
    const matchesProject = selectedProjectId === 'ALL_PROJECTS' || det.project_name === PROJECTS_DATA.find(p => p.id === selectedProjectId)?.name;
    const matchesStation = selectedStationId === 'ALL_SITES' || det.station_id === selectedStationId;
    return matchesProject && matchesStation;
  });

  const activeStations = availableStations.filter(s => s.status === 'online').length;
  const totalStationsCount = availableStations.length;
  const totalDetectionsCount = filteredDetections.length;

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden p-8 md:p-10 rounded-[24px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-2xl border border-slate-800/80 group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition duration-700 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition duration-700 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Cloud Backend Ready
              </span>
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> IISER Tirupati Bird Lab
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Bioacoustics Monitoring Platform
            </h1>

            <p className="text-emerald-400 text-sm font-bold tracking-wide">
              Realtime Species Vocalization Ingestion & Automated Telemetry
            </p>

            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
              Autonomous continuous bioacoustic monitoring across Western Ghats rainforest canopy and Sheshachalam biosphere reserve corridors.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 flex-shrink-0">
            <a
              href="/projects"
              className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 group/btn"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Project</span>
            </a>

            <a
              href="/stations"
              className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs backdrop-blur-md transition flex items-center justify-center gap-2"
            >
              <Cpu className="w-4 h-4 text-indigo-300" />
              <span>Deploy Recording Node</span>
            </a>
          </div>
        </div>
      </div>

      {/* Project & Site Scope Selection Controls Panel */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Dashboard Scope Filter:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Dropdown 1: Select Project */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_PROJECTS">All Projects ({PROJECTS_DATA.length} Projects)</option>
              {PROJECTS_DATA.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Dropdown 2: Select Site / Station */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">Select Site / Recorder Node</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_SITES">All Sites & Recorders ({availableStations.length} Sites)</option>
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.station_name} ({s.description})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {/* Card 1: Active Stations */}
        <div className="premium-card gradient-border-emerald p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Nodes</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="my-1">
            <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{activeStations}</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">Online field nodes</p>
        </div>

        {/* Card 2: Total Recorders */}
        <div className="premium-card gradient-border-indigo p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Nodes</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="my-1">
            <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{totalStationsCount}</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">Deployed scope</p>
        </div>

        {/* Card 3: Total Detections */}
        <div className="premium-card gradient-border-indigo p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detections</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="my-1">
            <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{totalDetectionsCount.toLocaleString()}</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">Ingested call events</p>
        </div>

        {/* Card 4: Species Count */}
        <div className="premium-card gradient-border-amber p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Species</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs">
              <Bird className="w-4 h-4" />
            </div>
          </div>
          <div className="my-1">
            <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">0</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">Identified taxa</p>
        </div>

        {/* Card 5: Avg Confidence */}
        <div className="premium-card gradient-border-emerald p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Conf.</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-1">
            <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">--</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">Model threshold 85%</p>
        </div>

        {/* Card 6: Storage Used */}
        <div className="premium-card gradient-border-indigo p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Storage</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shadow-2xs">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="my-1">
            <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">0.0 GB</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">Supabase Bucket</p>
        </div>

        {/* Card 7: Projects */}
        <div className="premium-card gradient-border-amber p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Projects</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="my-1">
            <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{PROJECTS_DATA.length}</p>
          </div>
          <p className="text-[11px] font-bold text-slate-400">Active research</p>
        </div>
      </div>

      {/* Main Stacked Charts Section: Detections by Time of Day & Relative Species Abundance stacked ONE BELOW ANOTHER */}
      <div className="space-y-6">
        {/* 1. Detections by Time of Day (24-Hour Diurnal) Chart (Full Width) */}
        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Detections by Time of Day (24-Hour Diurnal)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Hourly vocalization activity pattern.</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">Live Scope</span>
          </div>
          <DiurnalChart />
        </div>

        {/* 2. Relative Species Abundance Ranking Chart */}
        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Bird className="w-4 h-4 text-emerald-600" /> Relative Species Abundance Ranking
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Top detected species ranked by call volume across recording transects.</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">Live Scope</span>
          </div>
          <TopSpeciesChart />
        </div>
      </div>

      {/* Recent Live Audio Detections Feed Table */}
      <div className="premium-card p-6 rounded-[24px] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-600" /> Recent Live Bioacoustic Detections Feed
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Stream of latest automatic species classifications across active field stations.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredDetections.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <Volume2 className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-black text-xs text-slate-900">No Audio Detections Ingested Yet</div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto font-medium">
                Run <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">python-sync/birdnet_sync.py</code> or connect a live Raspberry Pi node to stream detections into the platform.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="pb-3 pl-2">Time</th>
                  <th className="pb-3">Species</th>
                  <th className="pb-3">Station Node</th>
                  <th className="pb-3">Confidence</th>
                  <th className="pb-3 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDetections.map((det) => (
                  <tr key={det.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 pl-2 font-mono text-[11px] text-slate-500">{det.time}</td>
                    <td className="py-3.5">
                      <div className="font-extrabold text-slate-900">{det.common_name}</div>
                      <div className="text-[10px] text-slate-500 italic">{det.scientific_name}</div>
                    </td>
                    <td className="py-3.5 font-bold text-slate-700">{det.station_name}</td>
                    <td className="py-3.5">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border ${
                        det.confidence >= 0.9 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {formatPercent(det.confidence)}
                      </span>
                    </td>
                    <td className="py-3.5 pr-2 text-right">
                      <button
                        onClick={() => setSelectedDetection(det)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <Play className="w-3 h-3 fill-current" /> Listen Clip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Audio Modal */}
      {selectedDetection && (
        <AudioPlayerModal
          detection={selectedDetection}
          currentRole={currentRole}
          onClose={() => setSelectedDetection(null)}
        />
      )}
    </div>
  );
}
