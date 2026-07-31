'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { AccumulationChart } from '@/components/charts/AccumulationChart';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { PolarDiurnalChart } from '@/components/charts/PolarDiurnalChart';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

function dedupeDetections(list: any[]) {
  const seen = new Set<string>();
  return list.filter((d) => {
    const key = `${d.recorder_id || d.station_id}|${d.timestamp}|${d.common_name}|${d.scientific_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
        const [{ data: projs }, { data: recordersData }, { data: sitesData }, { data: detData }] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('name'),
          supabase.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(200)
        ]);

        const liveProjectIds = new Set((projs || []).map(p => p.id));
        const liveSites = (sitesData || []).filter(s => liveProjectIds.has(s.project_id));
        setLiveProjects(projs || []);
        setStationsList(recordersData || []);
        setSitesList(liveSites);
        setDetections(dedupeDetections(detData || []));
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
          setDetections((prev) => dedupeDetections([payload.new, ...prev]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter live sites strictly by selected Live project
  const availableSites = selectedProjectId === 'ALL'
    ? sitesList
    : sitesList.filter(s => s.project_id === selectedProjectId);

  const selectedProjectName = selectedProjectId === 'ALL'
    ? 'ALL'
    : liveProjects.find((p: any) => p.id === selectedProjectId)?.name;
  const selectedSiteName = selectedSiteId === 'ALL'
    ? 'ALL'
    : availableSites.find((s: any) => s.id === selectedSiteId)?.name;

  // Hardware recorder nodes from recorders_registry, scoped by project and optional site
  const availableStations = stationsList.filter((s: any) => {
    if (selectedProjectName !== 'ALL' && s.project_name !== selectedProjectName) return false;
    if (selectedSiteName !== 'ALL' && s.site_name !== selectedSiteName) return false;
    return true;
  });

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

  // Full-duration species accumulation curve (every day from first to last detection)
  const accumulationData = useMemo(() => {
    const dated = filteredDetections.filter(d => d.timestamp).map(d => {
      const day = new Date(d.timestamp).toISOString().slice(0, 10);
      return { day, species: d.common_name || d.scientific_name };
    });
    if (dated.length === 0) return [];
    const days = dated.map(d => d.day).sort();
    const min = new Date(days[0]);
    const max = new Date(days[days.length - 1]);
    const byDay: Record<string, Set<string>> = {};
    dated.forEach(d => {
      if (!byDay[d.day]) byDay[d.day] = new Set();
      byDay[d.day].add(d.species);
    });
    const cumulative = new Set<string>();
    const out: { day: string; species: number }[] = [];
    for (let d = new Date(min); d <= max; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      (byDay[day] || new Set()).forEach(s => cumulative.add(s));
      out.push({ day, species: cumulative.size });
    }
    return out;
  }, [filteredDetections]);

  // Active Nodes calculation (status === 'online')
  const activeNodesCount = availableStations.filter((s: any) => s.status === 'online').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="p-8 rounded-[32px] bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border border-emerald-800/30 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black tracking-wide border border-emerald-500/30 flex items-center gap-1.5 uppercase">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" /> Live Recorders Stream Format
            </span>
            <span className="text-slate-400 text-xs font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Realtime Telemetry & Stream
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Live Bioacoustic Recorders Dashboard
          </h1>

          <p className="text-sm font-bold text-emerald-400/90">
            Realtime Species Vocalization Ingestion & Automated Hardware Telemetry
          </p>

          <p className="text-xs text-slate-400 max-w-2xl font-medium leading-relaxed pt-1">
            Continuous bioacoustic stream monitoring directly from Raspberry Pi field daemons running BirdNET-Pi.
          </p>
        </div>
      </div>

      {/* 3-Level Connected Scope Toolbar */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-3">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Live Scope Filter (Select Live Project ➔ Site ➔ Recorder Hardware Node):</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
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

          <div>
            <label className="font-extrabold text-slate-700 flex items-center justify-between mb-1.5">
              <span>4. Min Confidence Filter</span>
              <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-200">
                {formatPercent(minConfidence)}
              </span>
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 h-[42px] flex items-center">
              <input
                type="range"
                min="0.2"
                max="0.99"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Realtime KPI Cards Grid (NO FAKE DATA) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Active Field Nodes</span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {activeNodesCount} {activeNodesCount === 1 ? 'Node' : 'Nodes'}
            </div>
            <p className={`text-[11px] font-bold mt-0.5 ${activeNodesCount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {activeNodesCount > 0 ? 'Online stream daemon' : 'All Nodes Offline (>5m)'}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${activeNodesCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            <Radio className={`w-5 h-5 ${activeNodesCount > 0 ? 'animate-pulse' : ''}`} />
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
                <Sparkles className="w-4 h-4 text-emerald-600" /> Species Accumulation Curve (Full Detection History)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Cumulative unique species counts from the first live detection through today.</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">Transect Curve</span>
          </div>
          <AccumulationChart data={accumulationData} />
        </div>

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

        {/* Polar 24-Hour Bioacoustic Clock Chart (Nightingale Rose Chart) */}
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" /> Live Diurnal Activity Pattern (24-Hour Radial Clock - Total)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Daily updated circular polar distribution of total vocal detections per hour (12am to 11pm).</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              ⚡ Live Daily Updated
            </span>
          </div>

          <PolarDiurnalChart hourlyData={hourlyData} totalDetections={totalDetections} />
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

    </div>
  );
}
