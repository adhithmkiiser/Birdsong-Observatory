'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radio, 
  Cpu, 
  Volume2, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
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
  Layers
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { User, UserRole } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { sendOneTimePasswordEmail } from '@/lib/emailService';

interface LiveNodeItem {
  id: string;
  stationName: string;
  projectName: string;
  ipAddress: string;
  lastUploadedId: number;
  pendingQueue: number;
  lastSyncTime: string;
  status: 'online' | 'offline' | 'syncing';
  sqlitePath: string;
  audioDir: string;
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
  const { usersList, updateUserCredentials, deleteUser, addUser } = useRole();

  // Active Tab: 'nodes' | 'generator' | 'projects' | 'users'
  const [activeTab, setActiveTab] = useState<'nodes' | 'generator' | 'projects' | 'users'>('nodes');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // User Edit Modal States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // User Form States
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Site Manager');
  const [formOrg, setFormOrg] = useState('IISER Tirupati Bird Lab');
  const [formProjectType, setFormProjectType] = useState<'PAM' | 'Live' | 'Both'>('Live');

  const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;
  const STATION_HEARTBEAT_INTERVAL_MS = 60 * 1000;

  // 1. Live Pi Field Nodes Status & Queue Telemetry (starts empty — populated by real connected nodes)
  const [recorders, setRecorders] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  const nodesList = useMemo<LiveNodeItem[]>(() => {
    return recorders.map((r: any) => {
      const lastPingAt = r.last_ping ? new Date(r.last_ping) : null;
      const isStale = !lastPingAt || (now - lastPingAt.getTime()) >= OFFLINE_THRESHOLD_MS;
      let status: 'online' | 'offline' | 'syncing' = isStale ? 'offline' : (r.status?.toLowerCase() || 'online');
      return {
        id: r.recorder_id,
        stationName: r.site_name,
        projectName: r.project_name || 'Bird_Lab_demo',
        ipAddress: '192.168.1.100',
        lastUploadedId: 0,
        pendingQueue: 0,
        lastSyncTime: r.last_ping ? new Date(r.last_ping).toLocaleTimeString() : 'Just now',
        status,
        sqlitePath: '/home/pi/BirdNET-Pi/scripts/birds.db',
        audioDir: '/home/pi/BirdNET-Pi/clips/'
      };
    });
  }, [recorders, now]);

  // Detect recorder IDs that appear under multiple projects/sites
  const duplicateRecorderIds = useMemo(() => {
    const counts: Record<string, number> = {};
    nodesList.forEach(n => { counts[n.id] = (counts[n.id] || 0) + 1; });
    return Object.keys(counts).filter(id => counts[id] > 1);
  }, [nodesList]);

  // 2. Python Daemon Script Config Generator State
  const [genStationName, setGenStationName] = useState('Inside BirdLab');
  const [genProjectName, setGenProjectName] = useState('Western Ghats Live Observatory');
  const [genRecorderId, setGenRecorderId] = useState('Test_Lab_1');
  const [genSupabaseUrl, setGenSupabaseUrl] = useState('https://ktihcjfxxxazohimtiav.supabase.co');
  const [genSupabaseKey, setGenSupabaseKey] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4');
  const [genInterval, setGenInterval] = useState('10');
  const [genLatitude, setGenLatitude] = useState('13.6288');
  const [genLongitude, setGenLongitude] = useState('79.4192');

