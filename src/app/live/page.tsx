'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Search, 
  Play, 
  Pause,
  CheckCircle2, 
  Volume2,
  Filter,
  Activity,
  Sliders,
  Calendar,
  Sparkles,
  Sun,
  Battery,
  Thermometer,
  HardDrive,
  Cpu,
  AlertTriangle,
  ExternalLink,
  Layers,
  ArrowRight
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
    if (d.verification_status === 'NO') return false;
    const key = `${d.recorder_id || d.station_id}|${d.timestamp}|${d.common_name}|${d.scientific_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function LiveDetectionsPage() {
  const { currentRole } = useRole();
  const [searchQuery, setSearchQuery] = useState('');
  
  // 3-level Toolbar States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');
  
  const [minConfidence, setMinConfidence] = useState(0.60);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  const [liveProjects, setLiveProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, any>>({});
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Live Soundscape Stream Player State
  const [liveStreamStation, setLiveStreamStation] = useState<any | null>(null);
  const [isLiveStreamPlaying, setIsLiveStreamPlaying] = useState(false);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function loadLiveData() {
      try {
        const [
          { data: projData },
          { data: recordersData },
          { data: sitesData },
          { data: telemetryData },
          { count: liveCount }
        ] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('name'),
          supabase.from('station_telemetry').select('*').order('ping_time', { ascending: false }).limit(50),
          supabase.from('live_detections').select('*', { count: 'exact', head: true })
        ]);

        const totalCount = liveCount || 0;
        let detData: any[] = [];

        if (totalCount > 0) {
          const pageSize = 1000;
          const numPages = Math.ceil(totalCount / pageSize);
          const chunkPromises = [];
          for (let i = 0; i < numPages; i++) {
            const offset = i * pageSize;
            chunkPromises.push(
              supabase
                .from('live_detections')
                .select('*')
                .order('timestamp', { ascending: false })
                .range(offset, offset + pageSize - 1)
                .then(res => res.data || [])
            );
          }
          const chunks = await Promise.all(chunkPromises);
          detData = chunks.flat();
        }

        const liveProjectIds = new Set((projData || []).map(p => p.id));
        const liveSites = (sitesData || []).filter(s => liveProjectIds.has(s.project_id));
        setLiveProjects(projData || []);

        // Pre-select project from query param
        const queryProject = new URLSearchParams(window.location.search).get('project');
        if (queryProject && liveProjectIds.has(queryProject)) {
          setSelectedProjectId(queryProject);
        }

        const stns = recordersData || [];
        setStationsList(stns);
        if (stns.length > 0 && !liveStreamStation) {
          setLiveStreamStation(stns[0]);
        }
        setSitesList(liveSites);
        setDetections(dedupeDetections(detData || []));

        // Build Telemetry Map
        const tMap: Record<string, any> = {};
        if (telemetryData && telemetryData.length > 0) {
          for (const t of telemetryData) {
            if (!tMap[t.node_id]) tMap[t.node_id] = t;
          }
        }
        setTelemetryMap(tMap);

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

  const toggleLiveStream = () => {
    if (!liveAudioRef.current) return;
    if (isLiveStreamPlaying) {
      liveAudioRef.current.pause();
      setIsLiveStreamPlaying(false);
    } else {
      const publicTunnel = liveStreamStation?.stream_url || (liveStreamStation?.elevation?.startsWith('http') ? liveStreamStation.elevation : null);
      const ip = liveStreamStation?.ip_address || '172.27.78.51';
      const streamSrc = publicTunnel || `http://${ip}:8888/stream.opus`;

      liveAudioRef.current.src = streamSrc;
      liveAudioRef.current.play().then(() => {
        setIsLiveStreamPlaying(true);
      }).catch(err => {
        console.warn('Live stream connection:', err);
        alert(`Cannot connect to live stream at ${streamSrc}. Ensure the edge device is online.`);
        setIsLiveStreamPlaying(false);
      });
    }
  };

  const activeStationTelemetry = selectedStationId !== 'ALL' 
    ? telemetryMap[selectedStationId] 
    : (stationsList.length > 0 ? telemetryMap[stationsList[0]?.recorder_id] : null);

  return (
    <div className="space-y-6 pb-12 font-sans max-w-[1240px] mx-auto px-4 sm:px-6">
      <audio ref={liveAudioRef} onEnded={() => setIsLiveStreamPlaying(false)} />

      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#ffffff] border border-[#dde1dc] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f6f4] border border-[#dde1dc] text-[#1f4d3a] font-mono font-medium text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>REAL-TIME BIOACOUSTIC EDGE NETWORK</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight text-[#1a1f1c]">
            Live Bioacoustic Detection Recorders
          </h1>
          <p className="text-[#5a635d] text-sm max-w-2xl leading-relaxed">
            Real-time vocalization classifications captured by autonomous Raspberry Pi edge sensor nodes running simultaneous multi-model AI (BirdNET TFLite + Custom ONNX classifiers), physical DSP watchdog activity detection, and solar powerbank telemetry.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] text-[#1f4d3a] text-xs font-mono font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Realtime Edge Stream Active</span>
          </div>
        </div>
      </div>

      {/* Live Soundscape Stream Broadcast Player Widget */}
      {stationsList.length > 0 && liveStreamStation && (
        <div className="p-5 md:p-6 rounded-2xl bg-[#1a1f1c] text-[#f5f6f4] border border-[#2d3630] flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-lg">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-400">
                Live Soundscape Broadcast (Port 8888)
              </span>
            </div>
            <h2 className="text-lg font-serif font-semibold text-white">
              Listen Live to Forest Soundscape
            </h2>
            <p className="text-xs text-[#a0aba3] max-w-xl leading-relaxed">
              Connect to the on-demand HTTP Opus audio stream transmitted directly from the microphone array of <strong className="text-white">{liveStreamStation.site_name || liveStreamStation.recorder_id}</strong> ({liveStreamStation.recorder_id}).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={liveStreamStation.recorder_id || ''}
              onChange={(e) => {
                const st = stationsList.find(s => (s.recorder_id || s.id) === e.target.value);
                if (st) {
                  setLiveStreamStation(st);
                  if (isLiveStreamPlaying && liveAudioRef.current && st.ip_address) {
                    liveAudioRef.current.src = `http://${st.ip_address}:8888/stream`;
                    liveAudioRef.current.play();
                  }
                }
              }}
              className="bg-[#121614] border border-[#2d3630] rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 outline-none"
            >
              {stationsList.map((st) => (
                <option key={st.recorder_id || st.id} value={st.recorder_id || st.id}>
                  {st.site_name || st.recorder_id}
                </option>
              ))}
            </select>

            <button
              onClick={toggleLiveStream}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-md ${
                isLiveStreamPlaying
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isLiveStreamPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isLiveStreamPlaying ? 'Stop Live Audio' : 'Listen Live'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hardware & Solar Telemetry Strip */}
      {activeStationTelemetry && (
        <div className="p-4 rounded-xl bg-[#f9faf8] border border-[#dde1dc] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#1f4d3a]" />
            <span className="font-sans font-bold text-[#1a1f1c]">Node Diagnostics:</span>
            <span className="text-[#5a635d]">{activeStationTelemetry.node_id}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[#5a635d]">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Solar Supply:</span>
              <strong className="text-[#1a1f1c]">{activeStationTelemetry.battery_voltage_v?.toFixed(2) || '5.08'} V</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-[#1f4d3a]" />
              <span>CPU Temp:</span>
              <strong className="text-[#1a1f1c]">{activeStationTelemetry.cpu_temp_c?.toFixed(1) || '46.2'} °C</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#1f4d3a]" />
              <span>SD Space:</span>
              <strong className="text-[#1a1f1c]">{activeStationTelemetry.disk_free_gb?.toFixed(1) || '24.8'} GB Free</strong>
            </div>

            {activeStationTelemetry.under_voltage_flag && (
              <span className="text-amber-700 font-sans font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Solar Dip (&lt;4.63V)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3-Level Connected Toolbar */}
      <div className="p-5 rounded-2xl bg-[#ffffff] border border-[#dde1dc] shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1a1f1c] border-b border-[#dde1dc] pb-3">
          <Filter className="w-4 h-4 text-[#1f4d3a]" />
          <span>Scope Filter (Select Project &bull; Site &bull; Recorder Node):</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold text-[#1a1f1c] block mb-1.5">1. Select Live Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2.5 text-[#1a1f1c] font-semibold focus:outline-none focus:border-[#1f4d3a]"
            >
              <option value="ALL">All Live Projects ({liveProjects.length})</option>
              {liveProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-[#1a1f1c] block mb-1.5">2. Select Site</label>
            <select
              value={selectedSiteId}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2.5 text-[#1a1f1c] font-semibold focus:outline-none focus:border-[#1f4d3a]"
            >
              <option value="ALL">All Sites in Project ({availableSites.length})</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-[#1a1f1c] block mb-1.5">3. Select Recorder Node</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2.5 text-[#1a1f1c] font-semibold focus:outline-none focus:border-[#1f4d3a]"
            >
              <option value="ALL">All Hardware Nodes ({availableStations.length})</option>
              {availableStations.map((st) => (
                <option key={st.recorder_id || st.id} value={st.recorder_id || st.id}>
                  {st.site_name || st.recorder_id} ({st.recorder_id})
                </option>
              ))}
              {Array.from(new Set(detections.map(d => d.station_id).filter(Boolean))).map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-white border border-[#dde1dc] shadow-xs flex flex-wrap items-center gap-4 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#5a635d] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by common name or scientific name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl pl-10 pr-3.5 py-2.5 text-[#1a1f1c] placeholder-[#5a635d] focus:outline-none focus:border-[#1f4d3a] font-medium"
          />
        </div>

        <div className="flex items-center gap-3 min-w-[220px]">
          <label className="text-[#5a635d] font-semibold flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-[#1f4d3a]" /> Min Confidence:
          </label>
          <input
            type="range"
            min="0.10"
            max="1.00"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="flex-1 accent-[#1f4d3a] cursor-pointer"
          />
          <span className="font-mono font-bold text-[#1f4d3a] bg-[#f5f6f4] px-2 py-0.5 rounded border border-[#dde1dc]">
            {formatPercent(minConfidence)}
          </span>
        </div>
      </div>

      {/* Detection Cards Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDetections.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-xs text-[#5a635d] bg-white rounded-2xl border border-[#dde1dc]">
            No live detections found matching the selected filters.
          </div>
        ) : (
          filteredDetections.map((det) => (
            <div
              key={det.id}
              className="p-5 rounded-2xl bg-white border border-[#dde1dc] shadow-xs hover:border-[#1f4d3a] transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] text-[#1f4d3a] flex items-center justify-center font-bold group-hover:bg-[#1f4d3a] group-hover:text-white transition">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-[#1a1f1c] group-hover:text-[#1f4d3a] transition">
                      {det.common_name}
                    </h3>
                    <p className="text-xs italic text-[#5a635d]">{det.scientific_name}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {formatPercent(det.confidence)}
                  </span>
                  <span className="text-[10px] font-mono text-[#5a635d] bg-[#f5f6f4] px-1.5 py-0.5 rounded">
                    {det.model_id ? 'Multi-Model' : 'BirdNET TFLite'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#5a635d] p-3 rounded-xl bg-[#f9faf8] border border-[#dde1dc]/80 font-medium">
                <div>
                  Node: <strong className="text-[#1a1f1c]">{det.site_name || det.station_name}</strong>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px] text-[#5a635d]">
                  <Calendar className="w-3.5 h-3.5 text-[#1f4d3a]" /> 
                  <span>{det.time || (det.timestamp ? new Date(det.timestamp).toLocaleTimeString() : 'Recent')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {det.verified ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Expert Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#5a635d] bg-[#f5f6f4] px-2 py-1 rounded-lg border border-[#dde1dc]">
                    Edge AI Inferred
                  </span>
                )}

                <button
                  onClick={() => setSelectedDetection(det)}
                  className="px-4 py-2 rounded-xl bg-[#1f4d3a] hover:bg-[#16382a] text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Listen Audio
                </button>
              </div>
            </div>
          ))
        )}
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
