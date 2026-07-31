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
  type?: string;
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
  type: p.project_type || 'PAM',
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
  
  // Loading states for data ingestion
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');

  // 1. Batch Upload States
  const [selectedUploadProjId, setSelectedUploadProjId] = useState<string>('prj-01');
  const [selectedUploadSiteId, setSelectedUploadSiteId] = useState<string>('stn-01');
  const [selectedUploadRecorderId, setSelectedUploadRecorderId] = useState<string>('LC_01');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [parsedSiteCode, setParsedSiteCode] = useState<string>('');
  const [csvSiteAction, setCsvSiteAction] = useState<'existing' | 'create'>('existing');
  
  // Inline CSV site creation states
  const [csvNewSiteName, setCsvNewSiteName] = useState('');
  const [csvNewSiteElev, setCsvNewSiteElev] = useState('1,200m');
  const [csvNewSiteLat, setCsvNewSiteLat] = useState<number | ''>(13.58);
  const [csvNewSiteLng, setCsvNewSiteLng] = useState<number | ''>(75.64);

  // 2. Projects & Sites Management States
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [sitesList, setSitesList] = useState<SiteItem[]>([]);
  const [recordersList, setRecordersList] = useState<any[]>([]);
  const [tstSitesList, setTstSitesList] = useState<any[]>([]);

  // 3. Species Ecology Curator States
  const [speciesEcologyList, setSpeciesEcologyList] = useState<any[]>([]);
  const [unmappedSpecies, setUnmappedSpecies] = useState<string[]>([]);
  const [speciesScopeTab, setSpeciesScopeTab] = useState<'tst_sites' | 'common_sites'>('tst_sites');

  // Form for New Species Trait Entry
  const [newSciName, setNewSciName] = useState('');
  const [newComName, setNewComName] = useState('');
  const [newIucn, setNewIucn] = useState('LC');
  const [newGuild, setNewGuild] = useState('Insectivore');
  const [newHabitat, setNewHabitat] = useState('Shola Forest / Canopy');
  const [newStratum, setNewStratum] = useState('High canopy');
  const [newEndemic, setNewEndemic] = useState('Western Ghats Endemic');
  const [newImgLink, setNewImgLink] = useState('');
  const [newAudioLink, setNewAudioLink] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Form: Register New Site & Recorder
  const [newSiteProjId, setNewSiteProjId] = useState('');
  const [newSiteId, setNewSiteId] = useState('');
  const [newRecorderId, setNewRecorderId] = useState('LC_01');

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingAudio(true);

    try {
      const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('species-audio-bucket')
        .upload(filename, file, { upsert: true });

      if (error) {
        const { data: d2, error: e2 } = await supabase.storage
          .from('audio-clips')
          .upload(filename, file, { upsert: true });

        if (e2) {
          alert('Audio upload error: ' + e2.message);
          return;
        }
        const publicUrl = supabase.storage.from('audio-clips').getPublicUrl(filename).data.publicUrl;
        setNewAudioLink(publicUrl);
      } else {
        const publicUrl = supabase.storage.from('species-audio-bucket').getPublicUrl(filename).data.publicUrl;
        setNewAudioLink(publicUrl);
      }
      showNotification('Avian call audio clip uploaded to species-audio-bucket!');
    } catch (err: any) {
      alert('Upload error: ' + err.message);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: projs }, { data: sitesData }, { data: tstSites }, { data: speciesEco }, { data: tstDets }] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('created_at', { ascending: false }),
          supabase.from('tst_sites').select('*').order('site_name'),
          supabase.from('tst_species_ecology').select('*').order('scientific_name'),
          supabase.from('tst_detections').select('common_name, scientific_name').limit(500)
        ]);

        if (projs) setProjectsList(projs.map(mapDbProjectToItem));
        if (sitesData) setSitesList(sitesData.map(mapDbSiteToItem));
        if (tstSites) setTstSitesList(tstSites);
        if (speciesEco) setSpeciesEcologyList(speciesEco);

        // Find detected taxa not yet curated in tst_species_ecology
        if (tstDets && speciesEco) {
          const mappedSet = new Set(speciesEco.map((s: any) => s.common_name.toLowerCase()));
          const unmapped = Array.from(new Set(
            tstDets
              .map((d: any) => d.common_name)
              .filter((name: string) => name && !mappedSet.has(name.toLowerCase()))
          ));
          setUnmappedSpecies(unmapped);
        }
      } catch (e) {
        console.error('Failed to fetch PAM admin data from Supabase:', e);
      }
    }
    loadData();
  }, []);

  // Form: Create New Project
  const [newProjId, setNewProjId] = useState('');
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjCategory, setNewProjCategory] = useState<'PAM' | 'TST'>('PAM');
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
  const [editProjType, setEditProjType] = useState('PAM');

  // Edit Site Modal States
  const [editingSite, setEditingSite] = useState<SiteItem | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteElev, setEditSiteElev] = useState('');
  const [editSiteLat, setEditSiteLat] = useState<number | ''>(13.58);
  const [editSiteLng, setEditSiteLng] = useState<number | ''>(75.64);
  const [editSiteProjId, setEditSiteProjId] = useState('');

  // Synchronize newSiteProjId and selectedUploadProjId with first project ID on projectsList load
  useEffect(() => {
    if (projectsList.length > 0) {
      const existsNew = projectsList.some(p => p.id === newSiteProjId);
      if (!existsNew) {
        setNewSiteProjId(projectsList[0].id);
      }
      const existsUpload = projectsList.some(p => p.id === selectedUploadProjId);
      if (!existsUpload) {
        setSelectedUploadProjId(projectsList[0].id);
      }
    }
  }, [projectsList, newSiteProjId, selectedUploadProjId]);

  // Synchronize selectedUploadSiteId to first site belonging to selected project
  useEffect(() => {
    const sitesForProject = sitesList.filter(s => s.projectId === selectedUploadProjId);
    if (sitesForProject.length > 0) {
      const stillValid = sitesForProject.some(s => s.id === selectedUploadSiteId);
      if (!stillValid) {
        setSelectedUploadSiteId(sitesForProject[0].id);
      }
    }
  }, [sitesList, selectedUploadProjId]);
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
      // Don't auto-set site name from filename — use the dropdown-selected site name instead

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

    // Use the dropdown-selected site (not the filename-parsed code)
    const selectedSite = sitesList.find(s => s.id === selectedUploadSiteId);
    const effectiveSiteId = selectedSite?.id || parsedSiteCode || 'unknown';
    const effectiveSiteName = selectedSite?.name || csvNewSiteName || effectiveSiteId;

    setIsUploading(true);
    setUploadProgress(0);
    try {

      // 2. Parse the uploaded Raven Selection Table files (.txt) and save detections to Supabase!
      let totalInserted = 0;
      for (let idx = 0; idx < uploadFiles.length; idx++) {
        const file = uploadFiles[idx];
        setUploadingFileName(`Ingesting: ${file.name}...`);
        setUploadProgress(Math.round((idx / uploadFiles.length) * 100));
        try {
          const text = await file.text();
          const lines = text.split(/\r?\n/);
          if (lines.length < 2) {
            alert(`File ${file.name} is empty or has only one line.`);
            continue;
          }

          // Parse tab-separated headers
          const header = lines[0].split('\t');
          const commonNameIdx = header.indexOf('Common Name');
          const confidenceIdx = header.indexOf('Confidence');
          const beginPathIdx = header.indexOf('Begin Path');

          if (commonNameIdx === -1 || confidenceIdx === -1) {
            alert(`File ${file.name} is missing 'Common Name' or 'Confidence' column. Columns found: ${header.join(', ')}`);
            continue;
          }

          const detectionsToInsert: any[] = [];

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split('\t');
            if (cols.length <= Math.max(commonNameIdx, confidenceIdx)) continue;

            const commonName = cols[commonNameIdx]?.trim();
            const confidenceVal = parseFloat(cols[confidenceIdx]);
            if (!commonName || isNaN(confidenceVal)) continue;

            // Attempt to extract timestamp from filename (e.g. TST-LC03_20260315_073000.wav)
            let timestamp = new Date();
            const beginPath = beginPathIdx !== -1 ? cols[beginPathIdx] : '';
            const filename = beginPath.split(/[\\/]/).pop() || '';
            
            // Match YYYYMMDD_HHMMSS patterns in filename
            const dateMatch = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
            if (dateMatch) {
              const [_, y, m, d, hh, mm, ss] = dateMatch;
              timestamp = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
            }

            const dateStr = timestamp.toISOString().split('T')[0];
            const timeStr = timestamp.toISOString().split('T')[1].split('.')[0];

            if (selectedUploadProjId === 'tst') {
              detectionsToInsert.push({
                project_name: selectedUploadProjId,
                site_name: effectiveSiteName,
                recorder_name: selectedUploadRecorderId,
                recorder_id: selectedUploadRecorderId,
                date: dateStr,
                time: timeStr,
                start_time: 0.0,
                end_time: 3.0,
                common_name: commonName,
                scientific_name: commonName,
                threshold: confidenceVal,
                file_name: file.name
              });
            } else {
              detectionsToInsert.push({
                project_name: selectedUploadProjId,
                site_name: effectiveSiteName,
                recorder_name: selectedUploadRecorderId,
                date: dateStr,
                time: timeStr,
                start_time: 0.0,
                end_time: 3.0,
                common_name: commonName,
                scientific_name: commonName,
                confidence: confidenceVal,
                file_name: file.name
              });
            }
          }

          if (detectionsToInsert.length > 0) {
            // Bulk insert in chunks of 500 rows to prevent payload limits
            const chunkSize = 500;
            for (let offset = 0; offset < detectionsToInsert.length; offset += chunkSize) {
              const chunk = detectionsToInsert.slice(offset, offset + chunkSize);
              const { error } = await supabase.from('live_detections').insert(chunk);
              if (error) {
                alert(`Error inserting detections for ${file.name}: ` + error.message);
              } else {
                totalInserted += chunk.length;
              }
            }
          }
        } catch (err: any) {
          alert(`Error reading file ${file.name}: ` + err.message);
        }
      }

      alert(`Processed ${uploadFiles.length} file(s). Successfully saved ${totalInserted} detections to the database!`);
      setUploadFiles([]);
      setParsedSiteCode('');
    } catch (globalErr: any) {
      alert('Global upload error: ' + globalErr.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');
    }
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
      project_type: 'PAM', // Set project_type to 'PAM' to satisfy database constraint projects_project_type_check ('PAM', 'Live')
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
      project_type: editProjType,
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
      type: editProjType,
      description: editProjDesc,
      collaboration: editProjCollab,
      image: editProjImage || p.image
    } : p));

    setEditingProj(null);
    showNotification('Project updated successfully!');
  };

  // Handler: Register Site
  const handleRegisterSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteId || !newRecorderId) return;

    const siteName = normalizeSiteCode(newSiteId).toUpperCase();
    const proj = projectsList.find(p => p.id === newSiteProjId);
    const projName = proj?.title || 'PAM Project';

    const recorderRecord: any = {
      id: `${projName}_${siteName}_${newRecorderId}`,
      project_type: 'PAM',
      project_name: projName,
      site_name: siteName,
      recorder_id: newRecorderId,
      status: 'offline',
      lat: newSiteLat !== '' ? Number(newSiteLat) : null,
      long: newSiteLng !== '' ? Number(newSiteLng) : null
    };

    if (proj?.type !== 'tst') {
      recorderRecord.elevation = newSiteElev || null;
    }

    const { error } = await supabase.from('recorders_registry').upsert([recorderRecord], { onConflict: 'id' });

    if (error) {
      alert('Error registering recorder: ' + error.message);
      return;
    }

    setNewSiteId('');
    setNewRecorderId('');
    showNotification(`Recorder "${newRecorderId}" registered at site "${siteName}"!`);
  };

  const handleAddSpeciesEcology = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSciName || !newComName) return;

    const record: any = {
      scientific_name: newSciName,
      common_name: newComName,
      iucn_status: newIucn,
      guild: newGuild,
      habitat: newHabitat,
      foraging_stratum: newStratum,
      endemic_status: newEndemic
    };

    if (newImgLink) record.image_link = newImgLink;
    if (newAudioLink) record.audio_link = newAudioLink;

    let { error } = await supabase.from('tst_species_ecology').upsert([record], { onConflict: 'scientific_name' });

    // Fallback if audio_link/image_link columns are missing in DB schema cache
    if (error && error.message.includes('column')) {
      const coreRecord = {
        scientific_name: newSciName,
        common_name: newComName,
        iucn_status: newIucn,
        guild: newGuild,
        habitat: newHabitat,
        foraging_stratum: newStratum,
        endemic_status: newEndemic
      };
      const { error: coreErr } = await supabase.from('tst_species_ecology').upsert([coreRecord], { onConflict: 'scientific_name' });
      error = coreErr;
    }

    if (error) {
      alert('Error saving species trait entry: ' + error.message);
      return;
    }

    setSpeciesEcologyList(prev => [record, ...prev.filter(s => s.scientific_name !== newSciName)]);
    setUnmappedSpecies(prev => prev.filter(name => name.toLowerCase() !== newComName.toLowerCase()));
    setNewSciName('');
    setNewComName('');
    setNewImgLink('');
    setNewAudioLink('');
    showNotification(`Species trait record for "${newComName}" saved successfully!`);
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
        <div className="p-8 rounded-[28px] bg-white border border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
          {/* Loading Progress Indicator Overlay */}
          {isUploading && (
            <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-200">
              <div className="relative w-20 h-20 flex items-center justify-center">
                {/* Pulsating outer ring */}
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-pulse"></div>
                {/* Spinning loader */}
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                <FileSpreadsheet className="w-8 h-8 text-indigo-600 animate-bounce" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-sm font-black text-slate-900">Ingesting Bioacoustic Detections...</h3>
                <p className="text-[10px] text-slate-500 font-mono font-bold max-w-xs truncate">{uploadingFileName}</p>
              </div>
              {/* Progress Bar Container */}
              <div className="w-full max-w-xs bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="text-[10px] font-black text-indigo-600 font-mono">{uploadProgress}% Complete</div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Batch BirdNET Acoustic Result Files & SD Card Ingestion Engine
            </h2>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">Filename Code Parser</span>
          </div>

          <form onSubmit={handleBatchUploadSubmit} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">1. Target Project Scope</label>
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
                <label className="font-extrabold text-slate-700 block mb-1.5">2. Target Site Node</label>
                <select
                  value={selectedUploadSiteId}
                  onChange={(e) => setSelectedUploadSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                >
                  {sitesList
                    .filter(s => s.projectId === selectedUploadProjId || selectedUploadProjId === 'tst')
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">3. Target Recorder Hardware</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LC_01 or 1"
                  value={selectedUploadRecorderId}
                  onChange={(e) => setSelectedUploadRecorderId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Target Dashboard & Category Scope</label>
                  <select
                    value={newProjCategory}
                    onChange={(e) => setNewProjCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PAM">Common PAM Dashboard Project (Visible in /dashboard/common)</option>
                    <option value="TST">TST Bioacoustic Survey Project (Visible ONLY in /dashboard/tst)</option>
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Project Image URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/... or /Shola_Trust.png"
                    value={newProjImage}
                    onChange={(e) => setNewProjImage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
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
                        setEditProjType(p.type || 'PAM');
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

          {/* Register Site & Recorder Coordinates Card */}
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4 text-indigo-600" /> Register Recorder Hardware GPS Coordinates under Site & Project
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
                  <label className="font-extrabold text-slate-700 block mb-1">Site ID Code / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A11_01 or ATR_01"
                    value={newSiteId}
                    onChange={(e) => setNewSiteId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Recorder Hardware ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LC_01 or 1"
                    value={newRecorderId}
                    onChange={(e) => setNewRecorderId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Recorder Latitude (°N)</label>
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
                  <label className="font-extrabold text-slate-700 block mb-1">Recorder Longitude (°E)</label>
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
                  Register Recorder GPS Coordinates
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
        <div className="space-y-6 text-xs font-sans">
          {/* Top Bar Banner with Unmapped Taxa Scrolling Alert Ticker */}
          {unmappedSpecies.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-900 flex items-center gap-3 overflow-hidden shadow-sm">
              <span className="p-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Unmapped Taxa Detected ({unmappedSpecies.length})
              </span>
              <div className="overflow-hidden whitespace-nowrap w-full">
                <div className="inline-block animate-marquee font-mono text-[11px] font-bold text-amber-800 space-x-6">
                  {unmappedSpecies.map((sp, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 bg-amber-100/80 px-2 py-0.5 rounded-lg border border-amber-200">
                      ⚠️ <strong className="text-slate-900 font-extrabold">{sp}</strong> needs ecology trait curation
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Form to Add/Curate Species Trait */}
            <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Bird className="w-4 h-4 text-emerald-600" /> Curate Avian Trait Entry
              </h3>

              <form onSubmit={handleAddSpeciesEcology} className="space-y-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Scientific Species Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coracias benghalensis"
                    value={newSciName}
                    onChange={(e) => setNewSciName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Common English Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indian Roller"
                    value={newComName}
                    onChange={(e) => setNewComName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-extrabold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">IUCN Status</label>
                    <select
                      value={newIucn}
                      onChange={(e) => setNewIucn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-900"
                    >
                      <option value="LC">LC (Least Concern)</option>
                      <option value="NT">NT (Near Threatened)</option>
                      <option value="VU">VU (Vulnerable)</option>
                      <option value="EN">EN (Endangered)</option>
                      <option value="CR">CR (Critically Endangered)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Feeding Guild</label>
                    <input
                      type="text"
                      value={newGuild}
                      onChange={(e) => setNewGuild(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Preferred Habitat</label>
                  <input
                    type="text"
                    value={newHabitat}
                    onChange={(e) => setNewHabitat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Foraging Stratum</label>
                    <input
                      type="text"
                      value={newStratum}
                      onChange={(e) => setNewStratum(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Endemic Status</label>
                    <input
                      type="text"
                      value={newEndemic}
                      onChange={(e) => setNewEndemic(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Species Photo / Image URL</label>
                  <input
                    type="text"
                    placeholder="https://... or /birds/myna.jpg"
                    value={newImgLink}
                    onChange={(e) => setNewImgLink(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Avian Call Audio (.mp3 / .wav)</label>
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileUpload}
                      className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    {isUploadingAudio && <div className="text-[10px] text-indigo-600 font-extrabold animate-pulse">Uploading audio to species-audio-bucket...</div>}
                    {newAudioLink && (
                      <div className="text-[10px] font-mono text-emerald-600 truncate bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                        🔊 {newAudioLink}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md transition flex items-center justify-center gap-2 mt-2"
                >
                  <Bird className="w-4 h-4" /> Save Species Trait Entry
                </button>
              </form>
            </div>

            {/* Right Column: Database Table View */}
            <div className="lg:col-span-2 p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" /> Avian Ecology Database ({speciesEcologyList.length} Species)
                </h3>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-extrabold text-[10px] uppercase">
                      <th className="pb-2">Taxon / Common Name</th>
                      <th className="pb-2">IUCN</th>
                      <th className="pb-2">Guild</th>
                      <th className="pb-2">Habitat</th>
                      <th className="pb-2">Endemic Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {speciesEcologyList.map((sp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5">
                          <div className="font-extrabold text-slate-900">{sp.common_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono italic">{sp.scientific_name}</div>
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            sp.iucn_status === 'EN' || sp.iucn_status === 'CR' ? 'bg-rose-100 text-rose-800' :
                            sp.iucn_status === 'VU' || sp.iucn_status === 'NT' ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {sp.iucn_status}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-slate-700">{sp.guild}</td>
                        <td className="py-2.5 text-slate-600 truncate max-w-[150px]">{sp.habitat}</td>
                        <td className="py-2.5 font-bold text-indigo-600">{sp.endemic_status}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setNewSciName(sp.scientific_name);
                              setNewComName(sp.common_name);
                              setNewIucn(sp.iucn_status || 'LC');
                              setNewGuild(sp.guild || 'Insectivore');
                              setNewHabitat(sp.habitat || '');
                              setNewStratum(sp.foraging_stratum || '');
                              setNewEndemic(sp.endemic_status || '');
                              setNewImgLink(sp.image_link || '');
                              setNewAudioLink(sp.audio_link || '');
                              showNotification(`Editing species traits for "${sp.common_name}"`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] transition inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
                <label className="font-extrabold text-slate-700 block mb-1">Project Network Dashboard</label>
                <select
                  value={editProjType}
                  onChange={(e) => setEditProjType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="PAM">Common PAM Dashboard</option>
                  <option value="tst">The Shola Trust (TST) Dashboard</option>
                </select>
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
