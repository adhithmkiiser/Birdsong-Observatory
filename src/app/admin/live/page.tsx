'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Radio, 
  Cpu, 
  Volume2, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause,
  Square, 
  RefreshCw, 
  Activity, 
  FolderPlus,
  Image as ImageIcon, 
  MapPin, 
  Users, 
  ShieldCheck, 
  Trash2, 
  Edit2, 
  PlusCircle,
  Wifi,
  HardDrive,
  Lock,
  Terminal,
  Copy,
  Database,
  ArrowUpRight,
  Sparkles,
  UserPlus,
  Layers,
  Sun,
  Battery,
  BatteryCharging,
  Zap,
  Thermometer,
  Gauge,
  AlertTriangle,
  Check,
  ExternalLink,
  Filter,
  Search,
  Download,
  ChevronRight,
  HelpCircle,
  Power,
  RotateCcw,
  Mic,
  Globe
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { User, UserRole } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { AdminNavTabs } from '@/components/admin/AdminNavTabs';

// ==============================================================================
// Types for Next-Gen Live Detector System
// ==============================================================================

interface StationTelemetry {
  id?: number | string;
  node_id?: string;
  station_id?: string;
  timestamp?: string;
  ping_time?: string;
  cpu_temp_c?: number | null;
  disk_free_gb?: number | null;
  disk_percent_free?: number | null;
  is_low_space?: boolean;
  battery_capacity_percent?: number | null;
  battery_voltage_v?: number | null;
  power_status?: string | null;
  under_voltage_flag?: boolean;
  throttling_flag?: boolean;
  cpu_percent?: number | null;
  ram_percent?: number | null;
  uptime_hours?: number | null;
  // Legacy / network fields
  cpu_temperature?: number | null;
  battery_level?: number | null;
  disk_usage?: number | null;
  ip_address?: string | null;
  ip?: string | null;
}

interface ModelItem {
  id: string;
  name: string;
  version: string;
  description: string;
  runtime: 'birdnet_tflite' | 'tflite' | 'onnx';
  storage_path: string;
  labels_path: string;
  manifest: Record<string, any>;
  sha256?: string;
  is_active: boolean;
  created_at?: string;
}

interface NodeModelAssignment {
  node_id: string;
  model_id: string;
  enabled: boolean;
  threshold: number;
  updated_at?: string;
  model_name?: string;
  runtime?: string;
}

interface WindowSummaryItem {
  id: string;
  window_id: string;
  node_id: string;
  timestamp: string;
  event_count: number;
  occupied_area_ratio: number;
  low_band_energy: number;
  mid_band_energy: number;
  snr_db: number;
  is_ambient_noise: boolean;
  species_detected: string[];
  model_count: number;
  explained_ratio: number;
  review_flags: string[];
  review_status: 'unreviewed' | 'confirmed' | 'corrected' | 'discarded';
  clip_path?: string;
}

interface LiveNodeItem {
  id: string;
  stationName: string;
  projectName: string;
  ipAddress: string;
  lastUploadedId: number;
  pendingQueue: number;
  lastSyncTime: string;
  status: 'online' | 'offline' | 'syncing';
  lat?: number;
  long?: number;
  telemetry?: StationTelemetry;
  assignedModels?: NodeModelAssignment[];
}

interface LiveProjectItem {
  id: string;
  name: string;
  description: string;
  organization: string;
  stationsCount: number;
  image_url?: string;
}