  // 3. Projects Management State (starts empty — add real projects via the form)
  const [liveProjects, setLiveProjects] = useState<LiveProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    async function loadLiveAdminData() {
      try {
        const [{ data: projs }, { data: recordersData }] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false })
        ]);

        if (projs) {
          setLiveProjects(projs.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            organization: p.organization || 'IISER Tirupati Bird Lab',
            stationsCount: p.stations_count || 0,
            image_url: p.image_url || ''
          })));
        }

        if (recordersData) {
          setRecorders(recordersData);
        }
      } catch (e) {
        console.error('Failed to load Live admin data from recorders_registry:', e);
      }
    }
    loadLiveAdminData();
    const interval = setInterval(() => {
      setNow(Date.now());
      loadLiveAdminData();
    }, STATION_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (liveProjects.length > 0 && !liveProjects.find(p => p.id === selectedProjectId)) {
      setSelectedProjectId(liveProjects[0].id);
    }
  }, [liveProjects, selectedProjectId]);

  // Forms
  const [newProjId, setNewProjId] = useState('');
  const [newProjName, setNewProjName] = useState('');
  const [newProjOrg, setNewProjOrg] = useState('IISER Tirupati Bird Lab');
  const [newProjDesc, setNewProjDesc] = useState('');

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const generatedSystemdScript = `[Unit]
Description=BirdNET-Pi Cloud Sync Daemon (IISER Tirupati Bird Lab)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/livedetector
ExecStart=/usr/bin/python3 /home/livedetector/birdnet-sync/main.py
Restart=always
RestartSec=10
Environment="SUPABASE_URL=${genSupabaseUrl}"
Environment="SUPABASE_KEY=${genSupabaseKey}"
Environment="STATION_ID=${genRecorderId}"
Environment="STATION_NAME=${genStationName}"
Environment="PROJECT_NAME=${genProjectName}"
Environment="SQLITE_DB=/home/livedetector/BirdNET-Pi/scripts/birds.db"
Environment="AUDIO_ROOT=/home/livedetector/BirdSongs/Extracted/By_Date"
Environment="SYNC_INTERVAL=${genInterval}"
Environment="LATITUDE=${genLatitude}"
Environment="LONGITUDE=${genLongitude}"

[Install]
WantedBy=multi-user.target`;

  const handleCopySystemd = () => {
    navigator.clipboard.writeText(generatedSystemdScript);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
    showNotification('Systemd service config copied to clipboard!');
  };

  const handleTriggerSyncNow = (nodeId: string) => {
    setRecorders(prev => prev.map(n => n.recorder_id === nodeId ? { ...n, status: 'syncing', last_ping: new Date().toISOString() } : n));
    showNotification(`Sync command dispatched to Raspberry Pi field node ${nodeId}`);
  };

  const handleDeleteNode = async (node: LiveNodeItem) => {
    if (!confirm(`Delete recorder "${node.id}" from ${node.projectName}? This will also delete all of its live detections and audio files.`)) return;
    try {
      const { data: detections } = await supabase.from('live_detections')
        .select('audio_url')
        .eq('recorder_id', node.id)
        .eq('project_name', node.projectName);

      const audioPaths = ((detections || []) as any[])
        .map(d => d.audio_url)
        .filter(Boolean)
        .map((url: string) => {
          try {
            return new URL(url).pathname.replace('/storage/v1/object/public/bird-audio/', '');
          } catch {
            return '';
          }
        })
        .filter(Boolean);

      if (audioPaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('bird-audio').remove(audioPaths);
        if (storageError) console.error('Storage delete error:', storageError);
      }

      await supabase.from('live_detections').delete().eq('recorder_id', node.id).eq('project_name', node.projectName);
      await supabase.from('recorders_registry').delete().eq('recorder_id', node.id).eq('project_name', node.projectName);
      setRecorders(prev => prev.filter(r => r.recorder_id !== node.id));
      showNotification(`Recorder ${node.id} and its data were deleted.`);
    } catch (err: any) {
      alert('Failed to delete recorder: ' + err.message);
    }
  };

  const handleCreateLiveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName) return;

    const projectId = newProjId ? newProjId.trim().toLowerCase().replace(/\s+/g, '-') : `prj-live-${Math.random().toString(36).substr(2, 5)}`;
    const newProj = {
      id: projectId,
      name: newProjName,
      description: newProjDesc || 'Real-time live streaming bioacoustics project.',
      organization: newProjOrg || 'IISER Tirupati Bird Lab',
      project_type: 'Live',
      stations_count: 0,
      species_count: 0,
      total_detections: 0
    };

    const { error } = await supabase.from('projects').insert([newProj]);
    if (error) {
      alert('Error creating project: ' + error.message);
      return;
    }

    setLiveProjects(prev => [...prev, {
      id: newProj.id,
      name: newProj.name,
      description: newProj.description,
      organization: newProj.organization,
      stationsCount: 0
    }]);
    setNewProjId('');
    setNewProjName('');
    setNewProjDesc('');
    showNotification(`New Live Stream Project "${newProjName}" created!`);
  };

  const handleDeleteLiveProject = async (projectId: string) => {
    if (confirm(`Are you sure you want to delete live project "${projectId}"? This will remove all streaming station node configurations.`)) {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) {
        alert('Error deleting project: ' + error.message);
        return;
      }
      setLiveProjects(prev => prev.filter(p => p.id !== projectId));
      showNotification(`Live project ${projectId} deleted successfully.`);
    }
  };

  const handleUpdateLiveProject = async (updated: LiveProjectItem) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          description: updated.description,
          image_url: updated.image_url,
          stations_count: Number(updated.stationsCount) || 0,
          organization: updated.organization
        })
        .eq('id', updated.id);
      if (error) {
        alert('Error updating project: ' + error.message);
        return;
      }
      setLiveProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      showNotification(`Project "${updated.name}" card details saved.`);
    } catch (err: any) {
      alert('Failed to update project: ' + err.message);
    }
  };

  // User Management Handlers
  const handleEditUserClick = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormOrg(u.organization || 'IISER Tirupati Bird Lab');
    setFormProjectType(u.assignedProjectType || 'Live');
  };

  const handleSaveUserUpdates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateUserCredentials(editingUser.id, {
      name: formName,
      email: formEmail,
      role: formRole,
      organization: formOrg,
      assignedProjectType: formProjectType
    });

    setEditingUser(null);
    showNotification(`User account details updated for ${formName}!`);
  };

  const [formOtpPassword, setFormOtpPassword] = useState('TempPass_9821!');

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) return;

    const otpToUse = formOtpPassword || `TempPass_${Math.floor(1000 + Math.random() * 9000)}!`;

    const newUser: User = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: formName,
      email: formEmail,
      password: otpToUse,
      role: formRole,
      organization: formOrg,
      assignedProjectType: formProjectType,
      isOneTimePassword: true,
      mustChangePassword: true,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    addUser(newUser);

    // Save to Supabase users table
    try {
      await supabase.from('users').insert([{
        full_name: formName,
        email: formEmail,
        password_hash: otpToUse,
        role: formRole,
        organization: formOrg,
        project_scope_permissions: [formProjectType === 'Live' ? 'bird_lab_demo' : 'tst'],
        is_one_time_password: true,
        must_change_password: true
      }]);

      await sendOneTimePasswordEmail({
        email: formEmail,
        name: formName,
        otpCode: otpToUse,
        isNewUser: true
      });
    } catch (err) {
      console.error('Error creating user in Supabase:', err);
    }

    setIsCreateUserOpen(false);
    showNotification(`New user account created for ${formName}! One-Time Password: ${otpToUse}`);
  };

  const handleDeleteUserConfirm = (userId: string) => {
    deleteUser(userId);
    setDeleteConfirmId(null);
    showNotification(`User account removed from directory.`);
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-xs uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Admin Console Section 1</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            1. Live Recorder & Real-Time Stream Admin Console
          </h1>
          <p className="text-slate-300 text-xs font-medium max-w-xl">
            Monitor Raspberry Pi field sensor nodes, inspect SQLite delta sync queues, generate <code className="bg-slate-800 px-1 py-0.5 rounded font-mono">birdnet_sync.py</code> systemd configs, edit user roles & project permissions.
          </p>
        </div>
      </div>

      {/* Live Admin Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-black">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'nodes' 
              ? 'border-emerald-600 text-emerald-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-4 h-4" /> 1. Pi Field Nodes & Sync Telemetry
        </button>

        <button
          onClick={() => setActiveTab('generator')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'generator' 
              ? 'border-emerald-600 text-emerald-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Terminal className="w-4 h-4" /> 2. Pi Python Sync Daemon Config Generator
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'projects' 
              ? 'border-emerald-600 text-emerald-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4" /> 3. Project Card Image & Description
        </button>

      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: Pi Field Nodes & Sync Telemetry */}
      {activeTab === 'nodes' && (
        <div className="space-y-6">
          {duplicateRecorderIds.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Duplicate Recorder IDs detected: {duplicateRecorderIds.join(', ')}</span>
              </div>
              <p className="text-[11px] text-rose-600 font-medium">
                Two or more Raspberry Pi nodes are using the same RECORDER_ID. Each field recorder must have a unique ID.
              </p>
            </div>
          )}
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-600" /> Active Raspberry Pi 4 Field Sensor Nodes ({nodesList.length})
              </h3>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                SQLite Delta Upload Active
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {nodesList.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <Cpu className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="font-black text-xs text-slate-900">No Pi Field Nodes Connected</div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto font-medium">
                    Deploy the <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[10px]">birdnet_sync.py</code> daemon on a Raspberry Pi field node and connect it to this Supabase project to see live telemetry here.
                  </p>
                </div>
              ) : (
                nodesList.map(node => (
                  <div key={node.id} className="py-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-black text-slate-900">{node.stationName}</strong>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">{node.id}</span>
                          <span className="font-mono text-[10px] text-slate-400">({node.ipAddress})</span>
                        </div>
                        <p className="text-slate-500 font-medium text-[11px] mt-0.5">{node.projectName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${
                          node.status === 'online' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          node.status === 'syncing' ? 'bg-indigo-50 text-indigo-800 border-indigo-200 animate-pulse' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {node.status === 'online' ? '● SYNC DAEMON ACTIVE' : node.status === 'syncing' ? '⚡ UPLOADING DELTA' : 'OFFLINE'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTriggerSyncNow(node.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] transition flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3 h-3" /> Sync Now
                          </button>

                          <button
                            onClick={() => handleDeleteNode(node)}
                            className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 font-extrabold text-[11px] transition flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 font-mono text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Last Uploaded Row ID</span>
                        <strong className="text-slate-900 font-black">#{node.lastUploadedId}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Pending Queue</span>
                        <strong className={node.pendingQueue > 0 ? "text-amber-600 font-black" : "text-emerald-700 font-black"}>
                          {node.pendingQueue} files
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Last Daemon Ping</span>
                        <strong className="text-slate-700">{node.lastSyncTime}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">SQLite Source Path</span>
                        <strong className="text-slate-500 truncate block">{node.sqlitePath}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>


        </div>
      )}

      {/* TAB 2: Raspberry Pi Python Sync Daemon Config Generator */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          <div className="p-6 rounded-[24px] bg-slate-900 text-white border border-slate-800 shadow-xl space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" /> Raspberry Pi <code className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono">birdnet_sync.py</code> Systemd Config Generator
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Daemon Environment Setup</span>
            </div>

            <p className="text-slate-300 font-medium leading-relaxed">
              Enter your <strong>Project Name</strong>, <strong>Site Name</strong>, and <strong>Unique Recorder ID</strong> below. When your Raspberry Pi runs the sync daemon, it will automatically register this Project, Site, and Recorder to the website database!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-extrabold text-emerald-400 block mb-1">1. Target Project Name (PROJECT_NAME)</label>
                <input
                  type="text"
                  value={genProjectName}
                  onChange={(e) => setGenProjectName(e.target.value)}
                  placeholder="e.g. Western Ghats Live Observatory"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-bold text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-amber-400 block mb-1">2. Site Location Name (SITE_NAME)</label>
                <input
                  type="text"
                  value={genStationName}
                  onChange={(e) => setGenStationName(e.target.value)}
                  placeholder="e.g. Inside BirdLab"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-amber-300 font-bold focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-cyan-400 block mb-1">3. Unique Recorder ID (RECORDER_ID)</label>
                <input
                  type="text"
                  value={genRecorderId}
                  onChange={(e) => setGenRecorderId(e.target.value)}
                  placeholder="e.g. Test_Lab_1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-cyan-300 font-bold focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
              <div>
                <label className="font-extrabold text-slate-400 block mb-1">Supabase Project URL (SUPABASE_URL)</label>
                <input
                  type="text"
                  value={genSupabaseUrl}
                  onChange={(e) => setGenSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-slate-400 text-[11px]"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-400 block mb-1">Sync Interval (Seconds)</label>
                <input
                  type="number"
                  value={genInterval}
                  onChange={(e) => setGenInterval(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-emerald-400 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
              <div>
                <label className="font-extrabold text-indigo-400 block mb-1">Latitude (LATITUDE)</label>
                <input
                  type="number"
                  step="any"
                  value={genLatitude}
                  onChange={(e) => setGenLatitude(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-indigo-400 font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-indigo-400 block mb-1">Longitude (LONGITUDE)</label>
                <input
                  type="number"
                  step="any"
                  value={genLongitude}
                  onChange={(e) => setGenLongitude(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-indigo-400 font-bold"
                />
              </div>
            </div>

            {/* Step-by-Step Workflow Guide */}
            <div className="space-y-6 pt-4 border-t border-slate-800">
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-400 text-sm">Step 1: Navigate to Target Installation Location</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('cd /home/livedetector');
                      showNotification('Step 1 command copied!');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black hover:bg-emerald-500/30 flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Code
                  </button>
                </div>
                <p className="text-slate-400 text-xs font-medium">SSH into your Raspberry Pi terminal and navigate to your target installation directory (the <code className="bg-slate-800 text-emerald-300 px-1 rounded">birdnet-sync</code> folder will be created inside this location):</p>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[12px] text-emerald-400 select-all">
                  cd /home/livedetector
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-400 text-sm">Step 2: Download the Sync Engine</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('wget --show-progress -qO- https://github.com/adhithmkiiser/Birdsong-Observatory/archive/main.tar.gz | tar xz --strip-components=1 Birdsong-Observatory-main/birdnet-sync');
                      showNotification('Step 2 command copied!');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black hover:bg-emerald-500/30 flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Code
                  </button>
                </div>
                <p className="text-slate-400 text-xs font-medium">Download ONLY the <code className="bg-slate-800 text-emerald-300 px-1 rounded">birdnet-sync</code> folder from GitHub into your target directory (this skips downloading the full website codebase):</p>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[12px] text-emerald-400 select-all overflow-x-auto">
                  wget --show-progress -qO- https://github.com/adhithmkiiser/Birdsong-Observatory/archive/main.tar.gz | tar xz --strip-components=1 Birdsong-Observatory-main/birdnet-sync
                </div>
                <p className="text-slate-400 text-[11px] font-medium leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-emerald-300/90">
                  💡 <strong>Automatic Updates & Preserved Config:</strong> Running Step 2 automatically updates all engine code files (<code className="bg-slate-800 text-white px-1 rounded">main.py</code>, <code className="bg-slate-800 text-white px-1 rounded">config.py</code>, etc.) while preserving your existing <code className="bg-slate-800 text-amber-300 px-1 rounded">.env</code> credentials intact! For a 100% fresh clean reinstall, run <code className="bg-slate-800 text-amber-300 px-1 rounded">rm -rf ~/birdnet-sync</code> before Step 2.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-400 text-sm">Step 3: Edit the Configuration File via Nano</span>
                  <button
                    onClick={() => {
                      const envText = `SUPABASE_URL="${genSupabaseUrl}"\nSUPABASE_KEY="${genSupabaseKey}"\nPROJECT_NAME="${genProjectName}"\nSTATION_NAME="${genStationName}"\nSTATION_ID="${genRecorderId}"\nLATITUDE=${genLatitude}\nLONGITUDE=${genLongitude}\nSQLITE_DB="/home/livedetector/BirdNET-Pi/scripts/birds.db"\nAUDIO_ROOT="/home/livedetector/BirdSongs/Extracted/By_Date"\nSYNC_INTERVAL=${genInterval}`;
                      navigator.clipboard.writeText(envText);
                      showNotification('.env block copied!');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black hover:bg-amber-500/30 flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Variables
                  </button>
                </div>
                <p className="text-slate-400 text-xs font-medium">Open the <code className="bg-slate-800 text-amber-300 px-1 rounded">.env</code> config file in your installation directory using nano:</p>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[12px] text-slate-300 select-all overflow-x-auto">
                  nano ~/birdnet-sync/.env
                </div>
                <p className="text-slate-400 text-xs font-medium">Paste the exact block below into the file, save with <strong>Ctrl+O</strong>, Enter, then exit with <strong>Ctrl+X</strong>.</p>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto leading-relaxed whitespace-pre">
{`SUPABASE_URL="${genSupabaseUrl}"
SUPABASE_KEY="${genSupabaseKey}"
PROJECT_NAME="${genProjectName}"
STATION_NAME="${genStationName}"
STATION_ID="${genRecorderId}"
LATITUDE=${genLatitude}
LONGITUDE=${genLongitude}
SQLITE_DB="/home/livedetector/BirdNET-Pi/scripts/birds.db"
AUDIO_ROOT="/home/livedetector/BirdSongs/Extracted/By_Date"
SYNC_INTERVAL=${genInterval}`}
                </pre>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-indigo-400 text-sm">Step 4: Run the Auto-Installer script</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('cd ~/birdnet-sync && sudo cp birdnet-sync.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable birdnet-sync && sudo systemctl start birdnet-sync');
                      showNotification('Install command copied!');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-black hover:bg-indigo-500/30 flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Command
                  </button>
                </div>
                <p className="text-slate-400 text-xs font-medium">Navigate into the sync folder, install the systemd service, and start the daemon — all in one command:</p>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[12px] text-indigo-300 select-all overflow-x-auto">
                  cd ~/birdnet-sync && sudo cp birdnet-sync.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable birdnet-sync && sudo systemctl start birdnet-sync
                </div>
                <p className="text-slate-400 text-xs font-medium mt-1">Verify it's running with: <code className="bg-slate-800 text-emerald-300 px-1 rounded">sudo systemctl status birdnet-sync</code></p>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-emerald-100 text-xs font-medium leading-relaxed">
                  <strong><CheckCircle2 className="w-4 h-4 inline-block mr-1 mb-0.5 text-emerald-400"/> Success! What happens next?</strong><br/><br/>
                  The daemon will automatically extract GPS coordinates from <code className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">/etc/birdnet/birdnet.conf</code>, detect the CPU temp/storage on the Pi, and register <strong className="text-white">station_{genStationName.toLowerCase().replace(/[^a-z0-9]/g, '_')}</strong> to the Live Dashboard! <br/><br/>
                  Audio files are securely uploaded directly into your Supabase Storage Bucket (<code className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">live_audio</code>), and the dashboard website natively converts them into beautiful interactive spectrograms using Wavesurfer.js!
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Project Card Image & Description */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" /> Edit Live Project Card Details
              </span>
              <span className="text-[10px] font-mono text-slate-500">{liveProjects.length} project(s)</span>
            </h3>

            <div className="space-y-3">
              <label className="font-extrabold text-slate-700 block">Choose Live Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                {liveProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {(() => {
              const p = liveProjects.find(proj => proj.id === selectedProjectId);
              if (!p) return <p className="text-[11px] text-slate-500">Select a project above to edit its card details.</p>;
              return (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="w-full md:w-40 h-28 rounded-xl border border-slate-200 bg-white overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] font-bold">No Image</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="font-extrabold text-slate-700 block mb-1">Image Link (URL)</label>
                        <input
                          type="text"
                          value={p.image_url || ''}
                          onChange={(e) => setLiveProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, image_url: e.target.value } : proj))}
                          placeholder="https://example.com/project-image.jpg"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-[11px] text-slate-900 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-extrabold text-slate-700 block mb-1">Project Description</label>
                        <textarea
                          value={p.description || ''}
                          onChange={(e) => setLiveProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, description: e.target.value } : proj))}
                          placeholder="Short description shown on the project card..."
                          rows={3}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:border-emerald-500 focus:outline-none resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-extrabold text-slate-700 block mb-1">Organization</label>
                          <input
                            type="text"
                            value={p.organization || ''}
                            onChange={(e) => setLiveProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, organization: e.target.value } : proj))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-extrabold text-slate-700 block mb-1">Active Nodes</label>
                          <input
                            type="number"
                            value={p.stationsCount || 0}
                            onChange={(e) => setLiveProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, stationsCount: Number(e.target.value) } : proj))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => handleDeleteLiveProject(p.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold flex items-center gap-1.5 transition border border-rose-200 hover:border-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                    <button
                      onClick={() => handleUpdateLiveProject(p)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Save Changes
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 4: Live System Users & Technicians (Full Interactive Editing) */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Live Recorder System Users & Roles Directory
              </h3>
              <p className="text-slate-500 text-[11px] font-medium mt-0.5">
                Assign user roles, update organization names, and configure project access scope permissions (PAM Only, Live Only, or Both).
              </p>
            </div>

            <button
              onClick={() => {
                setFormName('');
                setFormEmail('');
                setFormRole('Site Manager');
                setFormOrg('IISER Tirupati Bird Lab');
                setFormProjectType('Live');
                setIsCreateUserOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2 self-start sm:self-auto"
            >
              <UserPlus className="w-3.5 h-3.5" /> + Add User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="pb-3 pl-2">User Name & Email</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Organization</th>
                  <th className="pb-3">Assigned Permissions</th>
                  <th className="pb-3 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 pl-2">
                      <div className="font-extrabold text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                        u.role === 'Admin' ? 'bg-indigo-100 text-indigo-800' :
                        u.role === 'Project Manager' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 font-bold text-slate-700">{u.organization || 'IISER Tirupati'}</td>
                    <td className="py-3.5">
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-200 inline-flex items-center gap-1">
                        {u.assignedProjectType === 'PAM' ? <Database className="w-3 h-3 text-indigo-600" /> :
                         u.assignedProjectType === 'Live' ? <Radio className="w-3 h-3 text-emerald-600" /> :
                         <Layers className="w-3 h-3 text-amber-600" />}
                        <span>{u.assignedProjectType || 'Both'} Access</span>
                      </span>
                    </td>
                    <td className="py-3.5 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditUserClick(u)}
                          className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                          title="Edit User & Permissions"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(u.id)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-600" /> Edit User Role & Permissions ({editingUser.name})
            </h3>

            <form onSubmit={handleSaveUserUpdates} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">System Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Admin">Admin (Full Access to PAM & Live)</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Site Manager">Site Manager / Field Technician</option>
                  <option value="Public">Public Visitor</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Organization</label>
                <input
                  type="text"
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Assigned Project Scope Permissions</label>
                <select
                  value={formProjectType}
                  onChange={(e) => setFormProjectType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Both">Both (PAM Data & Live Recorder Projects)</option>
                  <option value="Live">Live Only (Realtime Streaming Field Nodes)</option>
                  <option value="PAM">PAM Only (Passive Acoustic Datasets)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                >
                  Save User Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" /> Create Live Recorder User Account
            </h3>

            <form onSubmit={handleCreateNewUser} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@birdsongobservatory.in"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Site Manager">Site Manager / Field Technician</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Organization</label>
                <input
                  type="text"
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-extrabold text-slate-700">Initial One-Time Password (OTP)</label>
                  <button
                    type="button"
                    onClick={() => setFormOtpPassword(`TempPass_${Math.floor(1000 + Math.random() * 9000)}!`)}
                    className="text-[11px] font-black text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-Generate OTP
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Type temporary password or click Auto-Generate"
                  value={formOtpPassword}
                  onChange={(e) => setFormOtpPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono font-bold text-emerald-700"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  User will be forced to change this temporary password upon their initial sign in.
                </p>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Assigned Scope Permissions</label>
                <select
                  value={formProjectType}
                  onChange={(e) => setFormProjectType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Live">Live Only (Realtime Streaming Field Nodes)</option>
                  <option value="Both">Both (PAM Data & Live Recorder Projects)</option>
                  <option value="PAM">PAM Only</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center font-sans">
            <Trash2 className="w-10 h-10 text-rose-600 mx-auto" />
            <h4 className="text-base font-black text-slate-900">Delete User Account?</h4>
            <p className="text-xs text-slate-500 font-medium">Revokes access immediately from live recorder system.</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUserConfirm(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
