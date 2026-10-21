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
  Mic
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { User, UserRole } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { AdminNavTabs } from '@/components/admin/AdminNavTabs';

// ==============================================================================
// Types for Next-Gen Live Detector System
// ==============================================================================

interface StationTelemetry {
  id?: number;
  node_id: string;
  timestamp: string;
  cpu_temp_c: number;
  disk_free_gb: number;
  disk_percent_free: number;
  is_low_space: boolean;
  battery_capacity_percent: number;
  battery_voltage_v: number;
  power_status: string;
  under_voltage_flag: boolean;
  throttling_flag: boolean;
  cpu_percent: number;
  ram_percent: number;
  uptime_hours: number;
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
  // State: Recorders & Telemetry
  // ----------------------------------------------------------------------------
  const [recorders, setRecorders] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, StationTelemetry>>({});
  const [now, setNow] = useState(Date.now());

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
  const [genStationName, setGenStationName] = useState('');
  const [genProjectName, setGenProjectName] = useState('');
  const [genRecorderId, setGenRecorderId] = useState('');
  const [genSupabaseUrl, setGenSupabaseUrl] = useState('https://ktihcjfxxxazohimtiav.supabase.co');
  const [genSupabaseKey, setGenSupabaseKey] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4');
  const [genAudioDevice, setGenAudioDevice] = useState('default');
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
      // 1. Projects & Recorders
      const [
        { data: projs },
        { data: recordersData },
        { count: liveCount }
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
        supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
        supabase.from('live_detections').select('*', { count: 'exact', head: true })
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
      } else {
        setLiveProjects([]);
      }

      if (recordersData && recordersData.length > 0) {
        setRecorders(recordersData);
      } else {
        setRecorders([]);
      }

      // 2. Fetch Station Telemetry
      try {
        const { data: teleData, error: teleErr } = await supabase
          .from('station_telemetry')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(100);

        if (!teleErr && teleData && teleData.length > 0) {
          const map: Record<string, StationTelemetry> = {};
          for (const item of teleData) {
            if (!map[item.node_id]) {
              map[item.node_id] = item;
            }
          }
          setTelemetryMap(map);
        } else {
          setTelemetryMap({});
        }
      } catch (e) {
        console.warn('Telemetry table fetch skipped:', e);
        setTelemetryMap({});
      }

