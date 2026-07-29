'use client';

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Cpu, 
  Bird, 
  FolderKanban, 
  Database, 
  Clock, 
  Play, 
  Activity, 
  Volume2,
  Sparkles,
  TrendingUp,
  Filter,
  Plus,
  ShieldCheck
} from 'lucide-react';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface Project {
  id: string;
  name: string;
  description: string;
  organization: string;
  project_type: string;
  species_count: number;
  total_detections: number;
  stations_count: number;
  public_visible: boolean;
  created_at: string;
  manager_name?: string;
}

interface Station {
  id: string;
  station_name: string;
  description: string;
  project_id: string;
  project_name: string;
  status: string;
  last_seen?: string;
  latitude?: number;
  longitude?: number;
}

export default function DashboardRoutePage() {
  const { currentRole, visibilitySettings } = useRole();
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  // Scope filter state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL_PROJECTS');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL_SITES');

  // Real data from Supabase
  const [projects, setProjects] = useState<Project[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [{ data: projs }, { data: stats }] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('stations').select('*').order('station_name'),
        ]);
        setProjects(projs || []);
        setStations(stats || []);
      } catch (e) {
        console.error('Failed to fetch data:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const availableStations = selectedProjectId === 'ALL_PROJECTS'
    ? stations
    : stations.filter(s => s.project_id === selectedProjectId);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedStationId('ALL_SITES');
  };

  const activeStations = availableStations.filter(s => s.status === 'online').length;
  const totalStationsCount = availableStations.length;

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
              Realtime Species Vocalization Ingestion &amp; Automated Telemetry
            </p>

            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
              Autonomous continuous bioacoustic monitoring across Western Ghats rainforest canopy and Sheshachalam biosphere reserve corridors.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 flex-shrink-0">
            <a
              href="/projects"
              className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2"
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

      {/* Project & Site Scope Filter */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Dashboard Scope Filter:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_PROJECTS">All Projects ({projects.length} Projects)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">Select Site / Recorder Node</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_SITES">All Sites &amp; Recorders ({availableStations.length} Sites)</option>
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.station_name} ({s.description})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="premium-card p-4 rounded-[20px] min-h-[140px] animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          <div className="premium-card gradient-border-emerald p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Nodes</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{activeStations}</p>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Online field nodes</p>
          </div>

          <div className="premium-card gradient-border-indigo p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Nodes</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{totalStationsCount}</p>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Deployed scope</p>
          </div>

          <div className="premium-card gradient-border-indigo p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detections</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">0</p>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Ingested call events</p>
          </div>

          <div className="premium-card gradient-border-amber p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Species</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Bird className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">0</p>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Identified taxa</p>
          </div>

          <div className="premium-card gradient-border-emerald p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Conf.</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">--</p>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Model threshold 85%</p>
          </div>

          <div className="premium-card gradient-border-indigo p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Storage</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">0.0 GB</p>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Supabase Bucket</p>
          </div>

          <div className="premium-card gradient-border-amber p-4 rounded-[20px] flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Projects</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{projects.length}</p>
            </div>
            <p className="text-[11px] font-bold text-slate-400">Active research</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="space-y-6">
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

      {/* Recent Detections Feed */}
      <div className="premium-card p-6 rounded-[24px] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-600" /> Recent Live Bioacoustic Detections Feed
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Stream of latest automatic species classifications across active field stations.</p>
          </div>
        </div>

        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <Volume2 className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="font-black text-xs text-slate-900">No Audio Detections Ingested Yet</div>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto font-medium">
            Run <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">python-sync/birdnet_sync.py</code> or connect a live Raspberry Pi node to stream detections into the platform.
          </p>
        </div>
      </div>

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
