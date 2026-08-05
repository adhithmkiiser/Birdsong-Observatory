'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  recorderId?: string;
  recorderRegistryId?: string;
  source: 'Lantana' | 'common';
}

const mapDbProjectToItem = (p: any): ProjectItem => ({
  id: p.id,
  type: p.project_type || 'PAM',
  title: p.name,
  tag: 'Bioacoustic Survey',
  collaboration: p.organization || 'IISER Tirupati Bird Lab',
  description: p.description || '',
  image: p.image_url || ''
});

const mapDbSiteToItem = (s: any): SiteItem => ({
  id: s.id,
  projectId: s.project_id,
  name: s.name,
  elevation: s.elevation || '',
  status: s.status || 'Active',
  latitude: s.latitude != null ? Number(s.latitude) : undefined,
  longitude: s.longitude != null ? Number(s.longitude) : undefined,
  expectedFiles: s.expected_files || 0,
  recorderId: s.recorder_id,
  source: 'common'
});

export default function PamAdminPage() {
  const { currentRole, currentUser } = useRole();

  // Active Tab: 'upload' | 'projects' | 'species' | 'detections'
  const [activeTab, setActiveTab] = useState<'upload' | 'projects' | 'species' | 'detections'>('upload');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Loading states for data ingestion
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');

  // 1. Batch Upload States
  const [selectedUploadProjectType, setSelectedUploadProjectType] = useState<'Lantana' | 'Common'>('Lantana');
  const [selectedUploadProjId, setSelectedUploadProjId] = useState<string>('');
  const [selectedUploadSiteId, setSelectedUploadSiteId] = useState<string>('');
  const [selectedUploadRecorderId, setSelectedUploadRecorderId] = useState<string>('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [parsedSiteCode, setParsedSiteCode] = useState<string>('');
  const [csvSiteAction, setCsvSiteAction] = useState<'existing' | 'create'>('existing');
  
  // Inline CSV site creation states
  const [csvNewSiteName, setCsvNewSiteName] = useState('');
  const [csvNewSiteElev, setCsvNewSiteElev] = useState('');
  const [csvNewSiteLat, setCsvNewSiteLat] = useState<number | ''>('');
  const [csvNewSiteLng, setCsvNewSiteLng] = useState<number | ''>('');

  // 2. Projects & Sites Management States
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [sitesList, setSitesList] = useState<SiteItem[]>([]);
  const [lantanaSitesList, setlantanaSitesList] = useState<any[]>([]);
  
  // Hierarchical filtering states
  const [selectedProjectType, setSelectedProjectType] = useState<'Lantana' | 'Common'>('Lantana');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // 3. Species Ecology Curator States
  const [speciesEcologyList, setSpeciesEcologyList] = useState<any[]>([]);
  const [unmappedSpecies, setUnmappedSpecies] = useState<string[]>([]);
  const [speciesScopeTab, setSpeciesScopeTab] = useState<'lantana_sites' | 'common_sites'>('lantana_sites');

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

  // 4. Detections Data Management States
  const [detectionsTabScope, setDetectionsTabScope] = useState<'Lantana' | 'Common'>('Lantana');
  const [pamDetectionsList, setPamDetectionsList] = useState<any[]>([]);
  
  // Sorting & Filtering for PAM Detections
  const [pamFilterProject, setPamFilterProject] = useState('All');
  const [pamFilterSite, setPamFilterSite] = useState('All');
  const [pamFilterRecorder, setPamFilterRecorder] = useState('All');
  const [pamSortDateDesc, setPamSortDateDesc] = useState(true);



  const filteredPamDetections = useMemo(() => {
    let result = pamDetectionsList.filter(d => {
      const proj = d.project_name || 'N/A';
      const site = d.site_name || 'N/A';
      const rec = d.recorder_name || d.recorder_id || 'N/A';
      if (pamFilterProject !== 'All' && proj !== pamFilterProject) return false;
      if (pamFilterSite !== 'All' && site !== pamFilterSite) return false;
      if (pamFilterRecorder !== 'All' && rec !== pamFilterRecorder) return false;
      return true;
    });
    
    result.sort((a, b) => {
      const timeStrA = a.date && a.time ? `${a.date}T${a.time}` : (a.created_at || '0');
      const timeStrB = b.date && b.time ? `${b.date}T${b.time}` : (b.created_at || '0');
      const da = new Date(timeStrA).getTime();
      const db = new Date(timeStrB).getTime();
      return pamSortDateDesc ? db - da : da - db;
    });
    
    return result;
  }, [pamDetectionsList, pamFilterProject, pamFilterSite, pamFilterRecorder, pamSortDateDesc]);

  const pamFilterOptions = useMemo(() => {
    const projects = Array.from(new Set(pamDetectionsList.map(d => d.project_name || 'N/A'))).sort();
    const sites = Array.from(new Set(pamDetectionsList.map(d => d.site_name || 'N/A'))).sort();
    const recorders = Array.from(new Set(pamDetectionsList.map(d => d.recorder_name || d.recorder_id || 'N/A'))).sort();
    return { projects, sites, recorders };
  }, [pamDetectionsList]);

  // Fetch detections based on scope when tab is active
  useEffect(() => {
    if (activeTab === 'detections') {
      const fetchDetections = async () => {
        const table = detectionsTabScope === 'Lantana' ? 'lantana_detections' : 'pam_detections';
        const { data } = await supabase.from(table).select('*').order('id', { ascending: false }).limit(2000);
        if (data) setPamDetectionsList(data);
      };
      fetchDetections();
    }
  }, [activeTab, detectionsTabScope]);

  const handleDeletePamDetection = async (id: number) => {
    if (confirm('Are you sure you want to delete this detection row?')) {
      const table = detectionsTabScope === 'Lantana' ? 'lantana_detections' : 'pam_detections';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        alert('Error deleting detection: ' + error.message);
        return;
      }
      setPamDetectionsList(prev => prev.filter(d => d.id !== id));
      showNotification('Detection row deleted successfully.');
    }
  };

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
        const [{ data: projs }, { data: sitesData }, { data: lantanaSites }, { data: speciesEco }, { data: lantanaDets }] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('created_at', { ascending: false }),
          supabase.from('lantana_sites').select('*').order('site_name'),
          supabase.from('lantana_species_ecology').select('*').order('scientific_name'),
          supabase.from('lantana_detections').select('common_name, scientific_name').limit(500)
        ]);

        if (projs) setProjectsList(projs.map(mapDbProjectToItem));
        if (sitesData) setSitesList(sitesData.map(mapDbSiteToItem));
        if (lantanaSites) setlantanaSitesList(lantanaSites);
        if (speciesEco) setSpeciesEcologyList(speciesEco);

        // Default to the first Lantana Project, since the admin page opens on the Lantana scope
        if (projs && projs.length > 0) {
          const lantanaProject = projs.find(p => p.project_type === 'Lantana');
          setSelectedProjectId(lantanaProject?.id || '');
        }

        // Find detected taxa not yet curated in lantana_species_ecology
        if (lantanaDets && speciesEco) {
          const mappedSet = new Set(speciesEco.map((s: any) => s.common_name.toLowerCase()));
          const unmapped = Array.from(new Set(
            lantanaDets
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
  const [newProjCategory, setNewProjCategory] = useState<'PAM' | 'Lantana'>('PAM');
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
  const [editRecorderId, setEditRecorderId] = useState('');

  // Synchronize project selection when project type changes
  useEffect(() => {
    if (projectsList.length > 0) {
      // Filter projects based on selected type
      const filteredProjects = selectedProjectType === 'Lantana'
        ? projectsList.filter(p => p.type === 'Lantana')
        : projectsList.filter(p => p.type !== 'Lantana');
      
      if (filteredProjects.length > 0) {
        const newProjectId = filteredProjects[0].id;
        setSelectedProjectId(newProjectId);
        setNewSiteProjId(newProjectId);
        setSelectedUploadProjId(newProjectId);
      }
    }
  }, [selectedProjectType, projectsList]);

  // Synchronize selectedUploadSiteId to first site belonging to selected upload project
  useEffect(() => {
    const uploadSites = getUploadSites();
    if (uploadSites.length > 0) {
      const stillValid = uploadSites.some(s => s.id === selectedUploadSiteId);
      if (!stillValid) {
        setSelectedUploadSiteId(uploadSites[0].id);
      }
    }
  }, [selectedUploadProjId, selectedUploadProjectType, sitesList, lantanaSitesList]);

  // Synchronize selectedUploadRecorderId when site or project type changes
  useEffect(() => {
    const recorders = getUploadRecorders();
    if (recorders.length > 0) {
      const stillValid = recorders.some(r => r === selectedUploadRecorderId);
      if (!stillValid) {
        setSelectedUploadRecorderId(recorders[0]);
      }
    } else {
      setSelectedUploadRecorderId('');
    }
  }, [selectedUploadSiteId, selectedUploadProjectType, sitesList, lantanaSitesList]);

  // Helper function to get filtered sites based on project type and selected project
  const getFilteredSites = () => {
    if (selectedProjectType === 'Lantana') {
      // For Lantana, use lantana_sites table, scoped to selected project
      return lantanaSitesList
        .filter((lantanaSite: any) => {
          if (!permittedSiteIds.has(lantanaSite.id)) return false;
          if (!selectedProjectId) return true;
          if (lantanaSite.project_id) return lantanaSite.project_id === selectedProjectId;
          return String(lantanaSite.id || '').startsWith(`${selectedProjectId}_`);
        })
        .map((lantanaSite: any) => {
          const idParts = String(lantanaSite.id || '').split('_');
          const derivedRecorderId = idParts.length >= 3 ? idParts.slice(2).join('_') : (lantanaSite.recorder_id || lantanaSite.id);
          return {
            id: lantanaSite.id,
            projectId: lantanaSite.project_id || idParts[0] || '',
            name: lantanaSite.site_name || idParts[1] || lantanaSite.id,
            elevation: lantanaSite.elevation || '',
            status: 'Active',
            latitude: lantanaSite.lat != null ? Number(lantanaSite.lat) : undefined,
            longitude: lantanaSite.long != null ? Number(lantanaSite.long) : undefined,
            expectedFiles: lantanaSite.number_of_files || 0,
            recorderId: lantanaSite.recorder_id || derivedRecorderId,
            source: 'Lantana' as const
          };
        });
    } else {
      // For Common, use sites table filtered by selected project
      return sitesList.filter(s => s.projectId === selectedProjectId && permittedSiteIds.has(s.id));
    }
  };

  // Helper function to get filtered projects based on project type
  const getFilteredProjects = () => {
    const base = selectedProjectType === 'Lantana'
      ? projectsList.filter(p => p.type === 'Lantana')
      : projectsList.filter(p => p.type !== 'Lantana');
    return base.filter(p => permittedProjectIds.has(p.id));
  };

  // Helper functions for the batch upload tab dropdown cascade
  const getUploadProjects = () => {
    const base = selectedUploadProjectType === 'Lantana'
      ? projectsList.filter(p => p.type === 'Lantana')
      : projectsList.filter(p => p.type !== 'Lantana');
    return base.filter(p => permittedProjectIds.has(p.id));
  };

  const getUploadSites = () => {
    if (selectedUploadProjectType === 'Lantana') {
      return lantanaSitesList
        .filter((lantanaSite: any) => {
          if (!permittedSiteIds.has(lantanaSite.id)) return false;
          if (!selectedUploadProjId) return true;
          if (lantanaSite.project_id) return lantanaSite.project_id === selectedUploadProjId;
          return String(lantanaSite.id || '').startsWith(`${selectedUploadProjId}_`);
        })
        .map((lantanaSite: any) => {
          const idParts = String(lantanaSite.id || '').split('_');
          const derivedRecorderId = idParts.length >= 3 ? idParts.slice(2).join('_') : (lantanaSite.recorder_id || lantanaSite.id);
          return {
            id: lantanaSite.id,
            projectId: lantanaSite.project_id || idParts[0] || '',
            name: lantanaSite.site_name || idParts[1] || lantanaSite.id,
            elevation: lantanaSite.elevation || '',
            status: 'Active',
            latitude: lantanaSite.lat != null ? Number(lantanaSite.lat) : undefined,
            longitude: lantanaSite.long != null ? Number(lantanaSite.long) : undefined,
            expectedFiles: lantanaSite.number_of_files || 0,
            recorderId: lantanaSite.recorder_id || derivedRecorderId,
            source: 'Lantana' as const
          };
        });
    }
    return sitesList.filter(s => s.projectId === selectedUploadProjId && permittedSiteIds.has(s.id));
  };

  const getUploadRecorders = () => {
    if (selectedUploadProjectType === 'Lantana') {
      const selectedSite = getUploadSites().find(s => s.id === selectedUploadSiteId);
      if (selectedSite?.recorderId) return [selectedSite.recorderId];
      return [];
    }
    // For Common PAM, no pre-registered recorder; the user must type the recorder ID
    return [];
  };
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteElev, setNewSiteElev] = useState('');
  const [newSiteLat, setNewSiteLat] = useState<number | ''>('');
  const [newSiteLng, setNewSiteLng] = useState<number | ''>('');
  const [newSiteFiles, setNewSiteFiles] = useState<number | ''>('');

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const permittedProjectIds = useMemo(() => {
    if (currentRole === 'Admin') return new Set(projectsList.map(p => p.id));
    if (currentRole === 'Project Manager') return new Set(currentUser?.assignedProjects || []);
    if (currentRole === 'Site Manager') {
      const set = new Set<string>();
      sitesList.forEach(s => { if (currentUser?.assignedSites?.includes(s.id)) set.add(s.projectId); });
      lantanaSitesList.forEach(s => { if (currentUser?.assignedSites?.includes(s.id)) set.add(s.project_id || String(s.id).split('_')[0]); });
      return set;
    }
    return new Set<string>();
  }, [currentRole, currentUser, projectsList, sitesList, lantanaSitesList]);

  const permittedSiteIds = useMemo(() => {
    if (currentRole === 'Admin') return new Set(sitesList.map(s => s.id).concat(lantanaSitesList.map(s => s.id)));
    if (currentRole === 'Project Manager') {
      const set = new Set<string>();
      sitesList.forEach(s => { if (currentUser?.assignedProjects?.includes(s.projectId)) set.add(s.id); });
      lantanaSitesList.forEach(s => { if (currentUser?.assignedProjects?.includes(s.project_id || String(s.id).split('_')[0])) set.add(s.id); });
      return set;
    }
    if (currentRole === 'Site Manager') return new Set(currentUser?.assignedSites || []);
    return new Set<string>();
  }, [currentRole, currentUser, sitesList, lantanaSitesList]);

  // Helper: Normalize Site Code (e.g. LNT-LC03 -> lc_03)
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
      const lantanaMatch = filename.match(/LNT-([A-Za-z0-9]+)/);
      if (lantanaMatch) {
        code = normalizeSiteCode(lantanaMatch[1]);
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

    // Resolve selected site and project from the upload cascade
    const uploadSite = getUploadSites().find(s => s.id === selectedUploadSiteId);
    const effectiveSiteName = uploadSite?.name || csvNewSiteName || selectedUploadSiteId || 'unknown';
    const effectiveRecorderId = selectedUploadRecorderId || uploadSite?.recorderId || 'unknown';
    const targetTable = selectedUploadProjectType === 'Lantana' ? 'lantana_detections' : 'pam_detections';

    setIsUploading(true);
    setUploadProgress(0);
    try {

      // Parse the uploaded Raven Selection Table files (.txt) and save detections to Supabase
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

          // Detect delimiter: tab for Raven .txt, comma for BirdNET .csv
          const isCsv = file.name.toLowerCase().endsWith('.csv') || lines[0].includes(',');
          const delimiter = isCsv ? ',' : '\t';
          const findHeader = (headers: string[], name: string) =>
            headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());

          const rawHeader = lines[0].split(delimiter);
          const header = rawHeader.map(h => h.trim());
          const commonNameIdx = findHeader(header, 'Common Name');
          const confidenceIdx = findHeader(header, 'Confidence');
          const sciNameIdx = findHeader(header, 'Scientific name');
          const startIdx = findHeader(header, 'Start (s)');
          const endIdx = findHeader(header, 'End (s)');
          const fileIdx = findHeader(header, 'File');

          if (commonNameIdx === -1 || confidenceIdx === -1) {
            alert(`File ${file.name} is missing 'Common Name' or 'Confidence' column. Columns found: ${header.join(', ')}`);
            continue;
          }

          const detectionsToInsert: any[] = [];

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(delimiter);
            if (cols.length <= Math.max(commonNameIdx, confidenceIdx)) continue;

            const commonName = cols[commonNameIdx]?.trim();
            const confidenceVal = parseFloat(cols[confidenceIdx]);
            if (!commonName || isNaN(confidenceVal)) continue;

            const scientificName = (sciNameIdx !== -1 && cols[sciNameIdx]?.trim())
              ? cols[sciNameIdx].trim()
              : commonName;
            const startSeconds = (startIdx !== -1 && cols[startIdx]?.trim())
              ? parseFloat(cols[startIdx])
              : 0.0;
            const endSeconds = (endIdx !== -1 && cols[endIdx]?.trim())
              ? parseFloat(cols[endIdx])
              : (startSeconds + 3.0);
            const fileValue = (fileIdx !== -1 && cols[fileIdx]?.trim())
              ? cols[fileIdx].trim()
              : '';

            // Derive audio filename from 'File' column or fallback to upload filename
            const sourceFilename = fileValue.split(/[\\/]/).pop() || file.name;

            // Match YYYYMMDD_HHMMSS patterns in filename and add per-row start offset
            let timestamp = new Date();
            const dateMatch = sourceFilename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
            if (dateMatch) {
              const [_, y, m, d, hh, mm, ss] = dateMatch;
              timestamp = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
              timestamp = new Date(timestamp.getTime() + startSeconds * 1000);
            }

            const dateStr = timestamp.toISOString().split('T')[0];
            const timeStr = timestamp.toISOString().split('T')[1].split('.')[0];

            if (selectedUploadProjectType === 'Lantana') {
              detectionsToInsert.push({
                project_id: selectedUploadProjId,
                project_name: uploadSite?.name || selectedUploadProjId,
                site_name: effectiveSiteName,
                recorder_id: effectiveRecorderId,
                recorder_name: effectiveRecorderId,
                date: dateStr,
                time: timeStr,
                start_time: startSeconds,
                end_time: endSeconds,
                common_name: commonName,
                scientific_name: scientificName,
                threshold: confidenceVal,
                file_name: sourceFilename
              });
            } else {
              detectionsToInsert.push({
                project_name: uploadSite?.name || selectedUploadProjId,
                site_name: effectiveSiteName,
                recorder_name: effectiveRecorderId,
                date: dateStr,
                time: timeStr,
                start_time: startSeconds,
                end_time: endSeconds,
                common_name: commonName,
                scientific_name: scientificName,
                confidence: confidenceVal,
                file_name: sourceFilename
              });
            }
          }

          if (detectionsToInsert.length > 0) {
            // Bulk insert in chunks of 500 rows to prevent payload limits
            const chunkSize = 500;
            for (let offset = 0; offset < detectionsToInsert.length; offset += chunkSize) {
              const chunk = detectionsToInsert.slice(offset, offset + chunkSize);
              const { error } = await supabase.from(targetTable).insert(chunk);
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
    if (currentRole !== 'Admin') {
      alert('Only admins can create new projects.');
      return;
    }
    if (!newProjId || !newProjTitle) return;

    const projectId = newProjId.trim().toLowerCase().replace(/\s+/g, '-');
    const newProj = {
      id: projectId,
      name: newProjTitle,
      description: newProjDesc || 'Project details pending data updates.',
      organization: newProjCollab || 'IISER Tirupati Bird Lab',
      project_type: newProjCategory === 'Lantana' ? 'Lantana' : 'PAM',
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
    setNewProjCategory('PAM');
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
    if (currentRole === 'Site Manager') {
      alert('Site Managers cannot register new sites.');
      return;
    }
    if (!permittedProjectIds.has(newSiteProjId)) {
      alert('You do not have permission to add a site to this project.');
      return;
    }
    if (!newSiteId || !newRecorderId) return;

    const siteName = normalizeSiteCode(newSiteId).toUpperCase();
    const proj = projectsList.find(p => p.id === newSiteProjId);
    const projName = proj?.title || 'PAM Project';

    const siteLatitude = newSiteLat !== '' ? Number(newSiteLat) : null;
    const siteLongitude = newSiteLng !== '' ? Number(newSiteLng) : null;
    const isLantana = selectedProjectType === 'Lantana';

    // Keep Lantana and Common PAM site records in their separate tables.
    const newSite = isLantana ? {
      id: `${newSiteProjId}_${siteName}_${newRecorderId}`,
      site_name: newSiteId,
      project_id: newSiteProjId,
      project_name: projName,
      recorder_id: newRecorderId,
      lat: siteLatitude,
      long: siteLongitude,
      number_of_files: 0,
      number_of_hours: 0,
      total_size_bytes: 0
    } : {
      id: `${newSiteProjId}_${siteName}`,
      project_id: newSiteProjId,
      name: siteName,
      elevation: newSiteElev,
      status: 'Active',
      latitude: siteLatitude,
      longitude: siteLongitude
    };

    const { error: siteError } = await supabase.from(isLantana ? 'lantana_sites' : 'sites').upsert([newSite], { onConflict: 'id' });

    if (siteError) {
      alert('Error registering site: ' + siteError.message);
      return;
    }

    // Update only the selected dataset's local state.
    if (isLantana) {
      setlantanaSitesList(prev => {
        if (prev.some(s => s.id === newSite.id)) return prev;
        return [...prev, newSite];
      });
    } else {
      setSitesList(prev => {
        const scopedSiteId = `${newSiteProjId}_${siteName}`;
        if (prev.some(s => s.id === scopedSiteId)) return prev;
        return [...prev, {
          id: scopedSiteId,
          projectId: newSiteProjId,
          name: siteName,
          elevation: newSiteElev,
          status: 'Active',
          latitude: siteLatitude ?? 0,
          longitude: siteLongitude ?? 0,
          source: 'common'
        }];
      });
    }

    setNewSiteId('');
    setNewRecorderId('');
    showNotification(`Recorder "${newRecorderId}" and Site "${newSiteId}" registered!`);
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

    let { error } = await supabase.from('lantana_species_ecology').upsert([record], { onConflict: 'scientific_name' });

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
      const { error: coreErr } = await supabase.from('lantana_species_ecology').upsert([coreRecord], { onConflict: 'scientific_name' });
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

  const handleDeleteSite = async (site: SiteItem) => {
    const isLantana = site.source === 'Lantana';
    const table = isLantana ? 'lantana_sites' : 'sites';
    const { error } = await supabase.from(table).delete().eq('id', site.id);
    if (error) {
      alert('Error deleting site: ' + error.message);
      return;
    }

    if (isLantana) {
      setlantanaSitesList(prev => prev.filter(s => s.id !== site.id));
    } else {
      setSitesList(prev => prev.filter(s => s.id !== site.id));
    }
    showNotification(`Site ${site.name} removed.`);
  };

  const handleEditSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    const latitude = editSiteLat !== '' ? Number(editSiteLat) : null;
    const longitude = editSiteLng !== '' ? Number(editSiteLng) : null;
    const isLantana = editingSite.source === 'Lantana';
    const siteUpdate = isLantana
      ? { site_name: editSiteName, lat: latitude, long: longitude }
      : { name: editSiteName, elevation: editSiteElev, latitude, longitude, project_id: editSiteProjId };

    const { error } = await supabase.from(isLantana ? 'lantana_sites' : 'sites').update(siteUpdate).eq('id', editingSite.id);
    if (error) {
      alert('Error updating site: ' + error.message);
      return;
    }

    if (isLantana) {
      setlantanaSitesList(prev => prev.map(s => s.id === editingSite.id ? {
        ...s, site_name: editSiteName, lat: latitude, long: longitude
      } : s));
    } else {
      setSitesList(prev => prev.map(s => s.id === editingSite.id ? {
        ...s, name: editSiteName, elevation: editSiteElev,
        latitude: latitude ?? 13.58, longitude: longitude ?? 75.64, projectId: editSiteProjId,
        recorderId: editRecorderId || s.recorderId
      } : s));
    }
    setEditingSite(null);
    showNotification('Site and recorder details updated successfully!');
  };

  const handleDeleteProject = async (projectId: string) => {
    if (currentRole !== 'Admin') {
      alert('Only admins can delete projects.');
      return;
    }
    if (confirm(`Are you sure you want to delete project "${projectId}"? This will remove all associated sites and detections.`)) {
      const project = projectsList.find(p => p.id === projectId);
      const isLantana = project?.type === 'Lantana';

      // Delete associated sites
      const sitesTable = isLantana ? 'lantana_sites' : 'sites';
      const { error: sitesError } = isLantana
        ? await supabase.from(sitesTable).delete().or(`project_id.eq.${projectId},id.like.${projectId}_%`)
        : await supabase.from(sitesTable).delete().eq('project_id', projectId);
      if (sitesError) {
        alert('Error deleting associated sites: ' + sitesError.message);
        return;
      }

      // Delete associated detections
      const detectionsTable = isLantana ? 'lantana_detections' : 'pam_detections';
      const { error: detsError } = isLantana
        ? await supabase.from(detectionsTable).delete().or(`project_id.eq.${projectId},project_name.eq.${project?.title || projectId}`)
        : await supabase.from(detectionsTable).delete().or(`project_name.eq.${projectId},project_name.eq.${project?.title || projectId}`);
      if (detsError) {
        console.error('Error deleting associated detections:', detsError.message);
      }

      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) {
        alert('Error deleting project: ' + error.message);
        return;
      }

      setProjectsList(prev => prev.filter(p => p.id !== projectId));
      if (isLantana) {
        setlantanaSitesList(prev => prev.filter(s => s.project_id !== projectId && !String(s.id).startsWith(`${projectId}_`)));
      } else {
        setSitesList(prev => prev.filter(s => s.projectId !== projectId));
      }
      showNotification(`Project ${projectId} and its associated sites were deleted successfully.`);
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

        <button
          onClick={() => setActiveTab('detections')}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'detections' 
              ? 'border-indigo-600 text-indigo-700' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" /> 4. Detections Data Management
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">1. Dataset Type</label>
                <select
                  value={selectedUploadProjectType}
                  onChange={(e) => {
                    setSelectedUploadProjectType(e.target.value as 'Lantana' | 'Common');
                    const projects = e.target.value === 'Lantana'
                      ? projectsList.filter(p => p.type === 'Lantana')
                      : projectsList.filter(p => p.type !== 'Lantana');
                    setSelectedUploadProjId(projects[0]?.id || '');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="Lantana">Lantana Project</option>
                  <option value="Common">Common PAM Project</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">2. Target Project</label>
                <select
                  value={selectedUploadProjId}
                  onChange={(e) => setSelectedUploadProjId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                >
                  {getUploadProjects().map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">3. Target Site Node</label>
                <select
                  value={selectedUploadSiteId}
                  onChange={(e) => setSelectedUploadSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                >
                  {getUploadSites().map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">4. Target Recorder Hardware</label>
                {selectedUploadProjectType === 'Lantana' ? (
                  <select
                    value={selectedUploadRecorderId}
                    onChange={(e) => setSelectedUploadRecorderId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  >
                    {getUploadRecorders().map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. LC_01 or 1"
                    value={selectedUploadRecorderId}
                    onChange={(e) => setSelectedUploadRecorderId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                  />
                )}
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
                    <option value="Lantana">Lantana Bioacoustic Survey Project (Visible ONLY in /dashboard/lantana)</option>
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
                  <label className="font-extrabold text-slate-700 block mb-1">Dataset Type</label>
                  <select
                    value={selectedProjectType}
                    onChange={(e) => setSelectedProjectType(e.target.value as 'Lantana' | 'Common')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  >
                    <option value="Lantana">Lantana Project</option>
                    <option value="Common">Common PAM Project</option>
                  </select>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setNewSiteProjId(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                  >
                    {getFilteredProjects().map(p => (
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
              <MapPin className="w-4 h-4 text-slate-600" /> Field Sites Directory ({getFilteredSites().length})
            </h3>

            <div className="divide-y divide-slate-100">
              {getFilteredSites().map(s => {
                return (
                <div key={`${s.source}-${s.id}-${s.recorderId || 'none'}`} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900">{s.name} <span className="font-mono text-[10px] text-slate-400">({s.id})</span></div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Recorder: {s.recorderId || 'Not registered'} · GPS: {s.latitude}°N, {s.longitude}°E · Elev: {s.elevation}
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
                        setEditRecorderId(s.recorderId || '');
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      title="Edit Site"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSite(s)}
                      className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition"
                      title="Delete Site"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                );
              })}
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
                  <option value="Lantana">Lantana Project Dashboard</option>
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

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Recorder Name / ID</label>
                <input
                  type="text"
                  required
                  value={editRecorderId}
                  onChange={(e) => setEditRecorderId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
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

      {/* TAB 4: Detections Management */}
      {activeTab === 'detections' && (
        <div className="space-y-6">
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
            <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" /> Offline Detections Database
                </h3>
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500">Showing {filteredPamDetections.length} of {pamDetectionsList.length} rows</span>
                  <select
                    value={detectionsTabScope}
                    onChange={(e) => setDetectionsTabScope(e.target.value as 'Lantana' | 'Common')}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="Lantana">Lantana Offline Data</option>
                    <option value="Common">Common PAM Offline Data</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <select value={pamFilterProject} onChange={e => setPamFilterProject(e.target.value)} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold text-slate-700">
                  <option value="All">All Projects</option>
                  {pamFilterOptions.projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                
                <select value={pamFilterSite} onChange={e => setPamFilterSite(e.target.value)} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold text-slate-700">
                  <option value="All">All Sites</option>
                  {pamFilterOptions.sites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                
                <select value={pamFilterRecorder} onChange={e => setPamFilterRecorder(e.target.value)} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 font-bold text-slate-700">
                  <option value="All">All Recorders</option>
                  {pamFilterOptions.recorders.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-black">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4 cursor-pointer hover:text-indigo-600 select-none transition" onClick={() => setPamSortDateDesc(!pamSortDateDesc)}>
                      Date & Time {pamSortDateDesc ? '↓' : '↑'}
                    </th>
                    <th className="py-3 px-4">Project & Site</th>
                    <th className="py-3 px-4">Species</th>
                    <th className="py-3 px-4 text-center">Confidence</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredPamDetections.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">No detections found.</td>
                    </tr>
                  ) : (
                    filteredPamDetections.map(det => (
                      <tr key={det.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-mono text-[10px]">{det.id}</td>
                        <td className="py-2.5 px-4 font-mono text-[10px]">
                          <div>{det.date}</div>
                          <div>{det.time}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">{det.project_name || 'N/A'}</div>
                          <div className="text-[10px] text-slate-400">{det.site_name}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">{det.common_name}</div>
                          <div className="text-[10px] text-slate-400 italic">{det.scientific_name}</div>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (det.confidence ?? det.threshold ?? 0) > 0.8 ? 'bg-emerald-100 text-emerald-700' :
                            (det.confidence ?? det.threshold ?? 0) > 0.5 ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {((det.confidence ?? det.threshold ?? 0) * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDeletePamDetection(det.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
