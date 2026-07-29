'use client';

import React, { useState, useEffect } from 'react';
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

  // 1. Live Pi Field Nodes Status & Queue Telemetry (starts empty — populated by real connected nodes)
  const [nodesList, setNodesList] = useState<LiveNodeItem[]>([]);

  // 2. Python Daemon Script Config Generator State
  const [genStationName, setGenStationName] = useState('WesternGhats_Node_01');
  const [genProjectName, setGenProjectName] = useState('Western Ghats Live Observatory');
  const [genSupabaseUrl, setGenSupabaseUrl] = useState('https://your-project.supabase.co');
  const [genSupabaseKey, setGenSupabaseKey] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  const [genInterval, setGenInterval] = useState('15');

  // 3. Projects Management State (starts empty — add real projects via the form)
  const [liveProjects, setLiveProjects] = useState<LiveProjectItem[]>([]);

  useEffect(() => {
    async function loadLiveAdminData() {
      try {
        const [{ data: projs }, { data: stats }] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('stations').select('*').order('created_at', { ascending: false })
        ]);
        if (projs) {
          setLiveProjects(projs.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            organization: p.organization || 'IISER Tirupati Bird Lab',
            stationsCount: p.stations_count || 0
          })));
        }
        if (stats) {
          setNodesList(stats.map((s: any) => ({
            id: s.id,
            stationName: s.station_name,
            projectName: s.project_name || 'Western Ghats Live Observatory',
            ipAddress: '192.168.1.100',
            lastUploadedId: 0,
            pendingQueue: 0,
            lastSyncTime: s.last_seen || 'Just now',
            status: s.status as any || 'online',
            sqlitePath: '/home/pi/BirdNET-Pi/scripts/birds.db',
            audioDir: '/home/pi/BirdNET-Pi/clips/'
          })));
        }
      } catch (e) {
        console.error('Failed to load Live admin data from database:', e);
      }
    }
    loadLiveAdminData();
  }, []);

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
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/birdnet_sync.py
Restart=always
RestartSec=10
Environment="SUPABASE_URL=${genSupabaseUrl}"
Environment="SUPABASE_SERVICE_ROLE_KEY=${genSupabaseKey}"
Environment="STATION_NAME=${genStationName}"
Environment="PROJECT_NAME=${genProjectName}"
Environment="BIRDNET_DB_PATH=/home/pi/BirdNET-Pi/scripts/birds.db"
Environment="AUDIO_DIR=/home/pi/BirdNET-Pi/clips/"
Environment="SYNC_INTERVAL_SECONDS=${genInterval}"

[Install]
WantedBy=multi-user.target`;

  const handleCopySystemd = () => {
    navigator.clipboard.writeText(generatedSystemdScript);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
    showNotification('Systemd service config copied to clipboard!');
  };

  const handleTriggerSyncNow = (nodeId: string) => {
    setNodesList(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'syncing', lastSyncTime: 'Just now' } : n));
    showNotification(`Sync command dispatched to Raspberry Pi field node ${nodeId}`);
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

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) return;

    const newUser: User = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: formName,
      email: formEmail,
      role: formRole,
      organization: formOrg,
      assignedProjectType: formProjectType,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    addUser(newUser);
    setIsCreateUserOpen(false);
    showNotification(`New live recorder user account created for ${formName}!`);
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
          <FolderPlus className="w-4 h-4" /> 3. Live Projects Directory
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'users' 
              ? 'border-emerald-600 text-emerald-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" /> 4. Live System Users & Technicians
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
                        <button
                          onClick={() => handleTriggerSyncNow(node.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] transition flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3 h-3" /> Sync Now
                        </button>
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
              Configure parameters below to generate the exact <code className="text-emerald-400 font-mono">birdnet-sync.service</code> file to deploy on your Raspberry Pi 4 field sensor node.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-extrabold text-slate-300 block mb-1">Station Node Name (STATION_NAME)</label>
                <input
                  type="text"
                  value={genStationName}
                  onChange={(e) => setGenStationName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-300 block mb-1">Target Project Name (PROJECT_NAME)</label>
                <input
                  type="text"
                  value={genProjectName}
                  onChange={(e) => setGenProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-bold text-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-300 block mb-1">Supabase Project URL (SUPABASE_URL)</label>
                <input
                  type="text"
                  value={genSupabaseUrl}
                  onChange={(e) => setGenSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-300 block mb-1">Sync Interval (Seconds)</label>
                <input
                  type="number"
                  value={genInterval}
                  onChange={(e) => setGenInterval(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-emerald-400 font-bold"
                />
              </div>
            </div>

            {/* Generated Systemd Config Box */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-slate-400">
                  Target Path on Pi: <code className="text-emerald-400">/etc/systemd/system/birdnet-sync.service</code>
                </span>
                <button
                  onClick={handleCopySystemd}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode ? 'Copied!' : 'Copy Config'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                {generatedSystemdScript}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Live Projects Directory */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FolderPlus className="w-4 h-4 text-emerald-600" /> Create Live Streaming Observatory Project
            </h3>

            <form onSubmit={handleCreateLiveProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Western Ghats Live Stream"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Lead Organization</label>
                  <input
                    type="text"
                    placeholder="IISER Tirupati Bird Lab"
                    value={newProjOrg}
                    onChange={(e) => setNewProjOrg(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/20"
                >
                  Create Live Project Entry
                </button>
              </div>
            </form>
          </div>

          {/* Active Live Streaming Projects Directory */}
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-emerald-600" /> Active Live Streaming Observatory Projects ({liveProjects.length})
              </span>
            </h3>

            <div className="space-y-3">
              {liveProjects.map(p => (
                <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">{p.id}</span>
                      <h4 className="font-extrabold text-slate-900 text-sm">{p.name}</h4>
                    </div>
                    <p className="text-slate-500 text-[11px] font-medium">{p.description}</p>
                    <div className="text-[10px] text-slate-400 font-mono">Organization: {p.organization || 'IISER Tirupati Bird Lab'}</div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleDeleteLiveProject(p.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold flex items-center gap-1.5 transition border border-rose-200 hover:border-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Project</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
