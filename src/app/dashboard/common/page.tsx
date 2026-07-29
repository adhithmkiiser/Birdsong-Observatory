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
  Filter,
  Layers
} from 'lucide-react';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

export default function CommonDashboardPage() {
  const { currentRole } = useRole();
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  // Scope filter state: Project & Site
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL_PROJECTS');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL_SITES');

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Aggregated stats (from DB RPC — no row limit problem!)
  const [totalDetections, setTotalDetections] = useState(0);
  const [uniqueSpecies, setUniqueSpecies] = useState(0);
  const [hourlyData, setHourlyData] = useState<{ hour: string; detections: number }[]>(
    Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, detections: 0 }))
  );
  const [topSpeciesData, setTopSpeciesData] = useState<{ species: string; detections: number }[]>([]);

  // Load projects and combined stations/sites on mount
  useEffect(() => {
    async function initData() {
      try {
        const [projectsRes, stationsRes, sitesRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('stations').select('*').order('station_name'),
          supabase.from('sites').select('*').order('name')
        ]);

        setProjectsList(projectsRes.data || []);

        const combined: any[] = [];
        (sitesRes.data || []).forEach(s => {
          combined.push({ id: s.id, station_name: s.name, project_id: s.project_id, type: 'PAM' });
        });
        (stationsRes.data || []).forEach(s => {
          combined.push({ id: s.id, station_name: s.station_name, project_id: s.project_id, type: 'Live' });
        });
        setStationsList(combined);
      } catch (err) {
        console.error('Error loading projects/sites:', err);
      }
    }
    initData();
  }, []);

  // Re-fetch aggregated stats whenever project/station filter changes
  useEffect(() => {
    async function loadAggregatedStats() {
      setLoading(true);
      try {
        const projArg = selectedProjectId === 'ALL_PROJECTS' ? null : selectedProjectId;
        const siteArg = selectedStationId === 'ALL_SITES' ? null : selectedStationId;

        const [statsRes, hourlyRes, speciesRes] = await Promise.all([
          supabase.rpc('get_detection_stats', { p_project_id: projArg, p_station_id: siteArg }),
          supabase.rpc('get_hourly_stats', { p_project_id: projArg, p_station_id: siteArg }),
          supabase.rpc('get_top_species', { p_project_id: projArg, p_station_id: siteArg, p_limit: 10 })
        ]);

        // Stats
        const stats = statsRes.data?.[0];
        setTotalDetections(Number(stats?.total_detections || 0));
        setUniqueSpecies(Number(stats?.unique_species || 0));

        // Hourly diurnal data — fill all 24 hours
        const hourMap: Record<number, number> = {};
        (hourlyRes.data || []).forEach((row: any) => {
          hourMap[Number(row.hour)] = Number(row.detections);
        });
        setHourlyData(
          Array.from({ length: 24 }, (_, i) => ({
            hour: `${i.toString().padStart(2, '0')}:00`,
            detections: hourMap[i] || 0
          }))
        );

        // Top species
        setTopSpeciesData(
          (speciesRes.data || []).map((row: any) => ({
            species: row.species,
            detections: Number(row.detections)
          }))
        );
      } catch (err) {
        console.error('Error loading aggregated stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAggregatedStats();
  }, [selectedProjectId, selectedStationId]);

  const availableStations = selectedProjectId === 'ALL_PROJECTS'
    ? stationsList
    : stationsList.filter(s => s.project_id === selectedProjectId);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedStationId('ALL_SITES');
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Hero Banner */}
      <div className="relative overflow-hidden p-8 md:p-10 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-2xl border border-slate-800/80">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Common Platform Dashboard Format
              </span>
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Standard Research Project Dashboard
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Standard Bioacoustics Monitoring Dashboard
            </h1>

            <p className="text-emerald-400 text-sm font-bold tracking-wide">
              Modular Format for All Newly Created Projects & Deployed Stations
            </p>

            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
              Unified bioacoustics dashboard template providing species richness counts, 24-hour diurnal patterns, and field station telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* Scope Filter Controls Bar */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Dashboard Scope Filter (Choose Project & Site):</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none"
            >
              <option value="ALL_PROJECTS">All Projects ({projectsList.length})</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">Select Site Node</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none"
            >
              <option value="ALL_SITES">All Sites in Chosen Project</option>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Active Nodes</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{availableStations.length} Sites</div>
            <p className="text-[11px] text-emerald-700 font-bold mt-0.5">Online field stations</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Total Detections</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalDetections.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Ingested calls</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Species Count</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{uniqueSpecies} species</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Identified taxa</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Bird className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Model Threshold</span>
            <div className="text-2xl font-black text-slate-900 mt-1">85.0%</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">BirdNET v2.4 CNN</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Stacked Charts */}
      <div className="space-y-6">
        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Detections by Time of Day (24-Hour Diurnal)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Diurnal vocalization activity pattern for selected project.</p>
            </div>
          </div>
          <DiurnalChart data={hourlyData} />
        </div>

        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Bird className="w-4 h-4 text-emerald-600" /> Relative Species Abundance Ranking
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Ranked species call frequencies.</p>
            </div>
          </div>
          <TopSpeciesChart data={topSpeciesData} />
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