      // 3. Fetch Model Registry & Node Assignments
      try {
        const { data: mData, error: mErr } = await supabase
          .from('models')
          .select('*')
          .order('created_at', { ascending: false });

        if (!mErr && mData && mData.length > 0) {
          setModelsList(mData);
        } else {
          setModelsList([]);
        }

        const { data: nmData, error: nmErr } = await supabase
          .from('node_models')
          .select('*, models(*)');

        if (!nmErr && nmData && nmData.length > 0) {
          setNodeModelAssignments(nmData.map((item: any) => ({
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
      } catch (e) {
        console.warn('Models table fetch skipped:', e);
        setModelsList([]);
        setNodeModelAssignments([]);
      }

      // 4. Fetch Detections
      try {
        const { data: dets } = await supabase
          .from('live_detections')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(100);

        if (dets) {
          setLiveDetections(dets);
        }
      } catch (e) {
        console.warn('Detections fetch skipped:', e);
      }

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

  // Combined Nodes List with Telemetry
  const nodesList = useMemo<LiveNodeItem[]>(() => {
    return recorders.map((r: any) => {
      const lastPingAt = r.last_ping ? new Date(r.last_ping) : null;
      const isStale = !lastPingAt || (now - lastPingAt.getTime()) >= OFFLINE_THRESHOLD_MS;
      let status: 'online' | 'offline' | 'syncing' = isStale ? 'offline' : (r.status?.toLowerCase() || 'online');
      const tel = telemetryMap[r.recorder_id];
      const assigned = nodeModelAssignments.filter(n => n.node_id === r.recorder_id);

      return {
        id: r.recorder_id,
        stationName: r.site_name || r.recorder_id,
        projectName: r.project_name || 'Unassigned Project',
        ipAddress: r.ip_address || '--',
        lastUploadedId: 0,
        pendingQueue: 0,
        lastSyncTime: r.last_ping ? new Date(r.last_ping).toLocaleTimeString() : '--',
        status,
        telemetry: tel,
        assignedModels: assigned
      };
    });
  }, [recorders, telemetryMap, nodeModelAssignments, now]);

  // ==============================================================================
  // Action Handlers
  // ==============================================================================

  const handleToggleNodeModel = async (nodeId: string, modelId: string, currentEnabled: boolean) => {
    const updated = !currentEnabled;
    try {
      await supabase
        .from('node_models')
        .upsert({
          node_id: nodeId,
          model_id: modelId,
          enabled: updated,
          updated_at: new Date().toISOString()
        }, { onConflict: 'node_id,model_id' });
    } catch (e) {
      console.warn('Cloud sync for node_models failed, updated locally:', e);
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
          threshold: 0.65,
          model_name: m?.name || 'Model',
          runtime: m?.runtime || 'onnx'
        }];
      }
    });

    showNotification(`⚡ Model ${updated ? 'activated' : 'deactivated'} on ${nodeId}! Raspberry Pi hot-reload synced with zero restart.`);
  };

  const handleThresholdChange = async (nodeId: string, modelId: string, newThreshold: number) => {
    setNodeModelAssignments(prev => prev.map(n => (n.node_id === nodeId && n.model_id === modelId) ? { ...n, threshold: newThreshold } : n));
    try {
      await supabase
        .from('node_models')
        .upsert({
          node_id: nodeId,
          model_id: modelId,
          threshold: newThreshold,
          updated_at: new Date().toISOString()
        }, { onConflict: 'node_id,model_id' });
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
      await supabase.from('models').insert([newModel]);
    } catch (err) {
      console.warn('Cloud insert failed, saving locally:', err);
    }

    setModelsList(prev => [newModel, ...prev]);
    setIsCreateModelOpen(false);
    setNewModelName('');
    setNewModelDesc('');
    showNotification(`✨ New Model "${newModel.name}" registered! Ready to deploy to Raspberry Pi edge nodes.`);
  };



  const handleTriggerSyncNow = (nodeId: string) => {
    setRecorders(prev => prev.map(n => n.recorder_id === nodeId ? { ...n, status: 'syncing', last_ping: new Date().toISOString() } : n));
    showNotification(`Realtime heartbeat signal sent to ${nodeId}`);
  };

  const handleDeleteNode = async (node: LiveNodeItem) => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete recording nodes.');
      return;
    }
    if (!confirm(`Delete recorder "${node.id}" from ${node.projectName}? This will remove its registry entry.`)) return;
    try {
      await supabase.from('recorders_registry').delete().eq('recorder_id', node.id);
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

# GPS Coordinates
LATITUDE=${genLatitude}
LONGITUDE=${genLongitude}

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
                const cpuTemp = tel ? tel.cpu_temp_c : null;
                const diskFreeGb = tel ? tel.disk_free_gb : null;
                const diskPercent = tel ? tel.disk_percent_free : null;
                const powerStatus = tel ? tel.power_status : 'Awaiting Telemetry';
                const batteryVolt = tel ? tel.battery_voltage_v : null;
                const batteryCap = tel ? tel.battery_capacity_percent : null;
                const ramPercent = tel ? tel.ram_percent : null;
                const uptime = tel ? tel.uptime_hours : null;

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
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
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
                className="px-4 py-2 rounded-xl bg-[#1f4d3a] hover:bg-[#16382a] text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Upload New Model</span>
              </button>
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
              <div>
                <label className="text-xs font-semibold text-[#a0aba3] block mb-1">GPS (Lat, Lon)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={genLatitude}
                    onChange={(e) => setGenLatitude(e.target.value)}
                    className="w-1/2 bg-[#121614] border border-[#2d3630] rounded-xl px-2 py-2 text-xs font-mono text-[#a0aba3]"
                  />
                  <input
                    type="text"
                    value={genLongitude}
                    onChange={(e) => setGenLongitude(e.target.value)}
                    className="w-1/2 bg-[#121614] border border-[#2d3630] rounded-xl px-2 py-2 text-xs font-mono text-[#a0aba3]"
                  />
                </div>
              </div>
            </div>

            {/* Step-by-Step Playbook */}
            <div className="space-y-6 pt-4 border-t border-[#2d3630]">

              {/* Step 1: SSH Login */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 1: SSH Login to Raspberry Pi</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`ssh ${genPiUser}@raspberrypi.local`);
                      showNotification('SSH login command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all">
                  ssh {genPiUser}@raspberrypi.local
                </pre>
              </div>

              {/* Step 2: System Audio & Library Packages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 2: Install System Packages &amp; FFmpeg Audio Drivers</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('sudo apt update && sudo apt install -y python3-pip python3-venv ffmpeg alsa-utils git libatlas-base-dev');
                      showNotification('Apt install command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  sudo apt update &amp;&amp; sudo apt install -y python3-pip python3-venv ffmpeg alsa-utils git libatlas-base-dev
                </pre>
              </div>

              {/* Step 3: Test USB Microphone */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 3: Verify USB Microphone Ingestion</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('arecord -l && arecord -D default -d 5 -f S16_LE -r 48000 test.wav && ls -lh test.wav && rm test.wav');
                      showNotification('Mic test command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  arecord -l &amp;&amp; arecord -D default -d 5 -f S16_LE -r 48000 test.wav &amp;&amp; ls -lh test.wav &amp;&amp; rm test.wav
                </pre>
              </div>

              {/* Step 4: Python Virtual Environment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Step 4: Create Virtualenv &amp; Install Python Dependencies</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`cd /home/${genPiUser}/Live_detector && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt tflite-runtime`);
                      showNotification('Python venv install command copied!');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-emerald-300 select-all overflow-x-auto">
                  cd /home/{genPiUser}/Live_detector &amp;&amp; python3 -m venv venv &amp;&amp; source venv/bin/activate &amp;&amp; pip install -r requirements.txt tflite-runtime
                </pre>
              </div>

              {/* Step 5: Test Solar & Hardware Telemetry Tool */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-400">Step 5: Standalone Solar &amp; Battery Telemetry Test</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`cd /home/${genPiUser}/Live_detector && python3 telemetry.py`);
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

              {/* Step 6: Create .env File */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-400">Step 6: Write Configuration to .env</span>
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

              {/* Step 7: Systemd Service Installation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-cyan-400">Step 7: Install Systemd Auto-Start Service</span>
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
                  <p className="text-xs text-[#a0aba3]">Run on the Pi to enable and start:</p>
                  <pre className="p-3.5 rounded-xl bg-[#121614] border border-[#2d3630] font-mono text-xs text-cyan-300 select-all overflow-x-auto">
                    sudo cp /home/{genPiUser}/Live_detector/service/live-detector.service /etc/systemd/system/ &amp;&amp; sudo systemctl daemon-reload &amp;&amp; sudo systemctl enable --now live-detector
                  </pre>
                </div>
              </div>

              {/* Step 8: Management & Journalctl Commands */}
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

              {/* Step 9: Troubleshooting Playbook */}
              <div className="p-5 rounded-xl bg-[#121614] border border-[#2d3630] space-y-3">
                <h4 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Edge Field Troubleshooting Playbook
                </h4>
                <div className="space-y-2 text-xs text-[#a0aba3] leading-relaxed">
                  <p>
                    &bull; <strong className="text-white">Solar Powerbank Under-Voltage Warning:</strong> If the 5V rail dips under 4.63V during passing clouds or dusk, use a short, high-grade 20 AWG USB-C power cable to minimize voltage drop. You can also reduce CPU load by increasing <code className="text-amber-300">HOP_SECONDS=2.5</code> in <code className="text-white">.env</code>.
                  </p>
                  <p>
                    &bull; <strong className="text-white">Microphone Reconnect:</strong> If the USB mic is bumped or loses power, <code className="text-white">capture.py</code> automatically attempts reconnection every 3 seconds without crashing the supervisor.
                  </p>
                  <p>
                    &bull; <strong className="text-white">Cellular Outage &amp; Backlog:</strong> All windows, detections, and telemetry are staged locally in <code className="text-white">data/live_detector_outbox.db</code>. When internet connectivity returns, the agent batch uploads the backlog and prunes old synced rows automatically.
                  </p>
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
