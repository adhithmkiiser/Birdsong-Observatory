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
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';

import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

function dedupeDetections(list: any[]) {
  const seen = new Set<string>();
  return list.filter((d) => {
    // Rejected detections should not appear in the analysis
    if (d.verification_status === 'NO') return false;
    const key = `${d.recorder_id || d.station_id}|${d.timestamp}|${d.common_name}|${d.scientific_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SatelliteMap = dynamic(() => import('@/components/map/SatelliteMap'), { ssr: false });

export default function LiveDetectionsPage() {
  const { currentRole } = useRole();
  const [searchQuery, setSearchQuery] = useState('');
  
  // 3-level Toolbar States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');
  
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  const [liveProjects, setLiveProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function loadLiveData() {
      try {
        const [{ data: projData }, { data: recordersData }, { data: sitesData }, { data: detData }] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('name'),
          supabase.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(200)
        ]);

        const liveProjectIds = new Set((projData || []).map(p => p.id));
        const liveSites = (sitesData || []).filter(s => liveProjectIds.has(s.project_id));
        setLiveProjects(projData || []);

        // Pre-select project from query param
        const queryProject = new URLSearchParams(window.location.search).get('project');
        if (queryProject && liveProjectIds.has(queryProject)) {
          setSelectedProjectId(queryProject);
        }

        setStationsList(recordersData || []);
        setSitesList(liveSites);
        setDetections(dedupeDetections(detData || []));
      } catch (err) {
        console.error('Failed to load Live detections:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLiveData();

    // Subscribe to realtime live_detections
    const channel = supabase
      .channel('live-recorder-stream')
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

  // Filter sites by selected project
  const availableSites = selectedProjectId === 'ALL'
    ? sitesList
    : sitesList.filter(s => s.project_id === selectedProjectId);

  const selectedProjectName = selectedProjectId === 'ALL'
    ? 'ALL'
    : liveProjects.find((p: any) => p.id === selectedProjectId)?.name;
  const selectedSiteName = selectedSiteId === 'ALL'
    ? 'ALL'
    : availableSites.find((s: any) => s.id === selectedSiteId)?.name;

  // Filter recorders by selected site or project using registry name fields
  const availableStations = selectedSiteId === 'ALL'
    ? (selectedProjectId === 'ALL' ? stationsList : stationsList.filter(st => st.project_name === selectedProjectName))
    : stationsList.filter(st => st.site_name === selectedSiteName);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedSiteId('ALL');
    setSelectedStationId('ALL');
  };

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedStationId('ALL');
  };

  const filteredDetections = detections.filter((det) => {
    const common = det.common_name || '';
    const sci = det.scientific_name || '';
    const matchesSearch = common.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sci.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStation = true;
    if (selectedStationId !== 'ALL') {
      matchesStation = det.recorder_id === selectedStationId || det.station_id === selectedStationId || det.station_name === selectedStationId;
    }

    const matchesConf = (det.confidence || 0) >= minConfidence;
    return matchesSearch && matchesStation && matchesConf;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Live Bioacoustic Detection Recorders</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Realtime acoustic classifications ingested directly from Raspberry Pi field daemons running BirdNET-Pi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Realtime Ingestion Daemon Active
          </span>
        </div>
      </div>

      {/* 3-Level Connected Toolbar */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-3">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Live Scope Filter (Select Project ➔ Site ➔ Recorder Node):</span>
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
              {availableStations.map((st) => (
                <option key={st.recorder_id || st.id} value={st.recorder_id || st.id}>
                  {st.site_name || st.recorder_id} ({st.recorder_id})
                </option>
              ))}
              {/* Also include any live hardware node id in detections */}
              {Array.from(new Set(detections.map(d => d.station_id))).map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
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
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Field Stations</option>
            {stationsList.map((s: any) => (
              <option key={s.recorder_id || s.id} value={s.recorder_id || s.id}>{s.site_name || s.recorder_id} ({s.recorder_id})</option>
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
