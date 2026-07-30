'use client';

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Cpu, 
  Bird, 
  Clock, 
  Play, 
  Activity, 
  Volume2,
  Sparkles,
  Filter,
  ShieldCheck,
  Search,
  Calendar,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

const SatelliteMap = dynamic(() => import('@/components/map/SatelliteMap'), { ssr: false });

export default function LiveDashboardPage() {
  const { currentRole } = useRole();
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  // 3-Level Scope Toolbar States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.5);

  // Supabase Data States
  const [liveProjects, setLiveProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLiveDashboardData() {
      setLoading(true);
      try {
        const [{ data: projs }, { data: recordersData }, { data: detData }] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(200)
        ]);

        setLiveProjects(projs || []);
        setStationsList(recordersData || []);
        setDetections(detData || []);
      } catch (err) {
        console.error('Failed to load Live Dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLiveDashboardData();

    // Subscribe to realtime live_detections stream
    const channel = supabase
      .channel('live-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_detections' },
        (payload) => {
          setDetections((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter sites strictly by selected Live project (Never PAM sites)
  const liveProjectIds = new Set(liveProjects.map(p => p.id));
  const availableSites = selectedProjectId === 'ALL'
    ? sitesList.filter(s => liveProjectIds.has(s.project_id))
    : sitesList.filter(s => s.project_id === selectedProjectId);

  // Hardware recorder nodes dynamically populated from recorders_registry
  const availableStations = selectedProjectId === 'ALL'
    ? stationsList
    : stationsList.filter(s => s.project_name === selectedProjectId);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedSiteId('ALL');
    setSelectedStationId('ALL');
  };

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedStationId('ALL');
  };

  // Filter detections by 3-level scope & search/confidence
  const filteredDetections = detections.filter((det) => {
    const common = det.common_name || '';
    const sci = det.scientific_name || '';
    const matchesSearch = common.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sci.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStation = true;
    if (selectedStationId !== 'ALL') {
      matchesStation = det.station_id === selectedStationId || det.station_name === selectedStationId;
    }

    const matchesConf = (det.confidence || 0) >= minConfidence;
    return matchesSearch && matchesStation && matchesConf;
  });

  // Calculate live stats dynamically (NO FAKE DATA)
  const totalDetections = filteredDetections.length;
  const uniqueSpecies = Array.from(new Set(filteredDetections.map(d => d.common_name))).length;

  // Hourly Diurnal Data (24 Hours)
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    detections: 0
  }));
  filteredDetections.forEach(d => {
    if (!d.timestamp) return;
    const h = new Date(d.timestamp).getHours();
    if (h >= 0 && h < 24) hourlyData[h].detections += 1;
  });

  // Top Species Data
  const spMap: Record<string, number> = {};
  filteredDetections.forEach(d => {
    if (d.common_name) spMap[d.common_name] = (spMap[d.common_name] || 0) + 1;
  });
  const topSpeciesData = Object.keys(spMap)
    .map(sp => ({ species: sp, detections: spMap[sp] }))
    .sort((a, b) => b.detections - a.detections)
    .slice(0, 10);

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Hero Banner */}
      <div className="relative overflow-hidden p-8 md:p-10 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#064e3b] text-white shadow-2xl border border-emerald-800/80">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Recorders Stream Format
              </span>
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Realtime Telemetry & Stream
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Live Bioacoustic Recorders Dashboard
            </h1>

            <p className="text-emerald-400 text-sm font-bold tracking-wide">
              Realtime Species Vocalization Ingestion & Automated Hardware Telemetry
            </p>

            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
              Continuous bioacoustic stream monitoring directly from Raspberry Pi field daemons running BirdNET-Pi.
            </p>
          </div>
        </div>
      </div>

      {/* 3-Level Connected Scope Toolbar */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-3">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Live Scope Filter (Select Live Project ➔ Site ➔ Recorder Hardware Node):</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">1. Select Live Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Live Projects ({liveProjects.length})</option>
              {liveProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">2. Select Site</label>
            <select
              value={selectedSiteId}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Sites in Project ({availableSites.length})</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">3. Select Recorder Node</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Hardware Nodes ({availableStations.length})</option>
              {availableStations.map((s: any) => (
                <option key={s.recorder_id || s.id} value={s.recorder_id || s.id}>
                  {s.site_name || s.recorder_id} ({s.recorder_id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Realtime KPI Cards Grid (NO FAKE DATA) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Active Field Nodes</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{availableStations.length} Node</div>
            <p className="text-[11px] text-emerald-600 font-bold mt-0.5">Online stream daemon</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Live Detections</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalDetections.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Realtime call events</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Identified Taxa</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{uniqueSpecies} species</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Unique bird species</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Bird className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Classifier Model</span>
            <div className="text-2xl font-black text-slate-900 mt-1">BirdNET-Pi</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">v2.4 CNN Model</p>
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
                <Clock className="w-4 h-4 text-emerald-600" /> Live Diurnal Activity Pattern (24 Hours)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Realtime vocalization activity pattern for selected live scope.</p>
            </div>
          </div>
          <DiurnalChart data={hourlyData} />
        </div>

        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Bird className="w-4 h-4 text-emerald-600" /> Relative Species Abundance
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Ranked species call frequencies from live recorders.</p>
            </div>
          </div>
          <TopSpeciesChart data={topSpeciesData} />
        </div>
      </div>

      {/* Filter & Live Detection Feed (NO FAKE DATA) */}
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 text-xs">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter live detections by common or scientific name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-semibold"
            />
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
              className="flex-1 accent-emerald-600"
            />
            <span className="font-mono font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{formatPercent(minConfidence)}</span>
          </div>
        </div>

        {/* Live Feed Cards */}
        {filteredDetections.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
            <Radio className="w-8 h-8 text-emerald-500 animate-pulse mx-auto" />
            <h3 className="text-base font-black text-slate-900">Waiting for Live Recorder Ingestion...</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No live detections match the current scope filter. As soon as your Raspberry Pi field daemon detects a call, it will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDetections.map((det) => (
              <div
                key={det.id}
                className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition duration-300 flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20 group-hover:scale-105 transition duration-300">
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition">{det.common_name}</h3>
                      <p className="text-xs italic text-slate-500 font-medium">{det.scientific_name || 'Taxon'}</p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-mono">
                    {formatPercent(det.confidence)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 font-medium">
                  <div>
                    Station Node: <strong className="text-slate-900">{det.station_name || det.station_id}</strong>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {det.time_str || ''} ({det.date_str || 'Today'})
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Live Stream Record
                  </span>

                  <button
                    onClick={() => setSelectedDetection(det)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 group-hover:scale-105"
                  >
                    <Play className="w-4 h-4 fill-white" /> Listen Audio
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio Modal */}
      {selectedDetection && (
        <AudioPlayerModal
          detection={selectedDetection}
          onClose={() => setSelectedDetection(null)}
          currentRole={currentRole}
        />
      )}
    </div>
  );
}
