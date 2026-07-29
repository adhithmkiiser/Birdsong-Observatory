'use client';

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Upload, 
  FileSpreadsheet, 
  FolderPlus, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Edit2, 
  Layers, 
  Trash2,
  Bird,
  X
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';

interface ProjectItem {
  id: string;
  title: string;
  tag: string;
  collaboration: string;
  description: string;
  image: string;
}

interface SiteItem {
  id: string;
  projectId: string;
  name: string;
  elevation: string;
  status: string;
  latitude?: number;
  longitude?: number;
  expectedFiles?: number;
}

const mapDbProjectToItem = (p: any): ProjectItem => ({
  id: p.id,
  title: p.name,
  tag: 'Bioacoustic Survey',
  collaboration: p.organization || 'IISER Tirupati Bird Lab',
  description: p.description || '',
  image: p.image_url || 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80'
});

const mapDbSiteToItem = (s: any): SiteItem => ({
  id: s.id,
  projectId: s.project_id,
  name: s.name,
  elevation: s.elevation || '1,200m',
  status: s.status || 'Active',
  latitude: s.latitude ? Number(s.latitude) : 13.58,
  longitude: s.longitude ? Number(s.longitude) : 75.64,
  expectedFiles: s.expected_files || 48
});

export default function PamAdminPage() {
  const { currentRole } = useRole();

  // Active Tab: 'upload' | 'projects' | 'species'
  const [activeTab, setActiveTab] = useState<'upload' | 'projects' | 'species'>('upload');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Batch Upload States
  const [selectedUploadProjId, setSelectedUploadProjId] = useState<string>('prj-01');
  const [selectedUploadSiteId, setSelectedUploadSiteId] = useState<string>('stn-01');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [parsedSiteCode, setParsedSiteCode] = useState<string>('');
  const [csvSiteAction, setCsvSiteAction] = useState<'existing' | 'create'>('existing');
  
  // Inline CSV site creation states
  const [csvNewSiteName, setCsvNewSiteName] = useState('');
  const [csvNewSiteElev, setCsvNewSiteElev] = useState('1,200m');
  const [csvNewSiteLat, setCsvNewSiteLat] = useState<number | ''>(13.58);
  const [csvNewSiteLng, setCsvNewSiteLng] = useState<number | ''>(75.64);

  // 2. Projects & Sites Management States (starts empty — real projects added via form / Supabase)
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [sitesList, setSitesList] = useState<SiteItem[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: projs }, { data: sitesData }] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('created_at', { ascending: false })
        ]);
        if (projs) setProjectsList(projs.map(mapDbProjectToItem));
        if (sitesData) setSitesList(sitesData.map(mapDbSiteToItem));
      } catch (e) {
        console.error('Failed to fetch projects or sites from Supabase:', e);
      }
    }
    loadData();
  }, []);

  // Form: Create New Project
  const [newProjId, setNewProjId] = useState('');
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjTag, setNewProjTag] = useState('');
  const [newProjCollab, setNewProjCollab] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjImage, setNewProjImage] = useState('');

  // Edit Project Modal States
  const [editingProj, setEditingProj] = useState<ProjectItem | null>(null);
  const [editProjTitle, setEditProjTitle] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [editProjCollab, setEditProjCollab] = useState('');
  const [editProjImage, setEditProjImage] = useState('');

  // Edit Site Modal States
  const [editingSite, setEditingSite] = useState<SiteItem | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteElev, setEditSiteElev] = useState('');
  const [editSiteLat, setEditSiteLat] = useState<number | ''>(13.58);
  const [editSiteLng, setEditSiteLng] = useState<number | ''>(75.64);
  const [editSiteProjId, setEditSiteProjId] = useState('');

  // Form: Register New Site
  const [newSiteProjId, setNewSiteProjId] = useState('prj-01');
  const [newSiteId, setNewSiteId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteElev, setNewSiteElev] = useState('1,100m');
  const [newSiteLat, setNewSiteLat] = useState<number | ''>(13.58);
  const [newSiteLng, setNewSiteLng] = useState<number | ''>(75.64);
  const [newSiteFiles, setNewSiteFiles] = useState<number | ''>(48);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  // Helper: Normalize Site Code (e.g. TST-LC03 -> lc_03)
  const normalizeSiteCode = (name: string): string => {
    return name.trim().toLowerCase().replace(/[-\s]+/g, '_');
  };

  // Handler: Parse CSV Filename for Site Code
  const handleCsvFilePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArr = Array.from(e.target.files);
      setUploadFiles(filesArr);

      const filename = filesArr[0].name;
      let code = '';
      const tstMatch = filename.match(/TST-([A-Za-z0-9]+)/);
      if (tstMatch) {
        code = normalizeSiteCode(tstMatch[1]);
      } else {
        const parts = filename.split('_');
        code = parts.length > 1 ? normalizeSiteCode(parts[0]) : 'site_01';
      }

      setParsedSiteCode(code.toUpperCase());
      setCsvNewSiteName(`Recorder Site ${code.toUpperCase()}`);

      const exists = sitesList.some(s => s.id.toLowerCase() === code.toLowerCase());
      if (exists) {
        setCsvSiteAction('existing');
      } else {
        setCsvSiteAction('create');
      }
    }
  };

  const handleBatchUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) return;

    // If inline site creation required
    if (csvSiteAction === 'create' && parsedSiteCode) {
      const createdSite = {
        id: parsedSiteCode,
        project_id: selectedUploadProjId,
        name: csvNewSiteName,
        elevation: csvNewSiteElev,
        status: 'Active',
        latitude: csvNewSiteLat !== '' ? Number(csvNewSiteLat) : 13.58,
        longitude: csvNewSiteLng !== '' ? Number(csvNewSiteLng) : 75.64,
        expected_files: 48
      };
      
      const { error } = await supabase.from('sites').insert([createdSite]);
      if (!error) {
        setSitesList(prev => [...prev, mapDbSiteToItem(createdSite)]);
      }
    }

    showNotification(`Successfully processed ${uploadFiles.length} BirdNET CSV file(s) into database!`);
    setUploadFiles([]);
    setParsedSiteCode('');
  };

  // Handler: Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjId || !newProjTitle) return;

    const projectId = newProjId.trim().toLowerCase().replace(/\s+/g, '-');
    const newProj = {
      id: projectId,
      name: newProjTitle,
      description: newProjDesc || 'Project details pending data updates.',
      organization: newProjCollab || 'IISER Tirupati Bird Lab',
      project_type: 'PAM',
      stations_count: 0,
      species_count: 0,
      total_detections: 0,
      image_url: newProjImage || null
    };

    const { error } = await supabase.from('projects').insert([newProj]);
    if (error) {
      alert('Error creating project: ' + error.message);
      return;
    }

    setProjectsList(prev => [...prev, mapDbProjectToItem(newProj)]);
    setNewProjId('');
    setNewProjTitle('');
    setNewProjTag('');
    setNewProjCollab('');
    setNewProjDesc('');
    setNewProjImage('');
    showNotification(`New project "${newProjTitle}" created successfully!`);
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProj) return;

    const { error } = await supabase.from('projects').update({
      name: editProjTitle,
      description: editProjDesc,
      organization: editProjCollab,
      image_url: editProjImage || null
    }).eq('id', editingProj.id);

    if (error) {
      alert('Error updating project: ' + error.message);
      return;
    }

    setProjectsList(prev => prev.map(p => p.id === editingProj.id ? {
      ...p,
      title: editProjTitle,
      description: editProjDesc,
      collaboration: editProjCollab,
      image: editProjImage || 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80'
    } : p));

    setEditingProj(null);
    showNotification('Project updated successfully!');
  };

  // Handler: Register Site
  const handleRegisterSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteId || !newSiteName) return;

    const siteId = normalizeSiteCode(newSiteId).toUpperCase();
    const newSite = {
      id: siteId,
      project_id: newSiteProjId,
      name: newSiteName,
      elevation: newSiteElev,
      status: 'Active',
      latitude: newSiteLat !== '' ? Number(newSiteLat) : 13.58,
      longitude: newSiteLng !== '' ? Number(newSiteLng) : 75.64,
      expected_files: newSiteFiles !== '' ? Number(newSiteFiles) : 48
    };

    const { error } = await supabase.from('sites').insert([newSite]);
    if (error) {
      alert('Error registering site: ' + error.message);
      return;
    }

    setSitesList(prev => [...prev, mapDbSiteToItem(newSite)]);
    setNewSiteId('');
    setNewSiteName('');
    showNotification(`Site "${newSiteName}" registered with coordinates (${newSiteLat}, ${newSiteLng}).`);
  };

  const handleDeleteSite = async (siteId: string) => {
    const { error } = await supabase.from('sites').delete().eq('id', siteId);
    if (error) {
      alert('Error deleting site: ' + error.message);
      return;
    }
    setSitesList(prev => prev.filter(s => s.id !== siteId));
    showNotification(`Site ${siteId} removed.`);
  };

  const handleEditSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    const { error } = await supabase.from('sites').update({
      name: editSiteName,
      elevation: editSiteElev,
      latitude: editSiteLat !== '' ? Number(editSiteLat) : null,
      longitude: editSiteLng !== '' ? Number(editSiteLng) : null,
      project_id: editSiteProjId
    }).eq('id', editingSite.id);

    if (error) {
      alert('Error updating site: ' + error.message);
      return;
    }

    setSitesList(prev => prev.map(s => s.id === editingSite.id ? {
      ...s,
      name: editSiteName,
      elevation: editSiteElev,
      latitude: editSiteLat !== '' ? Number(editSiteLat) : 13.58,
      longitude: editSiteLng !== '' ? Number(editSiteLng) : 75.64,
      projectId: editSiteProjId
    } : s));

    setEditingSite(null);
    showNotification('Site details updated successfully!');
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm(`Are you sure you want to delete project "${projectId}"? This will remove all associated sites and detections.`)) {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) {
        alert('Error deleting project: ' + error.message);
        return;
      }
      setProjectsList(prev => prev.filter(p => p.id !== projectId));
      showNotification(`Project ${projectId} deleted successfully.`);
    }
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 font-black text-xs uppercase tracking-wider">
            <Database className="w-3.5 h-3.5" />
            <span>Admin Console Section 2</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            2. PAM Data & Historical File Admin Console
          </h1>
          <p className="text-slate-300 text-xs font-medium max-w-xl">
            Ingest batch BirdNET CSV result sheets, parse SD card data, manage project transects, register site coordinates, and curate species traits.
          </p>
        </div>
      </div>

      {/* PAM Admin Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-black">
        <button
          onClick={() => setActiveTab('upload')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'upload' 
              ? 'border-indigo-600 text-indigo-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" /> 1. Files & Batch CSV Parser
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'projects' 
              ? 'border-indigo-600 text-indigo-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FolderPlus className="w-4 h-4" /> 2. Projects & Site Coordinates
        </button>

        <button
          onClick={() => setActiveTab('species')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'species' 
              ? 'border-indigo-600 text-indigo-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Bird className="w-4 h-4" /> 3. Species Ecology Curator
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: Batch Files & Ingestion Engine */}
      {activeTab === 'upload' && (
        <div className="p-8 rounded-[28px] bg-white border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Batch BirdNET Acoustic Result Files & SD Card Ingestion Engine
            </h2>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">Filename Code Parser</span>
          </div>

          <form onSubmit={handleBatchUploadSubmit} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">Target Project Scope</label>
                <select
                  value={selectedUploadProjId}
                  onChange={(e) => setSelectedUploadProjId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                >
                  {projectsList.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">Target Site Node</label>
                <select
                  value={selectedUploadSiteId}
                  onChange={(e) => setSelectedUploadSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                >
                  {sitesList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 text-center space-y-3 transition cursor-pointer relative">
              <Upload className="w-8 h-8 text-indigo-600 mx-auto" />
              <div>
                <div className="font-extrabold text-slate-900">Select or Drag BirdNET CSV / Audio Files Here</div>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Supports <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">.BirdNET.results.csv</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">.txt</code>, and raw audio files.
                </p>
              </div>
              <input
                type="file"
                multiple
                accept=".csv,.txt,.wav,.mp3"
                onChange={handleCsvFilePicker}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>

            {/* If Filename Code Parser detects a new unregistered site */}
            {csvSiteAction === 'create' && parsedSiteCode && (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Unregistered Site Code Detected: &quot;{parsedSiteCode}&quot;</span>
                </div>
                <p className="text-slate-600 text-[11px] font-medium">
                  The uploaded file filename contains site code <strong className="font-mono text-slate-900">{parsedSiteCode}</strong> which is not in the site directory. Please enter coordinates to register this site automatically during upload:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Site Name</label>
                    <input
                      type="text"
                      value={csvNewSiteName}
                      onChange={(e) => setCsvNewSiteName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Latitude (°N)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={csvNewSiteLat}
                      onChange={(e) => setCsvNewSiteLat(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Longitude (°E)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={csvNewSiteLng}
                      onChange={(e) => setCsvNewSiteLng(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Elevation</label>
                    <input
                      type="text"
                      value={csvNewSiteElev}
                      onChange={(e) => setCsvNewSiteElev(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {uploadFiles.length > 0 && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Selected Files: {uploadFiles.length} file(s)</span>
                  {parsedSiteCode && (
                    <span className="text-[10px] font-mono bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-md">
                      Parsed Site Code: {parsedSiteCode}
                    </span>
                  )}
                </div>
                <ul className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-600">
                  {uploadFiles.map((f, i) => (
                    <li key={i} className="truncate">• {f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={uploadFiles.length === 0}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black shadow-md shadow-indigo-600/20"
              >
                Ingest & Process Batch PAM Dataset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Projects & Site Coordinates */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          {/* Create Project Card */}
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FolderPlus className="w-4 h-4 text-emerald-600" /> Create New Research Project
            </h3>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Project ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. prj-canopy-04"
                    value={newProjId}
                    onChange={(e) => setNewProjId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Project Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shola Forest Bird Survey"
                    value={newProjTitle}
                    onChange={(e) => setNewProjTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Lead Collaboration</label>
                  <input
                    type="text"
                    placeholder="e.g. IISER Tirupati Bird Lab"
                    value={newProjCollab}
                    onChange={(e) => setNewProjCollab(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Project monitoring objectives and landscape overview..."
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/... or /Shola_Trust.png"
                  value={newProjImage}
                  onChange={(e) => setNewProjImage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/20"
                >
                  Create Project Entry
                </button>
              </div>
            </form>
          </div>

          {/* Active PAM Projects Directory */}
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-600" /> Active PAM Research Projects Directory ({projectsList.length})
              </span>
            </h3>

            <div className="space-y-3">
              {projectsList.map(p => (
                <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">{p.id}</span>
                      <h4 className="font-extrabold text-slate-900 text-sm">{p.title}</h4>
                    </div>
                    <p className="text-slate-500 text-[11px] font-medium">{p.description}</p>
                    <div className="text-[10px] text-slate-400 font-mono">Lead: {p.collaboration || 'IISER Tirupati Bird Lab'}</div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => {
                        setEditingProj(p);
                        setEditProjTitle(p.title);
                        setEditProjDesc(p.description || '');
                        setEditProjCollab(p.collaboration || '');
                        setEditProjImage(p.image || '');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold flex items-center gap-1.5 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Project</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProject(p.id)}
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

          {/* Register Site Coordinates Card */}
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4 text-indigo-600" /> Register Site Coordinates under Project
            </h3>

            <form onSubmit={handleRegisterSite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Project Scope</label>
                  <select
                    value={newSiteProjId}
                    onChange={(e) => setNewSiteProjId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  >
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Site ID Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LC_03"
                    value={newSiteId}
                    onChange={(e) => setNewSiteId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Site Description Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stream Valley Corridor"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newSiteLat}
                    onChange={(e) => setNewSiteLat(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newSiteLng}
                    onChange={(e) => setNewSiteLng(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Elevation</label>
                  <input
                    type="text"
                    value={newSiteElev}
                    onChange={(e) => setNewSiteElev(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-600/20"
                >
                  Register Site Coordinates
                </button>
              </div>
            </form>
          </div>

          {/* Registered Sites List */}
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4 text-slate-600" /> Registered Field Sites Directory ({sitesList.length})
            </h3>

            <div className="divide-y divide-slate-100">
              {sitesList.map(s => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900">{s.name} <span className="font-mono text-[10px] text-slate-400">({s.id})</span></div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      GPS: {s.latitude}°N, {s.longitude}°E · Elev: {s.elevation}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingSite(s);
                        setEditSiteName(s.name);
                        setEditSiteElev(s.elevation || '');
                        setEditSiteLat(s.latitude || 13.58);
                        setEditSiteLng(s.longitude || 75.64);
                        setEditSiteProjId(s.projectId);
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      title="Edit Site"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSite(s.id)}
                      className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition"
                      title="Delete Site"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Species Ecology Curator */}
      {activeTab === 'species' && (
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bird className="w-4 h-4 text-amber-600" /> Avian Species Ecological Traits Curator
            </h3>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600">
            Curate foraging guild, conservation IUCN status, foraging stratum, and vocal activity parameters for species in database.
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProj && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col justify-between text-xs">
            <div className="p-6 bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white relative">
              <button
                onClick={() => setEditingProj(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-black tracking-tight">Edit Project: {editingProj.title}</h2>
              <p className="text-[10px] text-slate-300 font-medium">Modify existing project details and images.</p>
            </div>

            <form onSubmit={handleEditProject} className="p-6 space-y-4">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={editProjTitle}
                  onChange={(e) => setEditProjTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={editProjDesc}
                  onChange={(e) => setEditProjDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Organization / Collaboration</label>
                <input
                  type="text"
                  required
                  value={editProjCollab}
                  onChange={(e) => setEditProjCollab(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/... or /Shola_Trust.png"
                  value={editProjImage}
                  onChange={(e) => setEditProjImage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProj(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {editingSite && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col justify-between text-xs">
            <div className="p-6 bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white relative">
              <button
                onClick={() => setEditingSite(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-black tracking-tight">Edit Site: {editingSite.id}</h2>
              <p className="text-[10px] text-slate-300 font-medium">Modify site description name, coordinates, and project scope.</p>
            </div>

            <form onSubmit={handleEditSite} className="p-6 space-y-4">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Scope</label>
                <select
                  value={editSiteProjId}
                  onChange={(e) => setEditSiteProjId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                >
                  {projectsList.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Site Description Name</label>
                <input
                  type="text"
                  required
                  value={editSiteName}
                  onChange={(e) => setEditSiteName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editSiteLat}
                    onChange={(e) => setEditSiteLat(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={editSiteLng}
                    onChange={(e) => setEditSiteLng(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Elevation</label>
                <input
                  type="text"
                  value={editSiteElev}
                  onChange={(e) => setEditSiteElev(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSite(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