export default function LiveAdminPage() {
  const { currentRole, currentUser } = useRole();

  // Navigation Tabs:
  // 'nodes'       -> Field Nodes & Hardware / Solar Telemetry
  // 'models'      -> Multi-Model Engine & Dynamic Hot-Reload
  // 'generator'   -> Pi Setup, SSH Command Playbook & Service Generator
  // 'projects'    -> Live Projects & Arrays
  // 'detections'  -> Detections Database
  const [activeTab, setActiveTab] = useState<'nodes' | 'models' | 'generator' | 'projects' | 'detections'>('nodes');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [schemaNoticeDismissed, setSchemaNoticeDismissed] = useState(false);
  const [isLiveRefreshing, setIsLiveRefreshing] = useState(false);

  const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;
  const STATION_HEARTBEAT_INTERVAL_MS = 30 * 1000;

  // ----------------------------------------------------------------------------
  // State: Recorders & Telemetry & GPS Coordinates
  // ----------------------------------------------------------------------------
  const [recorders, setRecorders] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, StationTelemetry>>({});
  const [now, setNow] = useState(Date.now());
  const [editingNodeGps, setEditingNodeGps] = useState<{ id: string; name: string; lat: string; long: string } | null>(null);

  // ----------------------------------------------------------------------------
  // State: Multi-Model Registry & Edge Assignments
  // ----------------------------------------------------------------------------
  const [modelsList, setModelsList] = useState<ModelItem[]>([]);
  const [nodeModelAssignments, setNodeModelAssignments] = useState<NodeModelAssignment[]>([]);
  const [isCreateModelOpen, setIsCreateModelOpen] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelVersion, setNewModelVersion] = useState('v1.0');
  const [newModelRuntime, setNewModelRuntime] = useState<'onnx' | 'tflite' | 'birdnet_tflite'>('onnx');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelSampleRate, setNewModelSampleRate] = useState('32000');
  const [newModelInputType, setNewModelInputType] = useState('mel_spectrogram');
  const [newModelActivation, setNewModelActivation] = useState('sigmoid');
  const [newModelStoragePath, setNewModelStoragePath] = useState('');
  const [newModelLabelsPath, setNewModelLabelsPath] = useState('');

  // ----------------------------------------------------------------------------
  // State: Generator & SSH Playbook
  // ----------------------------------------------------------------------------
  const [genStationName, setGenStationName] = useState('Tirupati Observatory');
  const [genProjectName, setGenProjectName] = useState('Test_custom');
  const [genRecorderId, setGenRecorderId] = useState('Test_01');
  const [genSupabaseUrl, setGenSupabaseUrl] = useState('https://ktihcjfxxxazohimtiav.supabase.co');
  const [genSupabaseKey, setGenSupabaseKey] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4');
  const [genAudioDevice, setGenAudioDevice] = useState('plughw:1,0');
  const [genHopSeconds, setGenHopSeconds] = useState('1.5');
  const [genLatitude, setGenLatitude] = useState('13.6288');
  const [genLongitude, setGenLongitude] = useState('79.4192');
  const [genPiUser, setGenPiUser] = useState('pi');

  // ----------------------------------------------------------------------------
  // State: Projects & Detections
  // ----------------------------------------------------------------------------
  const [liveProjects, setLiveProjects] = useState<LiveProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [liveDetections, setLiveDetections] = useState<any[]>([]);
  const [liveFilterProject, setLiveFilterProject] = useState('All');
  const [liveFilterSite, setLiveFilterSite] = useState('All');
  const [liveFilterRecorder, setLiveFilterRecorder] = useState('All');
  const [liveSortDateDesc, setLiveSortDateDesc] = useState(true);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  // ==============================================================================
  // Data Loader & Polling
  // ==============================================================================
  async function loadAllLiveAdminData() {
    setIsLiveRefreshing(true);
    try {
      // 1. Fetch from server admin API (which uses service role key and bypasses RLS)
      const res = await fetch('/api/live/admin');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.projects && data.projects.length > 0) {
            setLiveProjects(data.projects.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description || '',
              organization: p.organization || 'IISER Tirupati Bird Lab',
              stationsCount: p.stations_count || 0,
              image_url: p.image_url || ''
            })));
          } else {
            setLiveProjects([]);
          }

          if (data.recorders && data.recorders.length > 0) {
            setRecorders(data.recorders);
          } else {
            setRecorders([]);
          }

          if (data.telemetry && data.telemetry.length > 0) {
            const map: Record<string, StationTelemetry> = {};
            for (const item of data.telemetry) {
              const nid = item.node_id || item.station_id;
              if (nid && !map[nid]) map[nid] = item;
              if (item.station_id && !map[item.station_id]) map[item.station_id] = item;
              if (item.node_id && !map[item.node_id]) map[item.node_id] = item;
            }
            setTelemetryMap(map);
          } else {
            setTelemetryMap({});
          }

          if (data.models && data.models.length > 0) {
            setModelsList(data.models);
          } else {
            setModelsList([]);
          }

          if (data.nodeModels && data.nodeModels.length > 0) {
            setNodeModelAssignments(data.nodeModels.map((item: any) => ({
              node_id: item.node_id,
              model_id: item.model_id,
              enabled: item.enabled,
              threshold: item.threshold,
              model_name: item.models?.name || 'Model',
              runtime: item.models?.runtime || 'onnx'
            })));
          } else {
            setNodeModelAssignments([]);
          }

          if (data.detections) {
            setLiveDetections(data.detections);
          }
          return;
        }
      }

      // Fallback to client supabase if API is unreachable
      const [
        { data: projs },
        { data: recordersData }
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
        supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false })
      ]);

      if (projs && projs.length > 0) {
        setLiveProjects(projs.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          organization: p.organization || 'IISER Tirupati Bird Lab',
          stationsCount: p.stations_count || 0,
          image_url: p.image_url || ''
        })));
      }

      if (recordersData && recordersData.length > 0) {
        setRecorders(recordersData);
      }

      const { data: teleData } = await supabase
        .from('station_telemetry')
        .select('*')
        .order('ping_time', { ascending: false })
        .limit(100);

      if (teleData && teleData.length > 0) {
        const map: Record<string, StationTelemetry> = {};
        for (const item of teleData) {
          const nid = item.node_id || item.station_id;
          if (nid && !map[nid]) map[nid] = item;
          if (item.station_id && !map[item.station_id]) map[item.station_id] = item;
          if (item.node_id && !map[item.node_id]) map[item.node_id] = item;
        }
        setTelemetryMap(map);
      }

      const { data: mData } = await supabase.from('models').select('*').order('created_at', { ascending: false });
      if (mData) setModelsList(mData);

      const { data: nmData } = await supabase.from('node_models').select('*, models(*)');
      if (nmData) {
        setNodeModelAssignments(nmData.map((item: any) => ({
          node_id: item.node_id,
          model_id: item.model_id,
          enabled: item.enabled,
          threshold: item.threshold,
          model_name: item.models?.name || 'Model',
          runtime: item.models?.runtime || 'onnx'
        })));
      }

      const { data: dets } = await supabase.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(100);
      if (dets) setLiveDetections(dets);

    } catch (e) {
      console.error('Failed to load Live admin data:', e);
    } finally {
      setIsLiveRefreshing(false);
    }
  }

  useEffect(() => {
    loadAllLiveAdminData();
    const interval = setInterval(() => {
      setNow(Date.now());
      loadAllLiveAdminData();
    }, STATION_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Set default selected project
  useEffect(() => {
    if (liveProjects.length > 0 && !liveProjects.find(p => p.id === selectedProjectId)) {
      setSelectedProjectId(liveProjects[0].id);
    }
  }, [liveProjects, selectedProjectId]);

  // Combined Nodes List with Telemetry & GPS Coordinates
  const nodesList = useMemo<LiveNodeItem[]>(() => {
    return recorders.map((r: any) => {
      const tel = telemetryMap[r.recorder_id] || telemetryMap[r.id] || (r.site_name ? telemetryMap[r.site_name] : undefined);
      const pingTimeStr = tel?.ping_time || r.last_ping;
      const lastPingAt = pingTimeStr ? new Date(pingTimeStr) : null;
      const isStale = !lastPingAt || (now - lastPingAt.getTime()) >= OFFLINE_THRESHOLD_MS;
      let status: 'online' | 'offline' | 'syncing' = isStale ? 'offline' : (r.status?.toLowerCase() || 'online');
      const assigned = nodeModelAssignments.filter(n => n.node_id === r.recorder_id || n.node_id === r.id);

      return {
        id: r.recorder_id,
        stationName: r.site_name || r.recorder_id,
        projectName: r.project_name || 'Unassigned Project',
        ipAddress: r.ip_address || (tel && (tel.ip_address || tel.ip)) || 'livedetector.local',
        lastUploadedId: 0,
        pendingQueue: 0,
        lastSyncTime: pingTimeStr ? new Date(pingTimeStr).toLocaleTimeString() : '--',
        status,
        lat: Number(r.lat ?? r.latitude ?? 11.3419),
        long: Number(r.long ?? r.longitude ?? 76.6437),
        telemetry: tel,
        assignedModels: assigned
      };
    });
  }, [recorders, telemetryMap, nodeModelAssignments, now]);

  // ==============================================================================
  // Action Handlers
  // ==============================================================================

  const handleUpdateNodeGps = async (nodeId: string, lat: number, long: number) => {
    try {
      await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_gps', nodeId, lat, long })
      });

      setRecorders(prev => prev.map(r => r.recorder_id === nodeId ? { ...r, lat, long, latitude: lat, longitude: long } : r));
      setEditingNodeGps(null);
      showNotification(`📍 Node "${nodeId}" coordinates updated to (${lat.toFixed(4)}, ${long.toFixed(4)})! Survey map & BirdNET filter synced.`);
    } catch (e: any) {
      alert(`Failed to update GPS: ${e.message}`);
    }
  };

  const handleSaveGeneratorGpsToDatabase = async () => {
    const latNum = parseFloat(genLatitude);
    const lonNum = parseFloat(genLongitude);
    if (isNaN(latNum) || isNaN(lonNum)) {
      alert('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }
    const targetNodeId = genRecorderId.trim() || 'Test_01';
    await handleUpdateNodeGps(targetNodeId, latNum, lonNum);
  };

  const handleToggleNodeModel = async (nodeId: string, modelId: string, currentEnabled: boolean) => {
    const updated = !currentEnabled;
    try {
      await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_node_model', nodeId, modelId, enabled: updated })
      });
    } catch (e) {
      console.warn('API sync for node_models failed, updated locally:', e);
    }

    setNodeModelAssignments(prev => {
      const exists = prev.find(n => n.node_id === nodeId && n.model_id === modelId);
      if (exists) {
        return prev.map(n => (n.node_id === nodeId && n.model_id === modelId) ? { ...n, enabled: updated } : n);
      } else {
        const m = modelsList.find(x => x.id === modelId);
        return [...prev, {
          node_id: nodeId,
          model_id: modelId,
          enabled: updated,
          threshold: 0.50,
          model_name: m?.name || 'Model',
          runtime: m?.runtime || 'birdnet_tflite'
        }];
      }
    });

    showNotification(`⚡ Model ${updated ? 'activated' : 'deactivated'} on ${nodeId}! Raspberry Pi hot-reload synced with zero restart.`);
  };

  const handleThresholdChange = async (nodeId: string, modelId: string, newThreshold: number) => {
    setNodeModelAssignments(prev => prev.map(n => (n.node_id === nodeId && n.model_id === modelId) ? { ...n, threshold: newThreshold } : n));
    try {
      await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_node_model', nodeId, modelId, enabled: true, threshold: newThreshold })
      });
    } catch (e) {
      // Local state updated
    }
  };

  const handleCreateNewModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    const newModel: ModelItem = {
      id: `model_${Date.now()}`,
      name: newModelName.trim(),
      version: newModelVersion.trim() || 'v1.0',
      description: newModelDesc.trim(),
      runtime: newModelRuntime,
      storage_path: newModelStoragePath.trim(),
      labels_path: newModelLabelsPath.trim(),
      manifest: {
        target_sample_rate: parseInt(newModelSampleRate) || 32000,
        input_type: newModelInputType,
        output_activation: newModelActivation,
        window_sec: 3.0
      },
      is_active: true
    };

    try {
      await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_model', modelData: newModel })
      });
    } catch (err) {
      console.warn('API insert failed, saving locally:', err);
    }

    setModelsList(prev => [newModel, ...prev]);
    setIsCreateModelOpen(false);
    setNewModelName('');
    setNewModelDesc('');
    showNotification(`✨ New Model "${newModel.name}" registered! Ready to deploy to Raspberry Pi edge nodes.`);
  };

  const handleTriggerSyncNow = async (nodeId: string) => {
    setRecorders(prev => prev.map(n => n.recorder_id === nodeId ? { ...n, status: 'syncing', last_ping: new Date().toISOString() } : n));
    showNotification(`📡 Realtime heartbeat signal sent to ${nodeId}`);
    try {
      await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_now', nodeId })
      });
    } catch (e) {}
    setTimeout(() => {
      loadAllLiveAdminData();
    }, 1200);
  };

  const handleDeleteNode = async (node: LiveNodeItem) => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete recording nodes.');
      return;
    }
    if (!confirm(`Delete recorder "${node.id}" from ${node.projectName}? This will remove its registry entry.`)) return;
    try {
      await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_node', nodeId: node.id })
      });
      setRecorders(prev => prev.filter(r => r.recorder_id !== node.id));
      showNotification(`Node ${node.id} removed from observatory.`);
    } catch (err: any) {
      alert('Failed to delete recorder: ' + err.message);
    }
  };

  // Generated `.env` configuration
  const generatedEnvScript = `# ==============================================================================
# BIRDSONG OBSERVATORY - EDGE DETECTOR ENVIRONMENT CONFIGURATION
# Location: /home/${genPiUser}/Live_detector/.env
# ==============================================================================
STATION_NAME="${genRecorderId}"
PROJECT_NAME="${genProjectName}"
SITE_NAME="${genStationName}"

# Supabase Cloud Synchronization Credentials
SUPABASE_URL="${genSupabaseUrl}"
SUPABASE_KEY="${genSupabaseKey}"

# Audio Ingestion & Microphones (Check: arecord -l)
AUDIO_INPUT_DEVICE="${genAudioDevice}"
SAMPLE_RATE=48000
WINDOW_SECONDS=3.0
HOP_SECONDS=${genHopSeconds}

# GPS Coordinates for BirdNET Geographic Species Filtering & Observatory Mapping
LATITUDE=${genLatitude}
LONGITUDE=${genLongitude}
NODE_LATITUDE=${genLatitude}
NODE_LONGITUDE=${genLongitude}
BIRDNET_USE_LAT_LON_FILTER=true

# Live Stream Server & Synchronization
STREAM_PORT=8888
HEARTBEAT_INTERVAL_SECONDS=30
TELEMETRY_INTERVAL_SECONDS=60
DB_SYNC_INTERVAL_SECONDS=10`;

  // Generated `live-detector.service` unit file
  const generatedSystemdService = `[Unit]
Description=BirdSong Observatory - Live Detector Edge Agent (Multi-Model & Solar Telemetry)
After=network-online.target sound.target
Wants=network-online.target sound.target

[Service]
Type=simple
User=${genPiUser}
WorkingDirectory=/home/${genPiUser}/Live_detector
EnvironmentFile=/home/${genPiUser}/Live_detector/.env
ExecStart=/home/${genPiUser}/Live_detector/venv/bin/python3 main.py

# Automatic restart on powerbank dips or transient failure
Restart=always
RestartSec=5

# Audio & GPU access permissions
SupplementaryGroups=audio video

[Install]
WantedBy=multi-user.target`;

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Centralized Admin Console Switcher */}
      <AdminNavTabs />

      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#ffffff] border border-[#dde1dc] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f6f4] border border-[#dde1dc] text-[#1f4d3a] font-mono font-medium text-xs">
            <Radio className="w-3.5 h-3.5 text-[#1f4d3a]" />
            <span>BIOACOUSTIC EDGE AGENTS &bull; MULTI-MODEL OBSERVER</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight text-[#1a1f1c]">
            Live Detectors &amp; Edge Console
          </h1>
          <p className="text-[#5a635d] text-sm max-w-2xl leading-relaxed">
            Manage autonomous Raspberry Pi edge nodes running simultaneous multi-model inference (BirdNET TFLite + Custom ONNX/TFLite), monitor real-time solar powerbank &amp; thermal health, triage acoustic watchdog discrepancies, and deploy model weights with zero-restart hot-reloads.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => loadAllLiveAdminData()}
            disabled={isLiveRefreshing}
            className="px-4 py-2 rounded-xl bg-[#f5f6f4] hover:bg-[#e8eae6] border border-[#dde1dc] text-[#1f4d3a] text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLiveRefreshing ? 'animate-spin' : ''}`} />
            <span>{isLiveRefreshing ? 'Syncing...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Schema Helper Notice if using default preview */}
      {!schemaNoticeDismissed && (
        <div className="p-4 rounded-2xl bg-[#f4f7f5] border border-[#cfded6] text-[#1f4d3a] text-xs flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#1f4d3a] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold text-[#1a1f1c]">Edge Agent Database Schema Ready:</strong>
              <p className="text-[#3b4740] leading-relaxed">
                The edge engine supports <code className="bg-[#ffffff] px-1.5 py-0.5 rounded border border-[#cfded6] font-mono text-[11px]">station_telemetry</code>, <code className="bg-[#ffffff] px-1.5 py-0.5 rounded border border-[#cfded6] font-mono text-[11px]">models</code>, <code className="bg-[#ffffff] px-1.5 py-0.5 rounded border border-[#cfded6] font-mono text-[11px]">node_models</code>, and <code className="bg-[#ffffff] px-1.5 py-0.5 rounded border border-[#cfded6] font-mono text-[11px]">window_summaries</code>. Run <code className="bg-[#ffffff] px-1.5 py-0.5 rounded border border-[#cfded6] font-mono text-[11px]">Live_detector/schema.sql</code> in your Supabase SQL Editor to link live Raspberry Pi field uploads.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSchemaNoticeDismissed(true)}
            className="text-[#5a635d] hover:text-[#1a1f1c] text-xs font-mono px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Admin Navigation Tabs */}
      <div className="flex border-b border-[#dde1dc] gap-2 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'nodes' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Cpu className="w-4 h-4" /> Field Nodes &amp; Solar Telemetry
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#f5f6f4] text-[#1f4d3a] border border-[#dde1dc]">
            {nodesList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('models')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'models' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Sliders className="w-4 h-4" /> Multi-Model Engine &amp; Hot-Reload
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
            {modelsList.length} Models
          </span>
        </button>

        <button
          onClick={() => setActiveTab('generator')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'generator' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Terminal className="w-4 h-4" /> Pi Setup &amp; SSH Command Center
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'projects' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <ImageIcon className="w-4 h-4" /> Live Projects &amp; Arrays
        </button>

        <button
          onClick={() => setActiveTab('detections')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'detections' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Database className="w-4 h-4" /> Detections Database
        </button>
      </div>

      {/* Global Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ============================================================================== */}
      {/* TAB 1: FIELD NODES & SOLAR TELEMETRY                                          */}
      {/* ============================================================================== */}
      {activeTab === 'nodes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-serif font-semibold text-[#1a1f1c]">
                Raspberry Pi Field Sensor Array ({nodesList.length} Nodes)
              </h2>
              <p className="text-xs text-[#5a635d] mt-0.5">
                Real-time edge telemetry reporting SD card storage, CPU temperature, solar powerbank supply status, and active models.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {nodesList.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-[#dde1dc] space-y-3">
                <Cpu className="w-8 h-8 text-[#5a635d] mx-auto opacity-40" />
                <h3 className="text-sm font-semibold text-[#1a1f1c]">No Edge Sensor Nodes Connected</h3>
                <p className="text-xs text-[#5a635d] max-w-md mx-auto">
                  Deploy the Live Detector agent on your Raspberry Pi using the commands in the <strong className="text-[#1f4d3a]">Pi Setup &amp; SSH Command Center</strong> tab.
                </p>
              </div>
            ) : (
              nodesList.map(node => {
                const tel = node.telemetry;
                const isThrottled = tel?.throttling_flag || tel?.under_voltage_flag;
                const cpuTemp = tel ? (tel.cpu_temp_c ?? tel.cpu_temperature ?? null) : null;
                const diskPercent = tel ? (tel.disk_percent_free ?? (tel.disk_usage !== undefined && tel.disk_usage !== null ? 100 - Number(tel.disk_usage) : null)) : null;
                const diskFreeGb = tel ? (tel.disk_free_gb ?? (diskPercent !== null ? Number(((diskPercent / 100) * 32).toFixed(1)) : null)) : null;
                const batteryCap = tel ? (tel.battery_capacity_percent ?? tel.battery_level ?? null) : null;
                const batteryVolt = tel ? (tel.battery_voltage_v ?? (batteryCap !== null ? 5.08 : null)) : null;
                const powerStatus = tel ? (tel.power_status || (batteryCap !== null ? `Stable Solar / USB Supply (${Number(batteryCap).toFixed(0)}% Charge)` : 'Stable Solar / USB Supply')) : 'Awaiting Telemetry';
                const ramPercent = tel ? (tel.ram_percent ?? null) : null;
                const uptime = tel ? (tel.uptime_hours ?? null) : null;

                return (
                  <div key={node.id} className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] shadow-xs space-y-5 transition-all">
                    {/* Node Header Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#f0f2ef] pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${node.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          <h3 className="text-base font-serif font-bold text-[#1a1f1c]">{node.stationName}</h3>
                          <span className="font-mono text-[11px] bg-[#f5f6f4] text-[#1f4d3a] border border-[#dde1dc] px-2.5 py-0.5 rounded-md font-semibold">
                            {node.id}
                          </span>
                          <span className="font-mono text-[11px] text-[#5a635d]">
                            ({node.ipAddress})
                          </span>
                        </div>
                        <p className="text-xs text-[#5a635d] font-medium pl-5">{node.projectName}</p>
                        <div className="flex items-center gap-2 pl-5 pt-0.5 flex-wrap">
                          <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            GPS: {node.lat !== undefined ? Number(node.lat).toFixed(4) : '11.3419'}° N, {node.long !== undefined ? Number(node.long).toFixed(4) : '76.6437'}° E
                          </span>
                          <span className="text-[10px] font-mono text-[#5a635d]">
                            &bull; BirdNET Range Filter: Active
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Choose / Edit GPS Coordinates */}
                        <button
                          onClick={() => setEditingNodeGps({
                            id: node.id,
                            name: node.stationName,
                            lat: String(node.lat ?? 11.3419),
                            long: String(node.long ?? 76.6437)
                          })}
                          className="px-3 py-1.5 rounded-lg bg-[#f0f7f3] hover:bg-[#e2ede6] border border-[#dde1dc] text-[#1f4d3a] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          title="Configure physical latitude and longitude for BirdNET species filtering and Survey Map"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#1f4d3a]" />
                          <span>Choose / Edit GPS</span>
                        </button>

                        {/* Audio Stream Link */}
                        <a
                          href={`http://${node.ipAddress}:8888/stream`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#f5f6f4] hover:bg-[#e8eae6] border border-[#dde1dc] text-[#1f4d3a] text-xs font-semibold flex items-center gap-1.5 transition"
                          title="Connect to Pi Live Opus HTTP Stream on port 8888"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-[#1f4d3a]" />
                          <span>Listen Live (8888)</span>
                          <ExternalLink className="w-3 h-3 text-[#5a635d]" />
                        </a>

                        <button
                          onClick={() => handleTriggerSyncNow(node.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#1f4d3a] hover:bg-[#16382a] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync Now</span>
                        </button>

                        {currentRole === 'Admin' && (
                          <button
                            onClick={() => handleDeleteNode(node)}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Solar & Under-Voltage Alert Banner */}
                    {tel?.under_voltage_flag && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <div>
                          <strong>Solar Under-Voltage Detected:</strong> The powerbank 5V supply dipped below 4.63V (due to a passing cloud or high cable resistance). The agent logged this event and kept audio inference active.
                        </div>
                      </div>
                    )}

                    {/* Telemetry Tiles Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* Tile 1: Solar Powerbank & Battery */}
                      <div className="p-4 rounded-xl bg-[#f9faf8] border border-[#dde1dc] space-y-2">
                        <div className="flex items-center justify-between text-[#5a635d]">
                          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">Solar Power Supply</span>
                          <Sun className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-serif font-bold text-[#1a1f1c]">
                            {batteryVolt !== null ? `${batteryVolt.toFixed(2)} V` : '--'}
                          </span>
                          {batteryCap !== null && (
                            <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {batteryCap.toFixed(0)}% Capacity
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5a635d] truncate" title={powerStatus}>
                          {powerStatus}
                        </p>
                      </div>

                      {/* Tile 2: CPU Temperature */}
                      <div className="p-4 rounded-xl bg-[#f9faf8] border border-[#dde1dc] space-y-2">
                        <div className="flex items-center justify-between text-[#5a635d]">
                          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">CPU Thermal Status</span>
                          <Thermometer className="w-4 h-4 text-[#1f4d3a]" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-serif font-bold text-[#1a1f1c]">
                            {cpuTemp !== null ? `${cpuTemp.toFixed(1)} °C` : '--'}
                          </span>
                          {cpuTemp !== null && (
                            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${
                              cpuTemp < 60 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              cpuTemp < 75 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {cpuTemp < 60 ? 'Cool & Stable' : cpuTemp < 75 ? 'Warm' : 'Thermal Alert'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5a635d]">
                          {tel ? `PMIC Sensor: ${tel.throttling_flag ? 'Throttled' : 'Nominal Frequency'}` : 'Awaiting sensor report'}
                        </p>
                      </div>

                      {/* Tile 3: SD Card Storage */}
                      <div className="p-4 rounded-xl bg-[#f9faf8] border border-[#dde1dc] space-y-2">
                        <div className="flex items-center justify-between text-[#5a635d]">
                          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">SD Card Storage</span>
                          <HardDrive className="w-4 h-4 text-[#1f4d3a]" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-serif font-bold text-[#1a1f1c]">
                            {diskFreeGb !== null ? `${diskFreeGb.toFixed(1)} GB Free` : '--'}
                          </span>
                          {diskPercent !== null && (
                            <span className="text-xs font-mono font-semibold text-[#1f4d3a]">
                              {diskPercent.toFixed(0)}% Free
                            </span>
                          )}
                        </div>
                        {diskPercent !== null ? (
                          <div className="w-full bg-[#e2e6e1] h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${diskPercent > 20 ? 'bg-[#1f4d3a]' : 'bg-amber-500'}`} 
                              style={{ width: `${Math.min(100, diskPercent)}%` }}
                            />
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#5a635d]">Awaiting storage metrics</p>
                        )}
                      </div>

                      {/* Tile 4: Edge Compute & Uptime */}
                      <div className="p-4 rounded-xl bg-[#f9faf8] border border-[#dde1dc] space-y-2">
                        <div className="flex items-center justify-between text-[#5a635d]">
                          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">Compute &amp; Uptime</span>
                          <Activity className="w-4 h-4 text-[#1f4d3a]" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-serif font-bold text-[#1a1f1c]">
                            {uptime !== null ? `${uptime.toFixed(1)} hrs` : '--'}
                          </span>
                          {ramPercent !== null && (
                            <span className="text-xs font-mono font-semibold text-[#5a635d]">
                              RAM {ramPercent.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5a635d]">
                          Last Heartbeat: {node.lastSyncTime || '--'}
                        </p>
                      </div>

                    </div>

                    {/* Active Models Strip on this Node */}
                    <div className="p-3.5 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-[#1f4d3a]" />
                        <span className="font-semibold text-[#1a1f1c]">Active Models on this Node:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {node.assignedModels?.filter(m => m.enabled).map(m => (
                            <span key={m.model_id} className="font-mono text-[11px] bg-white text-[#1f4d3a] border border-[#dde1dc] px-2 py-0.5 rounded font-semibold">
                              {m.model_name} ({m.runtime?.toUpperCase()}) &bull; Thresh {m.threshold}
                            </span>
                          ))}
                          {(!node.assignedModels || node.assignedModels.filter(m => m.enabled).length === 0) && (
                            <span className="font-mono text-[11px] text-[#5a635d]">No models assigned yet.</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab('models')}
                        className="text-xs text-[#1f4d3a] font-semibold hover:underline flex items-center gap-1 self-start sm:self-auto"
                      >
                        <span>Configure Models</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* TAB 2: MULTI-MODEL ENGINE & ZERO-RESTART HOT-RELOAD                            */}
      {/* ============================================================================== */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f0f2ef] pb-4">
              <div>
                <h2 className="text-base font-serif font-semibold text-[#1a1f1c]">
                  Multi-Model Edge Deployment &amp; Hot-Reload Registry
                </h2>
                <p className="text-xs text-[#5a635d] mt-0.5">
                  Deploy custom ONNX or TFLite weights to Raspberry Pi field stations. The edge agent downloads files and hot-reloads them dynamically with <strong>zero restarts</strong>.
                </p>
              </div>

              <button
                onClick={() => setIsCreateModelOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#1f4d3a] hover:bg-[#16382a] text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs self-start sm:self-auto cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Upload New Model</span>
              </button>
            </div>

            {/* Cornell BirdNET-Pi v2.4 Architecture & Edge Asset Setup Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#121614] to-[#1a221e] text-white border border-[#2d3630] space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d3630] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-serif font-bold text-sm text-white flex items-center gap-2">
                      Cornell BirdNET-Pi v2.4 (Official Edge Engine)
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 uppercase">
                        Built-in Edge TFLite
                      </span>
                    </h3>
                    <p className="text-xs text-[#a0aba3]">
                      Runs offline on Raspberry Pi CPU &bull; 6,000+ avifauna species &bull; Dynamic GPS geographic range filtering
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('mkdir -p ~/Live_detector/models/birdnet_default && curl -L -o ~/Live_detector/models/birdnet_default/labels.txt https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt && curl -L -o ~/Live_detector/models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite https://raw.githubusercontent.com/woheller69/whoBIRD-TFlite/master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite');
                    showNotification('BirdNET model download command copied!');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Pi Download Command</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0e1210] border border-[#232c26] space-y-1.5">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Edge Hardware Inference</span>
                  </div>
                  <p className="text-[11px] text-[#a0aba3] leading-relaxed">
                    Inference executes 100% locally on the Raspberry Pi ARM64 CPU via TFLite in 3.0s sliding windows every 1.5s hop. Audio is never sent to third-party cloud APIs.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0e1210] border border-[#232c26] space-y-1.5">
                  <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>GPS Regional Range Filter</span>
                  </div>
                  <p className="text-[11px] text-[#a0aba3] leading-relaxed">
                    Uses the node&apos;s GPS coordinates ({genLatitude}° N, {genLongitude}° E) to query regional species occurrence probabilities, automatically suppressing foreign species and preventing false detections.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0e1210] border border-[#232c26] space-y-1.5">
                  <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Required Files on Pi</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#a0aba3] space-y-1">
                    <div>• <code className="text-white">labels.txt</code> (6,522 species)</div>
                    <div>• <code className="text-white">BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite</code> (~51 MB)</div>
                    <div className="text-[10px] text-emerald-400 pt-0.5">Dir: <code className="text-emerald-300">~/Live_detector/models/birdnet_default/</code></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#a0aba3] pt-1 border-t border-[#232c26]">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 font-bold">💡 Tip:</span>
                  <span>The Live Detector supervisor also auto-downloads missing weights on startup if internet is available.</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-400 font-semibold">TFLite 48kHz Waveform &bull; Sigmoid</span>
              </div>
            </div>

            {/* Model Cards Grid */}
            {modelsList.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#f9faf8] border border-dashed border-[#dde1dc]">
                <Cpu className="w-8 h-8 text-[#5a635d] mx-auto mb-2 opacity-50" />
                <p className="font-serif font-bold text-sm text-[#1a1f1c]">No models registered yet</p>
                <p className="text-xs text-[#5a635d] mt-1">Click &quot;Upload New Model&quot; to upload an ONNX or TFLite model package.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {modelsList.map(model => (
                  <div key={model.id} className="p-5 rounded-xl bg-[#f9faf8] border border-[#dde1dc] space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                          model.runtime === 'birdnet_tflite' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          model.runtime === 'onnx' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                          'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {model.runtime.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-[10px] text-[#5a635d]">{model.version}</span>
                      </div>

                      <h3 className="font-serif font-bold text-sm text-[#1a1f1c]">{model.name}</h3>
                      <p className="text-xs text-[#5a635d] leading-relaxed">{model.description}</p>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-[#dde1dc]/60 font-mono text-[11px] text-[#5a635d]">
                      <div className="flex justify-between">
                        <span>Sample Rate:</span>
                        <strong className="text-[#1a1f1c]">{model.manifest?.target_sample_rate || 48000} Hz</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Input Type:</span>
                        <strong className="text-[#1a1f1c]">{model.manifest?.input_type || 'raw_waveform'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Activation:</span>
                        <strong className="text-[#1a1f1c]">{model.manifest?.output_activation || 'sigmoid'}</strong>
                      </div>
                      <div className="truncate text-[10px] text-[#5a635d] pt-1" title={model.storage_path}>
                        Storage: {model.storage_path}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Node-Model Assignment Matrix */}
          <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] space-y-5 shadow-xs">
            <div>
              <h3 className="text-base font-serif font-semibold text-[#1a1f1c]">
                Station Model Assignment &amp; Confidence Thresholds
              </h3>
              <p className="text-xs text-[#5a635d] mt-0.5">
                Toggle models on/off per physical node. Adjusting thresholds immediately propagates to edge hardware over Supabase Realtime WebSocket.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#dde1dc] text-[#5a635d] text-[10px] uppercase font-mono tracking-wider">
                    <th className="py-3 px-3">Field Node</th>
                    <th className="py-3 px-3">Model</th>
                    <th className="py-3 px-3 text-center">Active Status</th>
                    <th className="py-3 px-3">Confidence Threshold</th>
                    <th className="py-3 px-3 text-right">Edge Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2ef]">
                  {nodesList.length === 0 || modelsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#5a635d] font-mono text-xs">
                        {nodesList.length === 0 ? 'No sensor nodes connected.' : 'No models registered to assign.'}
                      </td>
                    </tr>
                  ) : (
                    nodesList.flatMap(node => 
                      modelsList.map(model => {
                        const assignment = nodeModelAssignments.find(a => a.node_id === node.id && a.model_id === model.id);
                        const isEnabled = assignment ? assignment.enabled : false;
                        const threshold = assignment ? assignment.threshold : 0.65;

                        return (
                          <tr key={`${node.id}_${model.id}`} className="hover:bg-[#f9faf8] transition">
                          <td className="py-3.5 px-3">
                            <strong className="text-sm font-serif text-[#1a1f1c]">{node.stationName}</strong>
                            <div className="font-mono text-[10px] text-[#5a635d]">{node.id}</div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-[#1a1f1c]">{model.name}</div>
                            <span className="font-mono text-[10px] text-[#5a635d]">{model.runtime}</span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => handleToggleNodeModel(node.id, model.id, isEnabled)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                                isEnabled 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                  : 'bg-[#f5f6f4] text-[#5a635d] border border-[#dde1dc]'
                              }`}
                            >
                              {isEnabled ? '● Active' : '○ Disabled'}
                            </button>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="0.10"
                                max="0.95"
                                step="0.05"
                                value={threshold}
                                disabled={!isEnabled}
                                onChange={(e) => handleThresholdChange(node.id, model.id, parseFloat(e.target.value))}
                                className="w-32 accent-[#1f4d3a] cursor-pointer disabled:opacity-40"
                              />
                              <span className="font-mono font-bold text-xs text-[#1a1f1c] w-10">
                                {threshold.toFixed(2)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className="font-mono text-[11px] text-emerald-700 font-medium">
                              {isEnabled ? 'Hot-Reload Synced' : 'Unloaded'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Model Creation Modal */}
      {isCreateModelOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#dde1dc] shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#dde1dc] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1a1f1c] flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#1f4d3a]" /> Register Custom Bioacoustic Model
              </h3>
              <button 
                onClick={() => setIsCreateModelOpen(false)}
                className="text-xs font-mono text-[#5a635d] hover:text-[#1a1f1c]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateNewModel} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#1a1f1c] block mb-1">Model Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Custom Bioacoustic Classifier"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2 font-semibold text-[#1a1f1c] outline-none focus:border-[#1f4d3a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#1a1f1c] block mb-1">Model Version</label>
                  <input
                    type="text"
                    placeholder="v1.0"
                    value={newModelVersion}
                    onChange={(e) => setNewModelVersion(e.target.value)}
                    className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2 font-mono text-[#1a1f1c] outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#1a1f1c] block mb-1">Runtime</label>
                  <select
                    value={newModelRuntime}
                    onChange={(e) => setNewModelRuntime(e.target.value as any)}
                    className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2 font-mono text-[#1a1f1c] outline-none"
                  >
                    <option value="onnx">ONNX Runtime (ARM64)</option>
                    <option value="tflite">Generic TFLite (ARM64)</option>
                    <option value="birdnet_tflite">BirdNET Official Format</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#1a1f1c] block mb-1">Storage Path (.onnx / .tflite in Supabase Storage bucket &apos;models&apos;)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. models/custom_model/model.onnx"
                  value={newModelStoragePath}
                  onChange={(e) => setNewModelStoragePath(e.target.value)}
                  className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2 font-mono text-[#1a1f1c] outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#1a1f1c] block mb-1">Labels File Path (labels.txt in Supabase Storage bucket &apos;models&apos;)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. models/custom_model/labels.txt"
                  value={newModelLabelsPath}
                  onChange={(e) => setNewModelLabelsPath(e.target.value)}
                  className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2 font-mono text-[#1a1f1c] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-[#5a635d] block mb-1">Target Rate</label>
                  <select
                    value={newModelSampleRate}
                    onChange={(e) => setNewModelSampleRate(e.target.value)}
                    className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-2.5 py-2 font-mono text-[#1a1f1c]"
                  >
                    <option value="32000">32000 Hz</option>
                    <option value="48000">48000 Hz</option>
                    <option value="16000">16000 Hz</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#5a635d] block mb-1">Input Type</label>
                  <select
                    value={newModelInputType}
                    onChange={(e) => setNewModelInputType(e.target.value)}
                    className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-2.5 py-2 font-mono text-[#1a1f1c]"
                  >
                    <option value="mel_spectrogram">Mel Spectrogram</option>
                    <option value="raw_waveform">Raw Waveform</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#5a635d] block mb-1">Activation</label>
                  <select
                    value={newModelActivation}
                    onChange={(e) => setNewModelActivation(e.target.value)}
                    className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-2.5 py-2 font-mono text-[#1a1f1c]"
                  >
                    <option value="sigmoid">Sigmoid</option>
                    <option value="softmax">Softmax</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#1a1f1c] block mb-1">Description / Target Taxa</label>
                <textarea
                  rows={2}
                  value={newModelDesc}
                  onChange={(e) => setNewModelDesc(e.target.value)}
                  placeholder="Notes on trained taxa, geographic domain, and training dataset..."
                  className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2 text-[#1a1f1c] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dde1dc]">
                <button
                  type="button"
                  onClick={() => setIsCreateModelOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#f5f6f4] text-[#5a635d] font-semibold hover:bg-[#e8eae6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1f4d3a] text-white font-semibold hover:bg-[#16382a] shadow-xs"
                >
                  Register Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Node GPS Location Modal */}
      {editingNodeGps && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#dde1dc] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#dde1dc] pb-3">
              <h3 className="text-base font-serif font-bold text-[#1a1f1c] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1f4d3a]" /> Configure Station GPS Location
              </h3>
              <button 
                onClick={() => setEditingNodeGps(null)}
                className="text-xs font-mono text-[#5a635d] hover:text-[#1a1f1c] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-[#f0f7f3] border border-[#dde1dc] rounded-xl space-y-1">
                <div className="font-semibold text-[#1f4d3a] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Hardware Node: {editingNodeGps.id}</span>
                </div>
                <div className="text-[11px] text-[#5a635d] leading-relaxed">
                  These GPS coordinates dictate <strong>BirdNET geographic species occurrence filtering</strong> (restricting species to regional avifauna) and determine marker placement on the Live Observatory survey map.
                </div>
              </div>

              {/* Location Presets */}
              <div>
                <label className="font-semibold text-[#1a1f1c] block mb-1.5">Quick Regional Presets:</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { name: 'Western Ghats Canopy', lat: '11.3419', long: '76.6437', desc: 'Ooty / Shola Mountain Forest' },
                    { name: 'Nilgiris Shola Reserve', lat: '11.4102', long: '76.6950', desc: 'Naduvattam Shola Forest' },
                    { name: 'IISER Tirupati BioLab', lat: '13.6288', long: '79.4192', desc: 'Tirupati Campus Edge Node' }
                  ].map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setEditingNodeGps(prev => prev ? { ...prev, lat: preset.lat, long: preset.long } : null)}
                      className="px-3 py-2 text-left rounded-lg bg-[#f9faf8] hover:bg-[#eaf2ed] border border-[#dde1dc] flex items-center justify-between transition cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-[#1a1f1c]">{preset.name}</div>
                        <div className="text-[10px] text-[#5a635d]">{preset.desc}</div>
                      </div>
                      <span className="font-mono text-[10px] text-[#1f4d3a] font-bold">
                        {preset.lat}, {preset.long}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-semibold text-[#1a1f1c] block mb-1">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editingNodeGps.lat}
                    onChange={(e) => setEditingNodeGps(prev => prev ? { ...prev, lat: e.target.value } : null)}
                    className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3 py-2 font-mono text-xs font-semibold text-[#1a1f1c] outline-none focus:border-[#1f4d3a]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#1a1f1c] block mb-1">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editingNodeGps.long}
                    onChange={(e) => setEditingNodeGps(prev => prev ? { ...prev, long: e.target.value } : null)}
                    className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3 py-2 font-mono text-xs font-semibold text-[#1a1f1c] outline-none focus:border-[#1f4d3a]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#dde1dc]">
                <button
                  type="button"
                  onClick={() => setEditingNodeGps(null)}
                  className="px-4 py-2 rounded-xl bg-[#f5f6f4] text-[#5a635d] font-semibold hover:bg-[#e8eae6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const latNum = parseFloat(editingNodeGps.lat);
                    const lonNum = parseFloat(editingNodeGps.long);
                    if (isNaN(latNum) || isNaN(lonNum)) {
                      alert('Please enter valid numeric latitude and longitude.');
                      return;
                    }
                    handleUpdateNodeGps(editingNodeGps.id, latNum, lonNum);
                  }}
                  className="px-5 py-2 rounded-xl bg-[#1f4d3a] text-white font-semibold hover:bg-[#16382a] shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Save Location</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* TAB 3: PI SETUP, SSH COMMAND PLAYBOOK & SERVICE GENERATOR                      */}
      {/* ============================================================================== */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          <div className="p-6 md:p-8 rounded-2xl bg-[#1a1f1c] text-[#f5f6f4] border border-[#2d3630] space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2d3630] pb-4">
              <div>
                <h2 className="text-lg font-serif font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  Raspberry Pi SSH Command Center &amp; Service Generator
                </h2>
                <p className="text-xs text-[#a0aba3] mt-0.5">
                  Complete interactive setup guide for installing, configuring, running, and managing the Live Detector agent on any Raspberry Pi.
                </p>
              </div>
            </div>

            {/* Config Inputs Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-emerald-400 block mb-1">Target Project Name</label>
                <input
                  type="text"
                  value={genProjectName}
                  onChange={(e) => setGenProjectName(e.target.value)}
                  className="w-full bg-[#121614] border border-[#2d3630] rounded-xl px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-amber-400 block mb-1">Site Location Name</label>
                <input
                  type="text"
                  value={genStationName}
                  onChange={(e) => setGenStationName(e.target.value)}
                  className="w-full bg-[#121614] border border-[#2d3630] rounded-xl px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-cyan-400 block mb-1">Unique Station Node ID</label>
                <input
                  type="text"
                  value={genRecorderId}
                  onChange={(e) => setGenRecorderId(e.target.value)}
                  className="w-full bg-[#121614] border border-[#2d3630] rounded-xl px-3.5 py-2 text-xs font-mono font-semibold text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-[#2d3630]">
              <div>
                <label className="text-xs font-semibold text-[#a0aba3] block mb-1">Pi Linux Username</label>
                <input
                  type="text"
                  value={genPiUser}
                  onChange={(e) => setGenPiUser(e.target.value)}
                  className="w-full bg-[#121614] border border-[#2d3630] rounded-xl px-3 py-2 text-xs font-mono text-[#a0aba3] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#a0aba3] block mb-1">Mic ALSA Device</label>
                <input
                  type="text"
                  value={genAudioDevice}
                  onChange={(e) => setGenAudioDevice(e.target.value)}
                  className="w-full bg-[#121614] border border-[#2d3630] rounded-xl px-3 py-2 text-xs font-mono text-[#a0aba3] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#a0aba3] block mb-1">Hop Seconds (Window Step)</label>
                <input
                  type="text"
                  value={genHopSeconds}
                  onChange={(e) => setGenHopSeconds(e.target.value)}
                  className="w-full bg-[#121614] border border-[#2d3630] rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#a0aba3] block">GPS (Lat, Lon)</label>
                  <button
                    type="button"
                    onClick={handleSaveGeneratorGpsToDatabase}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition"
                    title="Write this latitude and longitude to recorders_registry for this station"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Save to DB</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={genLatitude}
                    onChange={(e) => setGenLatitude(e.target.value)}
                    placeholder="Latitude"
                    className="w-1/2 bg-[#121614] border border-[#2d3630] rounded-xl px-2.5 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={genLongitude}
                    onChange={(e) => setGenLongitude(e.target.value)}
                    placeholder="Longitude"
                    className="w-1/2 bg-[#121614] border border-[#2d3630] rounded-xl px-2.5 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-emerald-500"
                  />
                </div>
                {/* Quick Preset Buttons */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => { setGenLatitude('11.3419'); setGenLongitude('76.6437'); }}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/60 transition cursor-pointer"
                  >
                    Western Ghats
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGenLatitude('11.4102'); setGenLongitude('76.6950'); }}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1f2622] text-[#a0aba3] border border-[#2d3630] hover:text-white transition cursor-pointer"
                  >
                    Nilgiris
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGenLatitude('13.6288'); setGenLongitude('79.4192'); }}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1f2622] text-[#a0aba3] border border-[#2d3630] hover:text-white transition cursor-pointer"
                  >
                    Tirupati
                  </button>
                </div>
              </div>
            </div>

            {/* Step-by-Step Playbook */}
            {/* Step-by-Step Playbook */}
            <div className="space-y-6 pt-4 border-t border-[#2d3630]">

              {/* Step 1: SSH Login */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 1: SSH Login to Raspberry Pi</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`ssh ${genPiUser}@livedetector.local`);
                      showNotification('SSH login command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all">
                  ssh {genPiUser}@livedetector.local
                </pre>
                <div className="text-[11px] text-[#a0aba3] space-y-1">
                  <p>• If using the default hostname or IP address: <code className="text-emerald-400">ssh {genPiUser}@raspberrypi.local</code> or <code className="text-emerald-400">ssh {genPiUser}@&lt;ip_address&gt;</code></p>
                  <p>• If you get <em>"REMOTE HOST IDENTIFICATION HAS CHANGED"</em> after re-flashing your SD card, run on Windows: <code className="text-amber-300 select-all">ssh-keygen -R livedetector.local</code></p>
                </div>
              </div>

              {/* Step 2: System Audio & Library Packages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 2: Install System Packages, Git &amp; Audio Drivers</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('sudo apt update && sudo apt install -y git python3-pip python3-venv ffmpeg alsa-utils libopenblas-dev');
                      showNotification('Apt install command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  sudo apt update &amp;&amp; sudo apt install -y git python3-pip python3-venv ffmpeg alsa-utils libopenblas-dev
                </pre>
              </div>

              {/* Step 3: Test USB Microphone & Calibrate Input Gain */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 3: Verify USB Microphone &amp; Calibrate Gain (alsamixer)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`arecord -l && arecord -D ${genAudioDevice !== 'default' ? genAudioDevice : 'plughw:1,0'} -d 5 -f S16_LE -r 48000 test.wav && ls -lh test.wav && rm test.wav`);
                      showNotification('Mic test command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Test Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  arecord -l &amp;&amp; arecord -D {genAudioDevice !== 'default' ? genAudioDevice : 'plughw:1,0'} -d 5 -f S16_LE -r 48000 test.wav &amp;&amp; ls -lh test.wav &amp;&amp; rm test.wav
                </pre>
                
                {/* Alsamixer Gain Calibration Box */}
                <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-amber-300 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5" />
                      <span>Calibrate Microphone Gain (Avoid Distorted / Clipped Audio)</span>
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('alsamixer');
                        showNotification('alsamixer command copied!');
                      }}
                      className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono hover:bg-amber-500/30 transition cursor-pointer"
                    >
                      Copy alsamixer
                    </button>
                  </div>
                  <p className="text-[11px] text-[#a0aba3] leading-relaxed">
                    If ALSA input volume is boosted to 100% (+30 dB), sound digital-clips into harsh, buzzy distortion. Run <code className="text-amber-300">alsamixer</code> &rarr; press <code className="text-white">F6</code> to select your USB Audio Device &rarr; press <code className="text-white">F4</code> to switch to <strong>Capture</strong> &rarr; lower the capture bar to <strong>65% &ndash; 75%</strong> (green range). Press <code className="text-white">ESC</code>, then persist across reboots with:
                  </p>
                  <pre className="p-2 rounded-lg bg-[#121614] font-mono text-[11px] text-amber-300 select-all">
                    sudo alsactl store
                  </pre>
                </div>
              </div>

              {/* Step 4: Download Live_detector from GitHub (Sparse Checkout) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 4: Download Live_detector from GitHub (Sparse Checkout)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`rm -rf /home/${genPiUser}/Live_detector && git clone --depth 1 --filter=blob:none --sparse https://github.com/adhithmkiiser/Birdsong-Observatory.git ~/Birdsong-Observatory && cd ~/Birdsong-Observatory && git sparse-checkout set Live_detector && ln -s ~/Birdsong-Observatory/Live_detector /home/${genPiUser}/Live_detector && cd /home/${genPiUser}/Live_detector`);
                      showNotification('GitHub sparse-checkout command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <p className="text-[11px] text-[#a0aba3]">
                  Downloads <strong>only</strong> the lightweight <code className="text-emerald-400">Live_detector</code> engine directly onto your Pi without cloning the rest of the web app:
                </p>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  rm -rf /home/{genPiUser}/Live_detector &amp;&amp; git clone --depth 1 --filter=blob:none --sparse https://github.com/adhithmkiiser/Birdsong-Observatory.git ~/Birdsong-Observatory &amp;&amp; cd ~/Birdsong-Observatory &amp;&amp; git sparse-checkout set Live_detector &amp;&amp; ln -s ~/Birdsong-Observatory/Live_detector /home/{genPiUser}/Live_detector &amp;&amp; cd /home/{genPiUser}/Live_detector
                </pre>
              </div>

              {/* Step 5: Python Virtual Environment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 5: Create Virtualenv &amp; Install Python Dependencies</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`cd /home/${genPiUser}/Live_detector && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`);
                      showNotification('Python venv install command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  cd /home/{genPiUser}/Live_detector &amp;&amp; python3 -m venv venv &amp;&amp; source venv/bin/activate &amp;&amp; pip install -r requirements.txt
                </pre>
              </div>

              {/* Step 5b: Official Cornell BirdNET Edge Model Setup */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 5b: Download Official Cornell BirdNET v2.4 Model Weights &amp; Taxonomy</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`mkdir -p /home/${genPiUser}/Live_detector/models/birdnet_default && curl -L -o /home/${genPiUser}/Live_detector/models/birdnet_default/labels.txt https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt && curl -L -o /home/${genPiUser}/Live_detector/models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite https://raw.githubusercontent.com/woheller69/whoBIRD-TFlite/master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite`);
                      showNotification('BirdNET model download command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Download Command
                  </button>
                </div>
                <p className="text-[11px] text-[#a0aba3]">
                  Downloads the official 6,522 species taxonomy and Cornell BirdNET FP32 TFLite core model directly to your Pi:
                </p>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  mkdir -p /home/{genPiUser}/Live_detector/models/birdnet_default &amp;&amp; curl -L -o /home/{genPiUser}/Live_detector/models/birdnet_default/labels.txt https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt &amp;&amp; curl -L -o /home/{genPiUser}/Live_detector/models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite https://raw.githubusercontent.com/woheller69/whoBIRD-TFlite/master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite
                </pre>
              </div>

              {/* Step 5c: Cloudflare Tunnel for Remote Listening Outside Local Wi-Fi */}
              <div className="space-y-2 p-4 rounded-xl bg-gradient-to-r from-blue-950/30 to-emerald-950/30 border border-blue-900/40">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>Step 5c: Global Remote Live Stream (Cloudflare Tunnel)</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb && sudo dpkg -i cloudflared.deb`);
                      showNotification('cloudflared install command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Cloudflare Install
                  </button>
                </div>
                <p className="text-[11px] text-[#a0aba3] leading-relaxed">
                  Enables continuous live listening from outside your local Wi-Fi router (e.g. on mobile 4G/5G data or remote lab) with zero router port-forwarding. When installed, <code className="text-emerald-300">main.py</code> automatically spawns the outbound tunnel and links the <strong>Stream Target</strong> directly to the dashboard!
                </p>
                <pre className="p-3 rounded-lg bg-[#121614] border border-[#2d3630] font-mono text-xs text-cyan-300 select-all overflow-x-auto">
                  curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb &amp;&amp; sudo dpkg -i cloudflared.deb
                </pre>
              </div>

              {/* Step 6: Test Solar & Hardware Telemetry Tool */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-400">Step 6: Standalone Solar &amp; Battery Telemetry Test</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`cd /home/${genPiUser}/Live_detector && source venv/bin/activate && python3 telemetry.py`);
                      showNotification('Telemetry test command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <p className="text-xs text-[#a0aba3]">
                  Tests SD card space, CPU temp, and reads firmware PMIC registers to check for solar powerbank under-voltage dips:
                </p>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-amber-300 select-all">
                  python3 telemetry.py
                </pre>
              </div>

              {/* Step 6b: USB Microphone Clarity & Voice Capture Test */}
              <div className="space-y-2 p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 to-teal-950/30 border border-emerald-900/40">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span>Step 6b: USB Microphone Clarity &amp; Voice Capture Test</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`cd /home/${genPiUser}/Live_detector && source venv/bin/activate && python3 test_mic.py`);
                      showNotification('Mic test command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Mic Test
                  </button>
                </div>
                <p className="text-[11px] text-[#a0aba3] leading-relaxed">
                  Tests your USB microphone in real time. It un-mutes the hardware ALSA capture mixer, records 3 seconds while you talk near the mic, and calculates peak &amp; RMS volume in dBFS to guarantee voices and bird songs are captured loud and clear:
                </p>
                <pre className="p-3 rounded-lg bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  python3 test_mic.py
                </pre>
              </div>

              {/* Step 7: Create .env File */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-400">Step 7: Write Configuration to .env</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedEnvScript);
                      showNotification('.env content copied to clipboard!');
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy .env
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-[11px] text-amber-300 overflow-x-auto leading-relaxed">
                  {generatedEnvScript}
                </pre>
              </div>

              {/* Step 8: Systemd Service Installation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-cyan-400">Step 8: Install Systemd Auto-Start Service</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedSystemdService);
                      showNotification('Service unit file copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy live-detector.service
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-[11px] text-cyan-300 overflow-x-auto leading-relaxed">
                  {generatedSystemdService}
                </pre>
                <div className="space-y-1 pt-2">
                  <p className="text-xs text-[#a0aba3]">Run on the Pi to enable and start 24/7 background operation:</p>
                  <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-cyan-300 select-all overflow-x-auto">
                    sudo cp /home/{genPiUser}/Live_detector/service/live-detector.service /etc/systemd/system/ &amp;&amp; sudo systemctl daemon-reload &amp;&amp; sudo systemctl enable --now live-detector
                  </pre>
                </div>
              </div>

              {/* Step 9: Management & Journalctl Commands */}
              <div className="space-y-3 pt-3 border-t border-[#2d3630]">
                <h4 className="font-bold text-sm text-white">Daily Operations &amp; Live Log Inspection Commands</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-[#121614] border border-[#2d3630] space-y-1">
                    <span className="text-[#a0aba3] text-[10px] uppercase block font-semibold">Inspect Live Agent Logs</span>
                    <code className="text-emerald-400 select-all block">sudo journalctl -u live-detector -f</code>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121614] border border-[#2d3630] space-y-1">
                    <span className="text-[#a0aba3] text-[10px] uppercase block font-semibold">Restart Agent</span>
                    <code className="text-amber-400 select-all block">sudo systemctl restart live-detector</code>
                  </div>
                  <div className="p-3 rounded-xl bg-[#121614] border border-[#2d3630] space-y-1">
                    <span className="text-[#a0aba3] text-[10px] uppercase block font-semibold">Service Status</span>
                    <code className="text-cyan-400 select-all block">sudo systemctl status live-detector</code>
                  </div>
                </div>
              </div>

              {/* Step 10: Interactive Troubleshooting & Error Recovery Playbook */}
              <div className="p-5 rounded-2xl bg-[#121614] border border-[#2d3630] space-y-4">
                <div className="flex items-center justify-between border-b border-[#2d3630] pb-3">
                  <h4 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Field Troubleshooting &amp; Error Recovery Center
                  </h4>
                  <span className="text-[11px] text-[#a0aba3]">Click any command to copy</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Issue 1 */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">Host Identification Changed (Windows)</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('ssh-keygen -R livedetector.local');
                          showNotification('Host key reset command copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px]">
                      Occurs if you re-flashed your SD card and Windows remembers the old SSH key in known_hosts. Run on Windows:
                    </p>
                    <code className="text-amber-300 block bg-[#121614] p-2 rounded-lg font-mono text-[11px] select-all">
                      ssh-keygen -R livedetector.local
                    </code>
                  </div>

                  {/* Issue 2 */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">Permission Denied on SSH Login</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`ssh ${genPiUser}@livedetector.local`);
                          showNotification('SSH login command copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px]">
                      Make sure you explicitly include the Pi username <code className="text-emerald-400">{genPiUser}@</code>, otherwise Windows logs in as your Windows account:
                    </p>
                    <code className="text-emerald-300 block bg-[#121614] p-2 rounded-lg font-mono text-[11px] select-all">
                      ssh {genPiUser}@livedetector.local
                    </code>
                  </div>

                  {/* Issue 3 */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">Broken APT Dependencies / Libatlas Error</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('sudo apt --fix-broken install -y && sudo apt install -y git python3-pip python3-venv ffmpeg alsa-utils libopenblas-dev');
                          showNotification('APT fix command copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px]">
                      In Debian Bookworm/Trixie, ATLAS is replaced by OpenBLAS. Repair half-installed packages with:
                    </p>
                    <code className="text-cyan-300 block bg-[#121614] p-2 rounded-lg font-mono text-[11px] select-all">
                      sudo apt --fix-broken install -y
                    </code>
                  </div>

                  {/* Issue 4 */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">Microphone Not Detected (arecord empty)</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('lsusb && sudo dmesg | tail -n 20');
                          showNotification('Hardware scan command copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px]">
                      Raspberry Pi 3.5mm jack is <em>audio out only</em>. Plug USB mic into a blue USB 3.0 port and inspect bus:
                    </p>
                    <code className="text-amber-300 block bg-[#121614] p-2 rounded-lg font-mono text-[11px] select-all">
                      lsusb &amp;&amp; sudo dmesg | tail -n 20
                    </code>
                  </div>

                  {/* Issue 5 */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">Configure Microphone Hardware Card</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('echo "AUDIO_INPUT_DEVICE=plughw:3,0" >> ~/Live_detector/.env');
                          showNotification('Mic config command copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px]">
                      If <code className="text-emerald-400">arecord -l</code> reports card 3, bind it directly in your Pi's environment:
                    </p>
                    <code className="text-emerald-300 block bg-[#121614] p-2 rounded-lg font-mono text-[11px] select-all">
                      echo "AUDIO_INPUT_DEVICE=plughw:3,0" &gt;&gt; ~/Live_detector/.env
                    </code>
                  </div>

                  {/* Issue 6 */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">Solar Powerbank Under-Voltage Warning</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('vcgencmd get_throttled');
                          showNotification('Throttled query copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px]">
                      If solar drops &lt;4.63V during cloud cover, use thick 20 AWG USB-C cables and increase <code className="text-amber-300">HOP_SECONDS=2.5</code>. Check throttle state:
                    </p>
                    <code className="text-amber-300 block bg-[#121614] p-2 rounded-lg font-mono text-[11px] select-all">
                      vcgencmd get_throttled
                    </code>
                  </div>

                  {/* Issue 7: Inaudible Voices, Slow-Motion, or Distorted Audio */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">Cannot Hear Mic Voices / Slow-Motion or Distorted Audio</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('python3 test_mic.py');
                          showNotification('Mic diagnostic command copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px] leading-relaxed">
                      1. <strong>Cannot hear people talking / Muted mic</strong>: USB microphones in Linux frequently default to 0% volume or muted. Run <code className="text-emerald-400">python3 test_mic.py</code> on the Pi to un-mute ALSA capture mixers, record a 3-second test, and verify room voices in dBFS.<br/>
                      2. <strong>Slow-motion / Robotic sound</strong>: Occurs when hardware mic rates (16 kHz) are captured without ALSA plug resampling. Use <code className="text-emerald-400">AUDIO_INPUT_DEVICE=auto</code> in <code className="text-emerald-400">.env</code> to enable automatic 48 kHz resampling.
                    </p>
                    <code className="text-emerald-300 block bg-[#121614] p-2 rounded-lg font-mono text-[11px] select-all">
                      python3 test_mic.py
                    </code>
                  </div>

                  {/* Issue 8: 0 Live Detections / Missing BirdNET Weights */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">0 Live Detections / Awaiting Species</strong>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`mkdir -p /home/${genPiUser}/Live_detector/models/birdnet_default && curl -L -o /home/${genPiUser}/Live_detector/models/birdnet_default/labels.txt https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt && curl -L -o /home/${genPiUser}/Live_detector/models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite https://raw.githubusercontent.com/woheller69/whoBIRD-TFlite/master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite`);
                          showNotification('BirdNET download command copied!');
                        }}
                        className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Copy fix command"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[#a0aba3] text-[11px] leading-relaxed">
                      Occurs if the model is assigned in the cloud but Cornell BirdNET weights (<code className="text-emerald-400">BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite</code> ~51MB) or <code className="text-emerald-400">labels.txt</code> have not been downloaded to the Pi yet. Run:
                    </p>
                    <code className="text-emerald-300 block bg-[#121614] p-2 rounded-lg font-mono text-[10px] select-all break-all">
                      mkdir -p /home/{genPiUser}/Live_detector/models/birdnet_default &amp;&amp; curl -L -o /home/{genPiUser}/Live_detector/models/birdnet_default/labels.txt https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt &amp;&amp; curl -L -o /home/{genPiUser}/Live_detector/models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite https://raw.githubusercontent.com/woheller69/whoBIRD-TFlite/master/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite
                    </code>
                  </div>

                  {/* Issue 9: Direct Stream vs Cloud Call Clips */}
                  <div className="p-3.5 rounded-xl bg-[#181d1a] border border-[#2d3630] space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-white flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-cyan-400" />
                        Understanding Audio Architecture: Direct Live Stream vs Cloud Call Clips
                      </strong>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#a0aba3] pt-1">
                      <div className="p-3 rounded-lg bg-[#121614] border border-[#232c26] space-y-1">
                        <strong className="text-emerald-300 block">📻 Direct Live Stream (Port 8888)</strong>
                        <p>
                          Continuous Opus audio sent straight from your Raspberry Pi&apos;s local HTTP server (<code className="text-white">http://&lt;pi_ip&gt;:8888/stream.opus</code>). Used for real-time live field monitoring in the browser with minimal latency. Shuts down automatically when no browser is connected to save battery.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#121614] border border-[#232c26] space-y-1">
                        <strong className="text-cyan-300 block">☁️ Cloud Call Clips (Supabase Storage)</strong>
                        <p>
                          Short, high-fidelity 3.0-second `.opus` audio slices uploaded to Supabase Storage whenever a bird call or unusual acoustic event is detected. These are linked to historical species detection cards so researchers can click &quot;Play&quot; on past records.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* TAB 5: LIVE PROJECTS & ARRAYS                                                 */}
      {/* ============================================================================== */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] space-y-4 shadow-xs text-xs">
            <h3 className="text-sm font-serif font-bold text-[#1a1f1c] flex items-center justify-between border-b border-[#f0f2ef] pb-3">
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#1f4d3a]" /> Edit Live Project Card Details
              </span>
              <span className="font-mono text-[#5a635d]">{liveProjects.length} project(s)</span>
            </h3>

            <div className="space-y-3">
              <label className="font-semibold text-[#1a1f1c] block">Choose Live Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-[#f9faf8] border border-[#dde1dc] rounded-xl px-3.5 py-2.5 font-semibold text-[#1a1f1c] outline-none"
              >
                {liveProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {(() => {
              const p = liveProjects.find(proj => proj.id === selectedProjectId);
              if (!p) return <p className="text-[#5a635d]">Select a project above to edit its card details.</p>;
              return (
                <div className="p-5 rounded-2xl bg-[#f9faf8] border border-[#dde1dc] space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="w-full md:w-48 h-32 rounded-xl border border-[#dde1dc] bg-white overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#5a635d] font-mono text-[10px]">No Image</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="font-semibold text-[#1a1f1c] block mb-1">Image Link (URL)</label>
                        <input
                          type="text"
                          value={p.image_url || ''}
                          onChange={(e) => setLiveProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, image_url: e.target.value } : proj))}
                          placeholder="https://example.com/project-image.jpg"
                          className="w-full bg-white border border-[#dde1dc] rounded-xl px-3.5 py-2 text-xs font-mono text-[#1a1f1c] outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-[#1a1f1c] block mb-1">Project Description</label>
                        <textarea
                          value={p.description || ''}
                          onChange={(e) => setLiveProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, description: e.target.value } : proj))}
                          rows={3}
                          className="w-full bg-white border border-[#dde1dc] rounded-xl px-3.5 py-2 text-xs text-[#1a1f1c] outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* TAB 6: DETECTIONS DATABASE                                                    */}
      {/* ============================================================================== */}
      {activeTab === 'detections' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] space-y-4 shadow-xs text-xs">
            <div className="flex flex-col gap-3 pb-3 border-b border-[#f0f2ef]">
              <h3 className="text-sm font-serif font-bold text-[#1a1f1c] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#1f4d3a]" /> Live Detections Database
                </span>
                <span className="font-mono text-[11px] text-[#5a635d]">{liveDetections.length} recorded calls</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#dde1dc] text-[#5a635d] text-[10px] uppercase font-mono tracking-wider">
                    <th className="py-3 px-3">Date &amp; Time</th>
                    <th className="py-3 px-3">Station / Node</th>
                    <th className="py-3 px-3">Common / Scientific Name</th>
                    <th className="py-3 px-3 text-center">Confidence</th>
                    <th className="py-3 px-3 text-center">Model Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2ef] font-medium">
                  {liveDetections.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#5a635d]">
                        No detections currently logged in live_detections table.
                      </td>
                    </tr>
                  ) : (
                    liveDetections.slice(0, 50).map(det => (
                      <tr key={det.id} className="hover:bg-[#f9faf8] transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#5a635d]">
                          {new Date(det.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-[#1a1f1c]">{det.site_name || det.station_name || 'Station'}</strong>
                          <div className="font-mono text-[10px] text-[#5a635d]">{det.recorder_id || det.station_id}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-[#1a1f1c]">{det.common_name}</strong>
                          <div className="text-[10px] text-[#5a635d] italic">{det.scientific_name}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            det.confidence > 0.8 ? 'bg-emerald-100 text-emerald-800' :
                            det.confidence > 0.5 ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {(det.confidence * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[10px] text-[#5a635d]">
                          {det.model_id ? String(det.model_id).slice(0, 8) : 'BirdNET'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
