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
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Download,
  Globe
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiClient';
import { AdminNavTabs } from '@/components/admin/AdminNavTabs';
import { ShapefileUploadField } from '@/components/admin/ShapefileUploadField';
import { ParsedShapefileResult } from '@/lib/shapefileParser';

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

  // Active Tab: 'upload' | 'projects' | 'shapefiles' | 'species' | 'detections'
  const [activeTab, setActiveTab] = useState<'upload' | 'projects' | 'shapefiles' | 'species' | 'detections'>('upload');
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
  
  const [pamSelectedProject, setPamSelectedProject] = useState('Select Project');
  const [pamSelectedSite, setPamSelectedSite] = useState('Select Site');
  const [pamSelectedRecorder, setPamSelectedRecorder] = useState('All');
  const [availableCommonRecorders, setAvailableCommonRecorders] = useState<string[]>([]);
  const [isRecordersLoading, setIsRecordersLoading] = useState(false);
  const [isDetectionsLoading, setIsDetectionsLoading] = useState(false);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState<Set<number>>(new Set());
  const [detectionPage, setDetectionPage] = useState(0);
  const [detectionPageSize, setDetectionPageSize] = useState(500);
  const [pamSearchSpecies, setPamSearchSpecies] = useState('');
  const [hasMoreDetections, setHasMoreDetections] = useState(false);
  type PamSortColumn = 'date' | 'species' | 'confidence';
  const [pamSortColumn, setPamSortColumn] = useState<PamSortColumn>('date');
  const [pamSortDesc, setPamSortDesc] = useState(true);

  // Delete all detections state
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deleteAllScope, setDeleteAllScope] = useState<'recorder' | 'site'>('recorder');
  const [deleteAllConfirmed, setDeleteAllConfirmed] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [siteToDeleteDetections, setSiteToDeleteDetections] = useState<SiteItem | null>(null);

  // 5. Shapefiles Manager States
  const [shapefilesList, setShapefilesList] = useState<any[]>([]);
  const [isShapefilesLoading, setIsShapefilesLoading] = useState(false);
  const [shapefileFilterProject, setShapefileFilterProject] = useState<string>('ALL');
  const [shapefileFilterScope, setShapefileFilterScope] = useState<'ALL' | 'project' | 'site'>('ALL');
  const [shapefileSearchQuery, setShapefileSearchQuery] = useState('');
  const [deletingShapefileId, setDeletingShapefileId] = useState<string | null>(null);
  const [inspectingShapefile, setInspectingShapefile] = useState<any | null>(null);
  const [inspectGeoJson, setInspectGeoJson] = useState<any | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);
  const [shapefileToDelete, setShapefileToDelete] = useState<any | null>(null);
  const [isDeletingShapefile, setIsDeletingShapefile] = useState(false);

  // New Shapefile Upload in Shapefiles Manager
  const [isUploadShapefileOpen, setIsUploadShapefileOpen] = useState(false);
  const [uploadShapefileProjId, setUploadShapefileProjId] = useState('');
  const [uploadShapefileType, setUploadShapefileType] = useState<'project' | 'site'>('project');
  const [uploadShapefileSiteId, setUploadShapefileSiteId] = useState('');
  const [uploadShapefileName, setUploadShapefileName] = useState('');
  const [uploadShapefileHabitat, setUploadShapefileHabitat] = useState<'common' | 'LC' | 'LI' | 'CS' | 'live'>('common');
  const [uploadShapefileResult, setUploadShapefileResult] = useState<ParsedShapefileResult | null>(null);
  const [isSavingShapefile, setIsSavingShapefile] = useState(false);

  const scopedProjects = useMemo(() => {
    if (detectionsTabScope === 'Lantana') {
      return projectsList.filter(p => p.type === 'Lantana');
    } else {
      return projectsList.filter(p => p.type === 'PAM');
    }
  }, [projectsList, detectionsTabScope]);

  const scopedSites = useMemo(() => {
    if (pamSelectedProject === 'Select Project') return [];
    
    if (detectionsTabScope === 'Lantana') {
      const filtered = lantanaSitesList.filter(s => s.project_id === pamSelectedProject);
      const uniqueSites = [];
      const seenNames = new Set();
      for (const s of filtered) {
        if (!seenNames.has(s.site_name)) {
          seenNames.add(s.site_name);
          uniqueSites.push({
            id: s.id,
            name: s.site_name,
            projectId: s.project_id
          });
        }
      }
      return uniqueSites;
    } else {
      // sitesList is already mapped via mapDbSiteToItem
      return sitesList.filter(s => s.projectId === pamSelectedProject);
    }
  }, [sitesList, lantanaSitesList, detectionsTabScope, pamSelectedProject]);

  const filteredPamDetections = useMemo(() => {
    let result = [...pamDetectionsList];
    
    result.sort((a, b) => {
      let cmp = 0;
      if (pamSortColumn === 'date') {
        const timeStrA = a.date && a.time ? `${a.date}T${a.time}` : (a.created_at || '0');
        const timeStrB = b.date && b.time ? `${b.date}T${b.time}` : (b.created_at || '0');
        const da = new Date(timeStrA).getTime();
        const db = new Date(timeStrB).getTime();
        cmp = da - db;
      } else if (pamSortColumn === 'species') {
        const speciesA = (a.common_name || a.scientific_name || '').toLowerCase();
        const speciesB = (b.common_name || b.scientific_name || '').toLowerCase();
        cmp = speciesA.localeCompare(speciesB);
      } else if (pamSortColumn === 'confidence') {
        const confA = a.confidence ?? a.threshold ?? 0;
        const confB = b.confidence ?? b.threshold ?? 0;
        cmp = confA - confB;
      }
      return pamSortDesc ? -cmp : cmp;
    });
    return result;
  }, [pamDetectionsList, pamSortColumn, pamSortDesc]);

  useEffect(() => {
    async function fetchCommonRecorders() {
      if (detectionsTabScope === 'Lantana') return;
      if (pamSelectedSite === 'Select Site') {
        setAvailableCommonRecorders([]);
        return;
      }
      
      setIsRecordersLoading(true);
      const siteItem = scopedSites.find(s => s.id === pamSelectedSite);
      if (!siteItem) {
        setIsRecordersLoading(false);
        return;
      }

      // Fetch distinct recorders by paginating in parallel (up to 100,000 rows to be safe and extremely fast)
      let allRecorders = new Set<string>();
      const limit = 1000;
      const pagesToFetch = 100; // 100,000 rows max

      const promises = [];
      for (let i = 0; i < pagesToFetch; i++) {
        const start = i * limit;
        promises.push(
          supabase.from('pam_detections')
            .select('recorder_name')
            .eq('site_name', siteItem.name)
            .range(start, start + limit - 1)
        );
      }
      
      const results = await Promise.all(promises);
      let hitEnd = false;

      for (const res of results) {
        if (res.error || !res.data) continue;
        res.data.forEach(d => { if (d.recorder_name) allRecorders.add(d.recorder_name); });
        // If a page returns less than the limit, we've hit the end of the dataset
        if (res.data.length < limit) {
          hitEnd = true;
        }
      }
      
      setAvailableCommonRecorders(Array.from(allRecorders).sort());
      setIsRecordersLoading(false);
    }
    
    fetchCommonRecorders();
  }, [pamSelectedSite, scopedSites, detectionsTabScope]);

  const availableRecorders = useMemo(() => {
    if (pamSelectedSite === 'Select Site') return [];
    
    const siteItem = scopedSites.find(s => s.id === pamSelectedSite);
    if (!siteItem) return [];

    if (detectionsTabScope === 'Lantana') {
      const records = lantanaSitesList.filter(s => s.site_name === siteItem.name && s.project_id === pamSelectedProject);
      return Array.from(new Set(records.map(s => s.recorder_id))).filter(Boolean).sort();
    } else {
      return availableCommonRecorders;
    }
  }, [pamSelectedSite, scopedSites, lantanaSitesList, detectionsTabScope, pamSelectedProject, availableCommonRecorders]);

  const handleLoadDetections = async (targetPage = 0, customPageSize?: number, customSearch?: string) => {
    if (pamSelectedSite === 'Select Site') return;
    setIsDetectionsLoading(true);
    if (targetPage === 0) {
      setPamDetectionsList([]);
      setSelectedDetectionIds(new Set());
    }
    
    const pageSize = customPageSize || detectionPageSize;
    const searchTerm = (customSearch !== undefined ? customSearch : pamSearchSpecies).trim();
    const table = detectionsTabScope === 'Lantana' ? 'lantana_detections' : 'pam_detections';
    const isAllSites = pamSelectedSite === 'ALL_SITES';
    const siteItem = scopedSites.find(s => s.id === pamSelectedSite);
    const siteName = siteItem ? siteItem.name : pamSelectedSite;

    try {
      const baseStart = targetPage * pageSize;
      const baseEnd = baseStart + pageSize - 1;

      const applyFilters = (q: any) => {
        if (isAllSites) {
          if (table === 'pam_detections') {
            if (scopedSites.length > 0) {
              q = q.in('site_name', scopedSites.map(s => s.name));
            }
          } else {
            if (pamSelectedProject !== 'Select Project') {
              q = q.eq('project_id', pamSelectedProject);
            } else if (scopedSites.length > 0) {
              q = q.in('site_name', scopedSites.map(s => s.name));
            }
          }
        } else {
          q = q.eq('site_name', siteName);
        }

        if (pamSelectedRecorder !== 'All') {
          if (detectionsTabScope === 'Lantana') {
            q = q.eq('recorder_id', pamSelectedRecorder);
          } else {
            q = q.eq('recorder_name', pamSelectedRecorder);
          }
        }
        if (searchTerm) {
          q = q.or(`common_name.ilike.%${searchTerm}%,scientific_name.ilike.%${searchTerm}%`);
        }
        return q;
      };

      // When pageSize is > 1000 (e.g. 2,500, 5,000, 10,000), fetch in parallel 1000-row chunks
      if (pageSize > 1000) {
        const chunkSize = 1000;
        const totalChunks = Math.ceil(pageSize / chunkSize);
        const chunkPromises = [];

        for (let i = 0; i < totalChunks; i++) {
          const chunkStart = baseStart + i * chunkSize;
          const chunkEnd = Math.min(baseStart + (i + 1) * chunkSize - 1, baseEnd);
          
          let q = applyFilters(supabase.from(table).select('*'));
          chunkPromises.push(q.range(chunkStart, chunkEnd));
        }

        const chunkResults = await Promise.all(chunkPromises);
        let aggregatedRows: any[] = [];
        for (const res of chunkResults) {
          if (res.error) {
            console.warn('Chunk error:', res.error);
          } else if (res.data) {
            aggregatedRows.push(...res.data);
          }
        }

        setPamDetectionsList(aggregatedRows);
        setDetectionPage(targetPage);
        setHasMoreDetections(aggregatedRows.length >= pageSize);
      } else {
        // Standard single query for <= 1000 rows
        let query = applyFilters(supabase.from(table).select('*'));
        query = query.range(baseStart, baseEnd);

        const { data, error } = await query;
        
        if (error) {
          console.error('Error loading detections:', error);
          alert('Error loading detections: ' + error.message);
        } else {
          const list = data || [];
          setPamDetectionsList(list);
          setDetectionPage(targetPage);
          setHasMoreDetections(list.length === pageSize);
        }
      }
    } catch (err: any) {
      console.error('Error in handleLoadDetections:', err);
      alert('Failed to load detections: ' + (err.message || 'Unknown network error'));
    } finally {
      setIsDetectionsLoading(false);
    }
  };

  const handleDeletePamDetection = async (id: number) => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete detections.');
      return;
    }
    if (confirm('Are you sure you want to delete this detection row?')) {
      const table = detectionsTabScope === 'Lantana' ? 'lantana_detections' : 'pam_detections';
      try {
        await apiFetch(`/api/db/detections?table=${table}&id=${id}`, { method: 'DELETE' }, currentUser);
      } catch (err: any) {
        alert('Error deleting detection: ' + err.message);
        return;
      }
      setPamDetectionsList(prev => prev.filter(d => d.id !== id));
      setSelectedDetectionIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showNotification('Detection row deleted successfully.');
    }
  };

  const handleBulkDelete = async () => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete detections.');
      return;
    }
    if (selectedDetectionIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedDetectionIds.size} selected rows?`)) {
      setIsDetectionsLoading(true);
      const table = detectionsTabScope === 'Lantana' ? 'lantana_detections' : 'pam_detections';
      const idsToDelete = Array.from(selectedDetectionIds);
      
      // Delete in chunks of 200 to prevent URL length limits (414 URI Too Long)
      const chunkSize = 200;
      let hasError = false;
      let errorMessage = '';
      
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        try {
          await apiFetch(`/api/db/detections?table=${table}`, {
            method: 'DELETE',
            body: JSON.stringify({ ids: chunk })
          }, currentUser);
        } catch (err: any) {
          hasError = true;
          errorMessage = err.message;
          break;
        }
      }
      
      if (hasError) {
        alert('Error deleting rows: ' + errorMessage);
        setIsDetectionsLoading(false);
        return;
      }
      
      setPamDetectionsList(prev => prev.filter(d => !selectedDetectionIds.has(d.id)));
      setSelectedDetectionIds(new Set());
      showNotification(`${idsToDelete.length} rows deleted successfully.`);
      setIsDetectionsLoading(false);
    }
  };

  const handleOpenDeleteAllModal = (site?: SiteItem) => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete detections.');
      return;
    }
    if (site) {
      setSiteToDeleteDetections(site);
      setDeleteAllScope(site.recorderId ? 'recorder' : 'site');
    } else {
      setSiteToDeleteDetections(null);
      setDeleteAllScope(pamSelectedRecorder !== 'All' ? 'recorder' : 'site');
    }
    setDeleteAllConfirmed(false);
    setIsDeleteAllModalOpen(true);
  };

  const handleExecuteDeleteAllDetections = async () => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete detections.');
      return;
    }
    if (!deleteAllConfirmed) return;
    setIsDeletingAll(true);

    let siteName = '';
    let siteId: string | undefined = undefined;
    let recorderId: string | undefined = undefined;
    let projectName: string | undefined = undefined;
    let projectId: string | undefined = undefined;

    if (siteToDeleteDetections) {
      siteName = siteToDeleteDetections.name;
      siteId = siteToDeleteDetections.id;
      recorderId = deleteAllScope === 'recorder' ? siteToDeleteDetections.recorderId : undefined;
      const proj = projectsList.find(p => p.id === siteToDeleteDetections.projectId);
      projectName = proj ? proj.title : siteToDeleteDetections.projectId;
      projectId = siteToDeleteDetections.projectId;
    } else {
      if (pamSelectedSite === 'ALL_SITES') {
        siteName = 'ALL_SITES';
        siteId = 'ALL_SITES';
      } else {
        const siteItem = scopedSites.find(s => s.id === pamSelectedSite);
        siteName = siteItem ? siteItem.name : pamSelectedSite;
        siteId = siteItem ? siteItem.id : undefined;
      }
      recorderId = deleteAllScope === 'recorder' && pamSelectedRecorder !== 'All' ? pamSelectedRecorder : undefined;
      const proj = scopedProjects.find(p => p.id === pamSelectedProject);
      projectName = proj ? proj.title : (pamSelectedProject !== 'Select Project' ? pamSelectedProject : undefined);
      projectId = pamSelectedProject !== 'Select Project' ? pamSelectedProject : undefined;
    }

    try {
      const res = await apiFetch('/api/db/detections', {
        method: 'DELETE',
        body: JSON.stringify({
          deleteAllForSite: {
            siteName,
            siteId,
            recorderId,
            projectName,
            projectId,
            table: 'all'
          }
        })
      }, currentUser);

      setPamDetectionsList([]);
      setSelectedDetectionIds(new Set());
      setIsDeleteAllModalOpen(false);
      showNotification(res.message || (siteName === 'ALL_SITES' ? 'All project detections were permanently deleted.' : `All detections for "${siteName}" were permanently deleted.`));
    } catch (err: any) {
      alert('Failed to delete detections: ' + (err.message || 'Unknown network error'));
    } finally {
      setIsDeletingAll(false);
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

        if (projs) {
          let allowedProjs = projs;
          if (currentRole === 'Project Manager') {
            const assigned = currentUser?.assignedProjects || [];
            allowedProjs = allowedProjs.filter((p: any) => assigned.includes(p.id));
          } else if (currentRole === 'Site Manager') {
             // For Site Managers, we might want to restrict their project dropdown to the ones containing their sites
             const assignedProjects = currentUser?.assignedProjects || [];
             if (assignedProjects.length > 0) {
                 allowedProjs = allowedProjs.filter((p: any) => assignedProjects.includes(p.id));
             } else {
                 const siteIds = currentUser?.assignedSites || [];
                 const allowedProjIds = new Set(
                     (sitesData || []).filter((s: any) => siteIds.includes(s.id)).map((s: any) => s.project_id)
                 );
                 const allowedLantanaProjIds = new Set(
                     (lantanaSites || []).filter((s: any) => siteIds.includes(s.id)).map((s: any) => s.project_id)
                 );
                 allowedProjs = allowedProjs.filter((p: any) => allowedProjIds.has(p.id) || allowedLantanaProjIds.has(p.id));
             }
          }
          setProjectsList(allowedProjs.map(mapDbProjectToItem));
        }
        if (sitesData) {
          let allowedSites = sitesData;
          if (currentRole === 'Project Manager') {
              const assigned = currentUser?.assignedProjects || [];
              allowedSites = allowedSites.filter((s: any) => assigned.includes(s.project_id));
          } else if (currentRole === 'Site Manager') {
              const assigned = currentUser?.assignedSites || [];
              allowedSites = allowedSites.filter((s: any) => assigned.includes(s.id));
          }
          setSitesList(allowedSites.map(mapDbSiteToItem));
        }
        if (lantanaSites) {
          let allowedLantanaSites = lantanaSites;
          if (currentRole === 'Project Manager') {
              const assigned = currentUser?.assignedProjects || [];
              allowedLantanaSites = allowedLantanaSites.filter((s: any) => assigned.includes(s.project_id));
          } else if (currentRole === 'Site Manager') {
              const assigned = currentUser?.assignedSites || [];
              allowedLantanaSites = allowedLantanaSites.filter((s: any) => assigned.includes(s.id));
          }
          setlantanaSitesList(allowedLantanaSites);
        }
        if (speciesEco) setSpeciesEcologyList(speciesEco);

        // Default to the first Lantana Project, since the admin page opens on the Lantana scope
        if (projs && projs.length > 0) {
          // Note: we use the filtered projectsList state via allowedProjs
          // but we haven't defined it as a state variable here, so we'll just check allowedProjs if it was defined.
        }
        
        // Let's ensure the default selectedProjectId falls back correctly
        setProjectsList(prevProjs => {
            if (prevProjs.length > 0 && !selectedProjectId) {
                const lantanaProject = prevProjs.find(p => p.type === 'Lantana') || prevProjs[0];
                setSelectedProjectId(lantanaProject.id);
            }
            return prevProjs;
        });

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

        // Load Shapefiles Manifest
        try {
          const sfRes = await fetch('/api/db/shapefiles');
          const sfData = await sfRes.json();
          if (sfData && Array.isArray(sfData.items)) {
            setShapefilesList(sfData.items);
          }
        } catch (sfErr) {
          console.error('Failed to load initial shapefiles:', sfErr);
        }
      } catch (e) {
        console.error('Failed to fetch PAM admin data from Supabase:', e);
      }
    }
    loadData();
  }, [currentRole, currentUser]);

  const loadShapefiles = async () => {
    setIsShapefilesLoading(true);
    try {
      const res = await fetch('/api/db/shapefiles');
      const data = await res.json();
      setShapefilesList(data.items || []);
    } catch (err) {
      console.error('Failed to load shapefiles:', err);
    } finally {
      setIsShapefilesLoading(false);
    }
  };

  const getShapefileProject = (item: any): ProjectItem | undefined => {
    if (item.projectId) {
      const p = projectsList.find(proj => proj.id.toLowerCase() === item.projectId.toLowerCase());
      if (p) return p;
    }
    const tId = (item.targetId || item.id || '').toLowerCase();
    const directMatch = projectsList.find(proj => proj.id.toLowerCase() === tId);
    if (directMatch) return directMatch;
    
    const prefix = tId.split(/[-_]/)[0];
    const prefixMatch = projectsList.find(proj => proj.id.toLowerCase() === prefix);
    if (prefixMatch) return prefixMatch;

    const siteId = (item.siteId || item.targetId || '').toLowerCase();
    const site = sitesList.find(s => s.id.toLowerCase() === siteId) || lantanaSitesList.find(s => String(s.id).toLowerCase() === siteId);
    if (site) {
      const projId = site.projectId || site.project_id;
      const p = projectsList.find(proj => proj.id.toLowerCase() === (projId || '').toLowerCase());
      if (p) return p;
    }

    return projectsList.find(proj => tId.includes(proj.id.toLowerCase()));
  };

  const filteredShapefiles = useMemo(() => {
    return shapefilesList.filter(item => {
      // 1. Filter by Scope
      if (shapefileFilterScope !== 'ALL' && item.targetType !== shapefileFilterScope) {
        return false;
      }
      // 2. Filter by Project
      if (shapefileFilterProject !== 'ALL') {
        const proj = getShapefileProject(item);
        if (!proj || proj.id.toLowerCase() !== shapefileFilterProject.toLowerCase()) {
          return false;
        }
      }
      // 3. Filter by search query
      if (shapefileSearchQuery.trim()) {
        const query = shapefileSearchQuery.toLowerCase().trim();
        const name = (item.name || '').toLowerCase();
        const id = (item.targetId || item.id || '').toLowerCase();
        const proj = getShapefileProject(item);
        const projTitle = (proj?.title || '').toLowerCase();
        const projId = (proj?.id || '').toLowerCase();
        if (!name.includes(query) && !id.includes(query) && !projTitle.includes(query) && !projId.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [shapefilesList, shapefileFilterProject, shapefileFilterScope, shapefileSearchQuery, projectsList, sitesList, lantanaSitesList]);

  const projectShapefileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    shapefilesList.forEach(item => {
      const proj = getShapefileProject(item);
      const projId = proj ? proj.id : 'unassigned';
      counts[projId] = (counts[projId] || 0) + 1;
    });
    return counts;
  }, [shapefilesList, projectsList, sitesList, lantanaSitesList]);

  const handleDeleteShapefile = (item: any) => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete shapefiles.');
      return;
    }
    setShapefileToDelete(item);
  };

  const executeDeleteShapefile = async () => {
    if (!shapefileToDelete) return;
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete shapefiles.');
      return;
    }
    const item = shapefileToDelete;
    const label = item.name || item.targetId || item.id;
    setIsDeletingShapefile(true);
    setDeletingShapefileId(item.targetId || item.id);
    try {
      await apiFetch(`/api/db/shapefiles?id=${encodeURIComponent(item.targetId || item.id)}`, {
        method: 'DELETE'
      }, currentUser);

      setShapefilesList(prev => prev.filter(s => (s.targetId || s.id) !== (item.targetId || item.id)));
      showNotification(`Shapefile "${label}" deleted successfully.`);
      if (inspectingShapefile && (inspectingShapefile.targetId || inspectingShapefile.id) === (item.targetId || item.id)) {
        setInspectingShapefile(null);
        setInspectGeoJson(null);
      }
      setShapefileToDelete(null);
    } catch (err: any) {
      alert('Error deleting shapefile: ' + (err.message || 'Unknown network error'));
    } finally {
      setIsDeletingShapefile(false);
      setDeletingShapefileId(null);
    }
  };

  const handleInspectShapefile = async (item: any) => {
    setInspectingShapefile(item);
    setIsInspectLoading(true);
    setInspectGeoJson(null);
    try {
      const res = await fetch(`/api/db/shapefiles?id=${encodeURIComponent(item.targetId || item.id)}`);
      const data = await res.json();
      if (data.geojson) {
        setInspectGeoJson(data.geojson);
      }
    } catch (err) {
      console.error('Error fetching shapefile geojson:', err);
    } finally {
      setIsInspectLoading(false);
    }
  };

  const handleDownloadGeoJson = (item: any, geojsonObj?: any) => {
    const geo = geojsonObj || inspectGeoJson;
    if (!geo) return;
    const blob = new Blob([JSON.stringify(geo, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.targetId || item.id || 'shapefile'}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveNewShapefile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadShapefileResult) {
      alert('Please select and upload a valid shapefile or GeoJSON file (.zip, .geojson, .kmz, .kml).');
      return;
    }
    if (!uploadShapefileProjId) {
      alert('Please select a target project.');
      return;
    }
    const targetId = uploadShapefileType === 'project' 
      ? uploadShapefileProjId 
      : (uploadShapefileSiteId || `${uploadShapefileProjId}_site`);
    
    setIsSavingShapefile(true);
    try {
      await apiFetch('/api/db/shapefiles', {
        method: 'POST',
        body: JSON.stringify({
          targetId,
          targetType: uploadShapefileType,
          name: uploadShapefileName || targetId,
          habitat: uploadShapefileHabitat,
          projectId: uploadShapefileProjId,
          siteId: uploadShapefileType === 'site' ? uploadShapefileSiteId : undefined,
          geojson: uploadShapefileResult.geojson,
          centroid: uploadShapefileResult.centroid
        })
      }, currentUser);

      showNotification(`Shapefile for "${uploadShapefileName || targetId}" saved successfully!`);
      setUploadShapefileResult(null);
      setUploadShapefileName('');
      setIsUploadShapefileOpen(false);
      await loadShapefiles();
    } catch (err: any) {
      alert('Error saving shapefile: ' + (err.message || 'Unknown network error'));
    } finally {
      setIsSavingShapefile(false);
    }
  };

  // Form: Create New Project
  const [newProjId, setNewProjId] = useState('');
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjCategory, setNewProjCategory] = useState<'PAM' | 'Lantana'>('PAM');
  const [newProjTag, setNewProjTag] = useState('');
  const [newProjCollab, setNewProjCollab] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjImage, setNewProjImage] = useState('');
  const [newProjShapefile, setNewProjShapefile] = useState<ParsedShapefileResult | null>(null);

  // Edit Project Modal States
  const [editingProj, setEditingProj] = useState<ProjectItem | null>(null);
  const [editProjTitle, setEditProjTitle] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [editProjCollab, setEditProjCollab] = useState('');
  const [editProjImage, setEditProjImage] = useState('');
  const [editProjType, setEditProjType] = useState('PAM');
  const [editProjShapefile, setEditProjShapefile] = useState<ParsedShapefileResult | null>(null);

  // Edit Site Modal States
  const [editingSite, setEditingSite] = useState<SiteItem | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteElev, setEditSiteElev] = useState('');
  const [editSiteLat, setEditSiteLat] = useState<number | ''>(13.58);
  const [editSiteLng, setEditSiteLng] = useState<number | ''>(75.64);
  const [editSiteProjId, setEditSiteProjId] = useState('');
  const [editRecorderId, setEditRecorderId] = useState('');
  const [newSiteShapefile, setNewSiteShapefile] = useState<ParsedShapefileResult | null>(null);
  const [editSiteShapefile, setEditSiteShapefile] = useState<ParsedShapefileResult | null>(null);

  // Synchronize project selection when project type changes
  useEffect(() => {
    if (projectsList.length > 0) {
      // Filter projects based on selected type
      const filteredProjects = selectedProjectType === 'Lantana'
        ? projectsList.filter(p => p.type === 'Lantana')
        : projectsList.filter(p => p.type === 'PAM');
      
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
      : projectsList.filter(p => p.type === 'PAM');
    return base.filter(p => permittedProjectIds.has(p.id));
  };

  // Helper functions for the batch upload tab dropdown cascade
  const getUploadProjects = () => {
    const base = selectedUploadProjectType === 'Lantana'
      ? projectsList.filter(p => p.type === 'Lantana')
      : projectsList.filter(p => p.type === 'PAM');
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
              // Add 'Z' to treat the filename time as UTC. This prevents .toISOString() from
              // shifting the time by the browser's timezone offset (e.g., -5:30 for IST).
              timestamp = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
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
              try {
                await apiFetch('/api/db/detections', {
                  method: 'POST',
                  body: JSON.stringify({ table: targetTable, records: chunk })
                }, currentUser);
                totalInserted += chunk.length;
              } catch (err: any) {
                alert(`Error inserting detections for ${file.name}: ` + err.message);
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

    try {
      await apiFetch('/api/db/projects', {
        method: 'POST',
        body: JSON.stringify(newProj)
      }, currentUser);
    } catch (err: any) {
      alert('Error creating project: ' + err.message);
      return;
    }

    setProjectsList(prev => [...prev, mapDbProjectToItem(newProj)]);

    if (newProjShapefile) {
      try {
        await apiFetch('/api/db/shapefiles', {
          method: 'POST',
          body: JSON.stringify({
            targetId: projectId,
            projectId: projectId,
            targetType: 'project',
            name: newProjTitle,
            habitat: newProjCategory,
            geojson: newProjShapefile.geojson,
            centroid: newProjShapefile.centroid
          })
        }, currentUser);
      } catch (err) {
        console.error('Failed to save project shapefile:', err);
      }
      setNewProjShapefile(null);
    }

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

    try {
      await apiFetch('/api/db/projects', {
        method: 'PUT',
        body: JSON.stringify({
          id: editingProj.id,
          name: editProjTitle,
          project_type: editProjType,
          description: editProjDesc,
          organization: editProjCollab,
          image_url: editProjImage || null
        })
      }, currentUser);
    } catch (err: any) {
      alert('Error updating project: ' + err.message);
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

    if (editProjShapefile) {
      try {
        await apiFetch('/api/db/shapefiles', {
          method: 'POST',
          body: JSON.stringify({
            targetId: editingProj.id,
            projectId: editingProj.id,
            targetType: 'project',
            name: editProjTitle,
            habitat: editProjType,
            geojson: editProjShapefile.geojson,
            centroid: editProjShapefile.centroid
          })
        }, currentUser);
      } catch (err) {
        console.error('Failed to save project shapefile:', err);
      }
      setEditProjShapefile(null);
    }

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
    
    const targetProjId = selectedProjectId || newSiteProjId || getFilteredProjects()[0]?.id;
    if (!targetProjId || !permittedProjectIds.has(targetProjId)) {
      alert('You do not have permission to add a site to this project, or no project is selected.');
      return;
    }
    if (!newSiteId || !newRecorderId) {
      alert('Please provide both Site ID / Name and Recorder Hardware ID.');
      return;
    }

    const siteName = normalizeSiteCode(newSiteId).toUpperCase();
    // Normalize recorder ID (e.g., 'lc_01' -> 'LC_01', 'lc_o1' -> 'LC_01')
    const normalizedRecorderId = newRecorderId.trim().toUpperCase().replace(/_O([0-9])/i, '_0$1');
    const proj = projectsList.find(p => p.id === targetProjId);
    const projName = proj?.title || 'PAM Project';

    const siteLatitude = newSiteLat !== '' ? Number(newSiteLat) : null;
    const siteLongitude = newSiteLng !== '' ? Number(newSiteLng) : null;
    const isLantana = selectedProjectType === 'Lantana';

    // Keep Lantana and Common PAM site records in their separate tables.
    const newSite = isLantana ? {
      id: `${targetProjId}_${siteName}_${normalizedRecorderId}`,
      site_name: siteName,
      project_id: targetProjId,
      project_name: projName,
      recorder_id: normalizedRecorderId,
      lat: siteLatitude,
      long: siteLongitude,
      number_of_files: 0,
      number_of_hours: 0,
      total_size_bytes: 0
    } : {
      id: `${targetProjId}_${siteName}`,
      project_id: targetProjId,
      name: siteName,
      elevation: newSiteElev || '',
      status: 'Active',
      latitude: siteLatitude,
      longitude: siteLongitude
    };

    try {
      await apiFetch('/api/db/sites', {
        method: 'POST',
        body: JSON.stringify({
          table: isLantana ? 'lantana_sites' : 'sites',
          ...newSite
        })
      }, currentUser);
    } catch (siteError: any) {
      alert('Error registering site: ' + siteError.message);
      return;
    }

    // Update only the selected dataset's local state.
    if (isLantana) {
      setlantanaSitesList(prev => {
        const filtered = prev.filter(s => s.id !== newSite.id);
        return [...filtered, newSite];
      });
    } else {
      setSitesList(prev => {
        const scopedSiteId = `${targetProjId}_${siteName}`;
        const filtered = prev.filter(s => s.id !== scopedSiteId);
        return [...filtered, {
          id: scopedSiteId,
          projectId: targetProjId,
          name: siteName,
          elevation: newSiteElev || '',
          status: 'Active',
          latitude: siteLatitude ?? 0,
          longitude: siteLongitude ?? 0,
          recorderId: normalizedRecorderId,
          source: 'common'
        }];
      });
    }

    if (newSiteShapefile) {
      const habitatToken = (normalizedRecorderId || siteName).split(/[-_/]/)[0];
      const detectedHabitat = isLantana ? (habitatToken === 'LI' ? 'LI' : habitatToken === 'CS' ? 'CS' : 'LC') : 'common';
      try {
        await apiFetch('/api/db/shapefiles', {
          method: 'POST',
          body: JSON.stringify({
            targetId: newSite.id,
            siteId: newSite.id,
            projectId: newSiteProjId,
            targetType: 'site',
            name: siteName,
            habitat: detectedHabitat,
            geojson: newSiteShapefile.geojson,
            centroid: newSiteShapefile.centroid
          })
        }, currentUser);
      } catch (err) {
        console.error('Failed to save site shapefile:', err);
      }
      setNewSiteShapefile(null);
    }

    setNewSiteId('');
    setNewRecorderId('LC_01');
    setNewSiteElev('');
    setNewSiteLat('');
    setNewSiteLng('');
    showNotification(`Recorder "${normalizedRecorderId}" and Site "${siteName}" registered successfully under ${targetProjId}!`);
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

    try {
      await apiFetch('/api/db/ecology', {
        method: 'POST',
        body: JSON.stringify(record)
      }, currentUser);
    } catch (error: any) {
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
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete sites.');
      return;
    }
    if (!confirm(`Are you sure you want to delete site "${site.name}"? This will permanently delete this site and ALL of its associated detections from the database.`)) {
      return;
    }
    const isLantana = site.source === 'Lantana';
    const table = isLantana ? 'lantana_sites' : 'sites';
    try {
      await apiFetch(`/api/db/sites?table=${table}&id=${site.id}`, { method: 'DELETE' }, currentUser);
    } catch (err: any) {
      alert('Error deleting site: ' + err.message);
      return;
    }

    if (isLantana) {
      setlantanaSitesList(prev => prev.filter(s => s.id !== site.id));
    } else {
      setSitesList(prev => prev.filter(s => s.id !== site.id));
    }
    showNotification(`Site "${site.name}" and all associated detections were permanently deleted.`);
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

    try {
      await apiFetch('/api/db/sites', {
        method: 'PUT',
        body: JSON.stringify({
          table: isLantana ? 'lantana_sites' : 'sites',
          id: editingSite.id,
          ...siteUpdate
        })
      }, currentUser);
    } catch (err: any) {
      alert('Error updating site: ' + err.message);
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

    if (editSiteShapefile) {
      const habitatToken = (editRecorderId || editSiteName).split(/[-_/]/)[0];
      const detectedHabitat = isLantana ? (habitatToken === 'LI' ? 'LI' : habitatToken === 'CS' ? 'CS' : 'LC') : 'common';
      try {
        await apiFetch('/api/db/shapefiles', {
          method: 'POST',
          body: JSON.stringify({
            targetId: editingSite.id,
            siteId: editingSite.id,
            projectId: editingSite.projectId,
            targetType: 'site',
            name: editSiteName,
            habitat: detectedHabitat,
            geojson: editSiteShapefile.geojson,
            centroid: editSiteShapefile.centroid
          })
        }, currentUser);
      } catch (err) {
        console.error('Failed to save site shapefile:', err);
      }
      setEditSiteShapefile(null);
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

      try {
        await apiFetch(`/api/db/projects?id=${projectId}`, { method: 'DELETE' }, currentUser);
      } catch (err: any) {
        alert('Error deleting project: ' + err.message);
        return;
      }

      setProjectsList(prev => prev.filter(p => p.id !== projectId));
      if (isLantana) {
        setlantanaSitesList(prev => prev.filter(s => s.project_id !== projectId && !String(s.id).startsWith(`${projectId}_`)));
      } else {
        setSitesList(prev => prev.filter(s => s.projectId !== projectId));
      }
      showNotification('Project and all associated data deleted.');
    }
  };

  const renderShapefilesCard = (isStandaloneTab: boolean) => {
    return (
      <div className="p-6 md:p-8 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-6 text-xs">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Project Shapefiles &amp; Boundary Overlays
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                    {shapefilesList.length} total
                  </span>
                </h3>
                <p className="text-slate-500 text-[11px]">
                  View, filter, inspect, and manage spatial boundary shapefiles / GeoJSON layers registered for each research project.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsUploadShapefileOpen(!isUploadShapefileOpen)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-2 shadow-xs transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploadShapefileOpen ? 'Close Uploader' : 'Upload Shapefile'}</span>
            </button>
            <button
              type="button"
              onClick={loadShapefiles}
              disabled={isShapefilesLoading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
              title="Refresh shapefiles manifest"
            >
              <RefreshCw className={`w-4 h-4 ${isShapefilesLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Upload Form */}
        {isUploadShapefileOpen && (
          <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                Register New Shapefile / GeoJSON Layer
              </h4>
              <button
                type="button"
                onClick={() => setIsUploadShapefileOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewShapefile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Target Project */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Target Project</label>
                  <select
                    value={uploadShapefileProjId}
                    onChange={(e) => {
                      setUploadShapefileProjId(e.target.value);
                      const proj = projectsList.find(p => p.id === e.target.value);
                      if (proj?.type === 'Lantana') {
                        setUploadShapefileHabitat('LC');
                      } else {
                        setUploadShapefileHabitat('common');
                      }
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Select Project --</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.id}) [{p.type || 'PAM'}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Boundary Scope */}
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Boundary Scope</label>
                  <select
                    value={uploadShapefileType}
                    onChange={(e) => setUploadShapefileType(e.target.value as 'project' | 'site')}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="project">Project Landscape (Whole Project Boundary)</option>
                    <option value="site">Site Boundary / Buffer Polygon (Single Site)</option>
                  </select>
                </div>

                {/* If Site Scope, site selector */}
                {uploadShapefileType === 'site' ? (
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Site Identifier</label>
                    <input
                      type="text"
                      placeholder="e.g. ATR_01 or site ID"
                      value={uploadShapefileSiteId}
                      onChange={(e) => setUploadShapefileSiteId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Layer Label / Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Nilgiri Biosphere Boundary"
                      value={uploadShapefileName}
                      onChange={(e) => setUploadShapefileName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {uploadShapefileType === 'site' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Layer Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Site Survey Polygon"
                      value={uploadShapefileName}
                      onChange={(e) => setUploadShapefileName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Habitat / Category Tag</label>
                    <select
                      value={uploadShapefileHabitat}
                      onChange={(e) => setUploadShapefileHabitat(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="common">Common PAM</option>
                      <option value="LC">Lantana Cleared (LC)</option>
                      <option value="LI">Lantana Invaded (LI)</option>
                      <option value="CS">Canopy Site (CS)</option>
                      <option value="live">Live Stream / Acoustic Array</option>
                    </select>
                  </div>
                </div>
              )}

              <ShapefileUploadField
                shapefile={uploadShapefileResult}
                onShapefileChange={setUploadShapefileResult}
                label="Upload Shapefile / GeoJSON Archive (.zip, .geojson, .kmz, .kml)"
                targetHabitat={uploadShapefileHabitat}
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsUploadShapefileOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadShapefileResult || isSavingShapefile}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingShapefile ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Overlay...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Shapefile Overlay</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Project Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-slate-600 text-[11px] uppercase tracking-wider">Project:</span>
              <button
                type="button"
                onClick={() => setShapefileFilterProject('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                  shapefileFilterProject === 'ALL'
                    ? 'bg-[#1f4d3a] text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>All Projects</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  shapefileFilterProject === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {shapefilesList.length}
                </span>
              </button>

              {projectsList.map(proj => {
                const count = projectShapefileCounts[proj.id] || 0;
                const isSelected = shapefileFilterProject.toLowerCase() === proj.id.toLowerCase();
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => setShapefileFilterProject(proj.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#1f4d3a] text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span className="max-w-[130px] truncate">{proj.title}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Scope Filter & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={shapefileFilterScope}
                onChange={(e) => setShapefileFilterScope(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-bold focus:outline-none"
              >
                <option value="ALL">All Scopes</option>
                <option value="project">Project Landscapes</option>
                <option value="site">Site Boundaries</option>
              </select>

              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search shapefiles..."
                  value={shapefileSearchQuery}
                  onChange={(e) => setShapefileSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
                />
                {shapefileSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setShapefileSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Shapefiles Table / Cards */}
        {isShapefilesLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="font-medium text-xs">Loading shapefiles repository...</p>
          </div>
        ) : filteredShapefiles.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-700 text-sm">No Shapefiles Found</h4>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                {shapefileFilterProject !== 'ALL' || shapefileFilterScope !== 'ALL' || shapefileSearchQuery
                  ? 'No boundary layers match your active filters. Try resetting the project or search criteria.'
                  : 'No shapefiles have been registered yet. Upload a GeoJSON or shapefile archive to get started.'}
              </p>
            </div>
            {(shapefileFilterProject !== 'ALL' || shapefileFilterScope !== 'ALL' || shapefileSearchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setShapefileFilterProject('ALL');
                  setShapefileFilterScope('ALL');
                  setShapefileSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 text-xs shadow-xs"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Layer / Shapefile</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Centroid Coordinates</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredShapefiles.map((item) => {
                  const proj = getShapefileProject(item);
                  const isProjectScope = item.targetType === 'project';
                  const isDeleting = deletingShapefileId === (item.targetId || item.id);
                  const targetIdentifier = item.targetId || item.id;
                  const displayName = item.name || targetIdentifier;

                  return (
                    <tr key={targetIdentifier} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>{displayName}</span>
                            {item.habitat && (
                              <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {item.habitat}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            ID: <span className="text-slate-600 font-bold">{targetIdentifier}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {proj ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block truncate max-w-[180px]">
                              {proj.title}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                {proj.id}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                ({proj.type || 'PAM'})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {item.projectId || 'Unassigned'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          isProjectScope
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        }`}>
                          <Layers className="w-3 h-3" />
                          <span>{isProjectScope ? 'Project Landscape' : 'Site Boundary'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {Array.isArray(item.centroid) && item.centroid.length === 2 ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>
                              {Number(item.centroid[0]).toFixed(4)}°, {Number(item.centroid[1]).toFixed(4)}°
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {item.updated_at ? (
                          <span title={new Date(item.updated_at).toLocaleString()}>
                            {new Date(item.updated_at).toLocaleDateString()}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* Inspect GeoJSON */}
                          <button
                            type="button"
                            onClick={() => handleInspectShapefile(item)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition"
                            title="Inspect GeoJSON properties & structure"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Direct Download */}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/db/shapefiles?id=${encodeURIComponent(targetIdentifier)}`);
                                const data = await res.json();
                                if (data.geojson) {
                                  handleDownloadGeoJson(item, data.geojson);
                                } else {
                                  alert('GeoJSON content could not be retrieved.');
                                }
                              } catch (e: any) {
                                alert('Download error: ' + e.message);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition"
                            title="Download GeoJSON file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Shapefile - ADMIN ONLY */}
                          {currentRole === 'Admin' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteShapefile(item)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white transition disabled:opacity-50"
                              title="Delete shapefile permanently (Admin only)"
                            >
                              {isDeleting ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Centralized Admin Console Switcher */}
      <AdminNavTabs />

      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#ffffff] border border-[#dde1dc] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f6f4] border border-[#dde1dc] text-[#1f4d3a] font-mono font-medium text-xs">
            <Database className="w-3.5 h-3.5" />
            <span>INSTITUTIONAL ADMINISTRATION</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-semibold tracking-tight text-[#1a1f1c]">
            Admin Console
          </h1>
          <p className="text-[#5a635d] text-sm max-w-xl leading-relaxed">
            Ingest batch BirdNET CSV detection sheets, parse SD card archives, manage survey projects, register site coordinates, and curate species ecological records.
          </p>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex border-b border-[#dde1dc] gap-2 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('upload')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'upload' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Upload className="w-4 h-4" /> Batch CSV Ingestion
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'projects' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <FolderPlus className="w-4 h-4" /> Projects &amp; Sites
        </button>

        <button
          onClick={() => setActiveTab('shapefiles')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'shapefiles' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Layers className="w-4 h-4" /> Project Shapefiles
          {shapefilesList.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'shapefiles' ? 'bg-[#1f4d3a] text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {shapefilesList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('species')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'species' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Bird className="w-4 h-4" /> Species Catalog
        </button>

        <button
          onClick={() => setActiveTab('detections')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'detections' 
              ? 'border-[#1f4d3a] text-[#1f4d3a] font-semibold' 
              : 'border-transparent text-[#5a635d] hover:text-[#1a1f1c]'
          }`}
        >
          <Database className="w-4 h-4" /> Detections Audit
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
                      : projectsList.filter(p => p.type === 'PAM');
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

              <ShapefileUploadField
                shapefile={newProjShapefile}
                onShapefileChange={setNewProjShapefile}
                label="Project Landscape Shapefile / GeoJSON (.zip, .geojson)"
                targetHabitat={newProjCategory === 'Lantana' ? 'LC' : 'common'}
              />

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
              {projectsList.map(p => {
                const projShapefiles = shapefilesList.filter(s => {
                  const proj = getShapefileProject(s);
                  return proj?.id.toLowerCase() === p.id.toLowerCase();
                });

                return (
                  <div key={p.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">{p.id}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">{p.type || 'PAM'}</span>
                          <h4 className="font-extrabold text-slate-900 text-sm">{p.title}</h4>
                        </div>
                        <p className="text-slate-500 text-[11px] font-medium">{p.description}</p>
                        <div className="text-[10px] text-slate-400 font-mono">Lead: {p.collaboration || 'IISER Tirupati Bird Lab'}</div>
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
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
                        {currentRole === 'Admin' && (
                          <button
                            onClick={() => handleDeleteProject(p.id)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold flex items-center gap-1.5 transition border border-rose-200 hover:border-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Project</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Shapefiles Registered for this Project */}
                    <div className="pt-3 border-t border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Registered Project Shapefiles &amp; Overlays ({projShapefiles.length})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadShapefileProjId(p.id);
                            setUploadShapefileType('project');
                            setUploadShapefileName(`${p.title} Landscape Boundary`);
                            setIsUploadShapefileOpen(true);
                            setActiveTab('shapefiles');
                          }}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload Shapefile for {p.id}</span>
                        </button>
                      </div>

                      {projShapefiles.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic bg-white/70 p-3 rounded-xl border border-dashed border-slate-200 flex items-center justify-between">
                          <span>No boundary shapefiles registered for this project yet.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadShapefileProjId(p.id);
                              setUploadShapefileType('project');
                              setUploadShapefileName(`${p.title} Boundary`);
                              setIsUploadShapefileOpen(true);
                              setActiveTab('shapefiles');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] hover:bg-emerald-100 transition"
                          >
                            + Add Shapefile
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {projShapefiles.map(sf => {
                            const sfTargetId = sf.targetId || sf.id;
                            const sfName = sf.name || sfTargetId;
                            return (
                              <div
                                key={sfTargetId}
                                className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 hover:border-emerald-300 transition"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="font-extrabold text-slate-800 text-[11px] truncate flex items-center gap-1.5">
                                    <span className="truncate">{sfName}</span>
                                    {sf.habitat && (
                                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                        {sf.habitat}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
                                    <span className="text-emerald-700 font-semibold">{sf.targetType === 'project' ? 'Landscape Boundary' : 'Site Boundary'}</span>
                                    <span>•</span>
                                    <span className="text-slate-500 font-semibold">{sfTargetId}</span>
                                    {Array.isArray(sf.centroid) && sf.centroid.length === 2 && (
                                      <>
                                        <span>•</span>
                                        <span>{Number(sf.centroid[0]).toFixed(3)}°, {Number(sf.centroid[1]).toFixed(3)}°</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleInspectShapefile(sf)}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition"
                                    title="Inspect GeoJSON properties"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/db/shapefiles?id=${encodeURIComponent(sfTargetId)}`);
                                        const data = await res.json();
                                        if (data.geojson) {
                                          handleDownloadGeoJson(sf, data.geojson);
                                        }
                                      } catch (e: any) {
                                        alert('Download error: ' + e.message);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition"
                                    title="Download GeoJSON"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  {currentRole === 'Admin' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteShapefile(sf)}
                                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white transition"
                                      title="Delete shapefile permanently"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Shapefiles & Boundary Overlays Console */}
          {renderShapefilesCard(false)}

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
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Elevation <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 920m (Optional)"
                    value={newSiteElev}
                    onChange={(e) => setNewSiteElev(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <ShapefileUploadField
                shapefile={newSiteShapefile}
                onShapefileChange={setNewSiteShapefile}
                label="Site Boundary Shapefile / GeoJSON (.zip, .geojson)"
                targetHabitat={
                  selectedProjectType === 'Lantana'
                    ? (newRecorderId.toUpperCase().startsWith('LI') ? 'LI' : newRecorderId.toUpperCase().startsWith('CS') ? 'CS' : 'LC')
                    : 'common'
                }
                onCentroidExtracted={(lat, lng) => {
                  if (newSiteLat === '') setNewSiteLat(lat);
                  if (newSiteLng === '') setNewSiteLng(lng);
                }}
              />

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
                      Recorder: {s.recorderId || 'Not registered'} · GPS: {s.latitude != null ? `${s.latitude}°N` : 'N/A'}, {s.longitude != null ? `${s.longitude}°E` : 'N/A'}{s.elevation ? ` · Elev: ${s.elevation}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
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
                      title="Edit Site Coordinates"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {currentRole === 'Admin' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSite(s)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-rose-600 hover:text-white transition"
                        title="Delete site from directory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Dedicated Project Shapefiles Repository */}
      {activeTab === 'shapefiles' && (
        <div className="space-y-6">
          {renderShapefilesCard(true)}
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

              {/* Existing Shapefiles for this project */}
              {(() => {
                const existingSf = shapefilesList.filter(s => {
                  const proj = getShapefileProject(s);
                  return proj?.id.toLowerCase() === editingProj.id.toLowerCase();
                });
                if (existingSf.length === 0) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <label className="font-extrabold text-slate-700 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>Current Registered Shapefiles ({existingSf.length})</span>
                      </span>
                    </label>
                    <div className="space-y-1.5">
                      {existingSf.map(sf => (
                        <div key={sf.targetId || sf.id} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-[11px] truncate">{sf.name || sf.targetId}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{sf.targetType === 'project' ? 'Project Landscape' : 'Site Boundary'} • {sf.targetId || sf.id}</div>
                          </div>
                          {currentRole === 'Admin' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteShapefile(sf)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[10px] font-bold flex items-center gap-1 transition shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete Shapefile</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <ShapefileUploadField
                shapefile={editProjShapefile}
                onShapefileChange={setEditProjShapefile}
                label="Update Landscape Shapefile (.zip, .geojson)"
                targetHabitat={editProjType === 'Lantana' ? 'LC' : 'common'}
              />

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

              <ShapefileUploadField
                shapefile={editSiteShapefile}
                onShapefileChange={setEditSiteShapefile}
                label="Update Site Boundary Shapefile (.zip, .geojson)"
                targetHabitat={
                  editingSite.source === 'Lantana'
                    ? (editRecorderId.toUpperCase().startsWith('LI') ? 'LI' : editRecorderId.toUpperCase().startsWith('CS') ? 'CS' : 'LC')
                    : 'common'
                }
                onCentroidExtracted={(lat, lng) => {
                  if (editSiteLat === '') setEditSiteLat(lat);
                  if (editSiteLng === '') setEditSiteLng(lng);
                }}
              />

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
                  <span className="text-[10px] font-mono text-slate-500">
                    {pamDetectionsList.length > 0 
                      ? `Page ${detectionPage + 1} (${filteredPamDetections.length} loaded)` 
                      : '0 records loaded'}
                  </span>
                  <select
                    value={detectionsTabScope}
                    onChange={(e) => {
                      setDetectionsTabScope(e.target.value as 'Lantana' | 'Common');
                      setPamSelectedProject('Select Project');
                      setPamSelectedSite('Select Site');
                      setPamSelectedRecorder('All');
                      setPamDetectionsList([]);
                      setDetectionPage(0);
                      setSelectedDetectionIds(new Set());
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="Lantana">Lantana Offline Data</option>
                    <option value="Common">Common PAM Offline Data</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[200px]">
                    <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase">1. Select Project</label>
                    <select 
                      value={pamSelectedProject} 
                      onChange={e => {
                        setPamSelectedProject(e.target.value);
                        setPamSelectedSite('Select Site');
                        setPamSelectedRecorder('All');
                        setPamDetectionsList([]);
                        setDetectionPage(0);
                        setSelectedDetectionIds(new Set());
                      }} 
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 shadow-sm"
                    >
                      <option value="Select Project" disabled>Select a Project</option>
                      {scopedProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[200px]">
                    <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase">2. Select Site</label>
                    <select 
                      value={pamSelectedSite} 
                      onChange={e => {
                        setPamSelectedSite(e.target.value);
                        setPamSelectedRecorder('All');
                        setPamDetectionsList([]);
                        setDetectionPage(0);
                        setSelectedDetectionIds(new Set());
                      }} 
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 shadow-sm disabled:opacity-50"
                      disabled={pamSelectedProject === 'Select Project'}
                    >
                      <option value="Select Site" disabled>Select a Site</option>
                      <option value="ALL_SITES">All Sites in Project (Entire Project)</option>
                      {scopedSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[150px]">
                    <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase">3. Filter Recorder</label>
                    <select 
                      value={pamSelectedRecorder} 
                      onChange={e => {
                        setPamSelectedRecorder(e.target.value);
                        setPamDetectionsList([]);
                        setDetectionPage(0);
                        setSelectedDetectionIds(new Set());
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 shadow-sm disabled:opacity-50"
                      disabled={pamSelectedSite === 'Select Site' || pamSelectedSite === 'ALL_SITES' || isRecordersLoading}
                    >
                      {pamSelectedSite === 'Select Site' ? (
                        <option value="All" disabled>Select Site first</option>
                      ) : pamSelectedSite === 'ALL_SITES' ? (
                        <option value="All">All Recorders (Project-wide)</option>
                      ) : isRecordersLoading ? (
                        <option value="All" disabled>Loading...</option>
                      ) : (
                        <option value="All">All Recorders</option>
                      )}
                      {pamSelectedSite !== 'ALL_SITES' && availableRecorders.map(r => <option key={r} value={r as string}>{r as string}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[220px]">
                    <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase flex items-center gap-1">
                      <Search className="w-3 h-3 text-indigo-500" /> 4. Search Species (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={pamSearchSpecies}
                        onChange={e => {
                          setPamSearchSpecies(e.target.value);
                          setDetectionPage(0);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (pamSelectedSite !== 'Select Site') {
                              handleLoadDetections(0);
                            }
                          }
                        }}
                        placeholder="e.g. Peafowl, Bulbul, Dove..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-2 font-bold text-slate-700 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      {pamSearchSpecies && (
                        <button
                          type="button"
                          onClick={() => {
                            setPamSearchSpecies('');
                            setDetectionPage(0);
                            if (pamSelectedSite !== 'Select Site') {
                              handleLoadDetections(0, undefined, '');
                            }
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[130px]">
                    <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase">Batch Size</label>
                    <select 
                      value={detectionPageSize} 
                      onChange={e => {
                        const newSize = parseInt(e.target.value, 10);
                        setDetectionPageSize(newSize);
                        if (pamSelectedSite !== 'Select Site') {
                          handleLoadDetections(0, newSize);
                        }
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 shadow-sm"
                    >
                      <option value={100}>100 rows</option>
                      <option value={500}>500 rows</option>
                      <option value={1000}>1,000 rows</option>
                      <option value={2500}>2,500 rows</option>
                      <option value={5000}>5,000 rows</option>
                      <option value={10000}>10,000 rows</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full sm:w-auto mt-auto pt-[2px]">
                    <button
                      onClick={() => handleLoadDetections(0)}
                      disabled={pamSelectedSite === 'Select Site' || isDetectionsLoading}
                      className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isDetectionsLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isDetectionsLoading ? 'Loading...' : 'Load Data'}</span>
                    </button>
                  </div>

                  {currentRole === 'Admin' && (
                    <div className="flex flex-col gap-1.5 w-full sm:w-auto mt-auto pt-[2px]">
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteAllModal()}
                        disabled={pamSelectedSite === 'Select Site' || isDetectionsLoading || isDeletingAll}
                        className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 font-black shadow-sm disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title={pamSelectedSite === 'ALL_SITES' ? 'Delete all detections for this entire project across all database tables' : 'Delete all detections for this site or recorder across all database tables'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{pamSelectedSite === 'ALL_SITES' ? 'Delete All Project Detections' : pamSelectedRecorder !== 'All' ? 'Delete Recorder Detections' : 'Delete All Site Detections'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {currentRole === 'Admin' && selectedDetectionIds.size > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl animate-fade-in">
                    <span className="text-xs font-bold text-red-700">{selectedDetectionIds.size} rows selected</span>
                    <button
                      onClick={handleBulkDelete}
                      className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm ml-auto transition-colors"
                    >
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black tracking-widest text-slate-400 uppercase border-b border-slate-100">
                    {currentRole === 'Admin' && (
                      <th className="py-3 px-4 w-10">
                        <input 
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={filteredPamDetections.length > 0 && selectedDetectionIds.size === filteredPamDetections.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDetectionIds(new Set(filteredPamDetections.map(d => d.id)));
                            } else {
                              setSelectedDetectionIds(new Set());
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className="py-3 px-4">ID</th>
                    <th 
                      className="py-3 px-4 cursor-pointer hover:text-indigo-600 select-none transition" 
                      onClick={() => {
                        if (pamSortColumn === 'date') setPamSortDesc(!pamSortDesc);
                        else { setPamSortColumn('date'); setPamSortDesc(true); }
                      }}
                    >
                      Date & Time {pamSortColumn === 'date' ? (pamSortDesc ? '↓' : '↑') : ''}
                    </th>
                    <th className="py-3 px-4">Project & Site</th>
                    <th 
                      className="py-3 px-4 cursor-pointer hover:text-indigo-600 select-none transition"
                      onClick={() => {
                        if (pamSortColumn === 'species') setPamSortDesc(!pamSortDesc);
                        else { setPamSortColumn('species'); setPamSortDesc(false); }
                      }}
                    >
                      Species {pamSortColumn === 'species' ? (pamSortDesc ? '↓' : '↑') : ''}
                    </th>
                    <th 
                      className="py-3 px-4 text-center cursor-pointer hover:text-indigo-600 select-none transition"
                      onClick={() => {
                        if (pamSortColumn === 'confidence') setPamSortDesc(!pamSortDesc);
                        else { setPamSortColumn('confidence'); setPamSortDesc(true); }
                      }}
                    >
                      Confidence {pamSortColumn === 'confidence' ? (pamSortDesc ? '↓' : '↑') : ''}
                    </th>
                    {currentRole === 'Admin' && (
                      <th className="py-3 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredPamDetections.length === 0 ? (
                    <tr>
                      <td colSpan={currentRole === 'Admin' ? 7 : 5} className="py-12 text-center text-slate-400">
                        {isDetectionsLoading 
                          ? 'Fetching detections from database...' 
                          : pamSelectedSite === 'Select Site' 
                            ? 'Please select a Project and Site, then click "Load Data".' 
                            : 'No detections found for the selected filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPamDetections.map(det => (
                      <tr key={det.id} className={`hover:bg-slate-50 transition ${selectedDetectionIds.has(det.id) ? 'bg-indigo-50/50' : ''}`}>
                        {currentRole === 'Admin' && (
                          <td className="py-2.5 px-4">
                            <input 
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={selectedDetectionIds.has(det.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedDetectionIds);
                                if (e.target.checked) newSet.add(det.id);
                                else newSet.delete(det.id);
                                setSelectedDetectionIds(newSet);
                              }}
                            />
                          </td>
                        )}
                        <td className="py-2.5 px-4 font-mono text-[10px]">{det.id}</td>
                        <td className="py-2.5 px-4 font-mono text-[10px]">
                          <div>{det.date}</div>
                          <div>{det.time}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">{det.project_name || 'N/A'}</div>
                          <div className="text-[10px] text-slate-400">{det.site_name} {det.recorder_id || det.recorder_name ? `(${det.recorder_id || det.recorder_name})` : ''}</div>
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
                        {currentRole === 'Admin' && (
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => handleDeletePamDetection(det.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pamDetectionsList.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
                <div className="text-slate-500 font-medium">
                  Showing <span className="font-bold text-slate-800">{detectionPage * detectionPageSize + 1}</span> to{' '}
                  <span className="font-bold text-slate-800">{detectionPage * detectionPageSize + filteredPamDetections.length}</span> records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLoadDetections(detectionPage - 1)}
                    disabled={detectionPage === 0 || isDetectionsLoading}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 font-mono font-bold text-indigo-700">
                    Page {detectionPage + 1}
                  </div>

                  <button
                    onClick={() => handleLoadDetections(detectionPage + 1)}
                    disabled={!hasMoreDetections || isDetectionsLoading}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete All Detections Modal */}
      {currentRole === 'Admin' && isDeleteAllModalOpen && (() => {
        const isProjectWide = !siteToDeleteDetections && pamSelectedSite === 'ALL_SITES';
        const activeSiteName = isProjectWide 
          ? 'Entire Project (All Sites)' 
          : (siteToDeleteDetections 
              ? siteToDeleteDetections.name 
              : (scopedSites.find(s => s.id === pamSelectedSite)?.name || pamSelectedSite));
        const activeProjName = siteToDeleteDetections
          ? (projectsList.find(p => p.id === siteToDeleteDetections.projectId)?.title || siteToDeleteDetections.projectId)
          : (scopedProjects.find(p => p.id === pamSelectedProject)?.title || pamSelectedProject);
        const activeRecorder = isProjectWide ? null : (siteToDeleteDetections
          ? siteToDeleteDetections.recorderId
          : (pamSelectedRecorder !== 'All' ? pamSelectedRecorder : null));

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-xs">
              
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-900 text-white relative shrink-0">
                <button
                  type="button"
                  onClick={() => !isDeletingAll && setIsDeleteAllModalOpen(false)}
                  disabled={isDeletingAll}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black tracking-tight text-white uppercase">Purge Detections Dataset</h2>
                </div>
                <p className="text-[11px] text-rose-200/80 font-medium">
                  Permanently remove bioacoustic detection records from Supabase observatory datasets.
                </p>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* Target Scope Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Target Coordinates & Registry</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">PROJECT</span>
                      <span className="font-extrabold text-slate-800">{activeProjName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">SITE / SCOPE</span>
                      <span className={`font-extrabold ${isProjectWide ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200' : 'text-slate-800'}`}>
                        {activeSiteName}
                      </span>
                    </div>
                  </div>
                  {activeRecorder && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold">RECORDER HARDWARE</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{activeRecorder}</span>
                    </div>
                  )}
                </div>

                {/* Scope Selection (if recorder exists) */}
                {activeRecorder && (
                  <div className="space-y-2">
                    <label className="font-extrabold text-slate-700 block">Deletion Scope</label>
                    <div className="space-y-1.5">
                      <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="deleteAllScope"
                          value="recorder"
                          checked={deleteAllScope === 'recorder'}
                          onChange={() => setDeleteAllScope('recorder')}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-900 block">Delete recorder &ldquo;{activeRecorder}&rdquo; only</span>
                          <span className="text-[10px] text-slate-500">Only detections generated by this hardware unit at {activeSiteName} will be purged.</span>
                        </div>
                      </label>
                      <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="deleteAllScope"
                          value="site"
                          checked={deleteAllScope === 'site'}
                          onChange={() => setDeleteAllScope('site')}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-slate-900 block">Delete ALL detections for site &ldquo;{activeSiteName}&rdquo;</span>
                          <span className="text-[10px] text-slate-500">Purges detections for all recorders associated with this entire site location.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Database Scope Notice */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900 block">Database Synchronization</span>
                    <span className="text-[10px] text-slate-500">Automatically purges records across all related observatory tables in Supabase (raw PAM detections, hourly rollups, unified detections).</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap ml-2">
                    All Related DBs
                  </span>
                </div>

                {/* Warning Callout */}
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-2.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="font-bold">Permanent Deletion:</strong> This action cannot be reversed. All raw acoustic event detections, species identifications, and confidence scores {isProjectWide ? 'for ALL sites in this project' : 'for this site'} will be permanently removed.
                  </div>
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-center gap-2.5 p-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deleteAllConfirmed}
                    onChange={(e) => setDeleteAllConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800 text-xs">
                    I confirm that I want to delete all matching detections from Supabase.
                  </span>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDeleteAllModalOpen(false)}
                  disabled={isDeletingAll}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDeleteAllDetections}
                  disabled={!deleteAllConfirmed || isDeletingAll}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 disabled:opacity-40 transition flex items-center gap-2"
                >
                  {isDeletingAll ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Purging Data...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isProjectWide ? 'Confirm & Delete All Project Detections' : 'Confirm & Delete All Detections'}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Inspect Shapefile Modal */}
      {inspectingShapefile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                    <Layers className="w-4 h-4" />
                  </span>
                  <h3 className="font-black text-slate-900 text-sm">
                    {inspectingShapefile.name || inspectingShapefile.targetId || inspectingShapefile.id}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  targetId: {inspectingShapefile.targetId || inspectingShapefile.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectingShapefile(null);
                  setInspectGeoJson(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Metadata Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Associated Project</span>
                  <span className="font-extrabold text-slate-800 truncate block mt-0.5">
                    {getShapefileProject(inspectingShapefile)?.title || inspectingShapefile.projectId || 'Unassigned'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Scope</span>
                  <span className="font-extrabold text-slate-800 block mt-0.5">
                    {inspectingShapefile.targetType === 'project' ? 'Project Landscape' : 'Site Boundary'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Habitat / Tag</span>
                  <span className="font-mono font-extrabold text-slate-800 block mt-0.5">
                    {inspectingShapefile.habitat || 'common'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Centroid Coordinates</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 block mt-0.5">
                    {Array.isArray(inspectingShapefile.centroid) && inspectingShapefile.centroid.length === 2
                      ? `${Number(inspectingShapefile.centroid[0]).toFixed(4)}°, ${Number(inspectingShapefile.centroid[1]).toFixed(4)}°`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* GeoJSON Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-700 block">GeoJSON Structure Preview</span>
                  {inspectGeoJson && (
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Type: {inspectGeoJson.type} • {inspectGeoJson.features ? `${inspectGeoJson.features.length} Features` : 'Geometry'}
                    </span>
                  )}
                </div>

                {isInspectLoading ? (
                  <div className="p-8 rounded-xl bg-slate-900 text-slate-400 flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                    <span className="text-xs font-mono">Fetching GeoJSON payload from observatory storage...</span>
                  </div>
                ) : inspectGeoJson ? (
                  <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[10px] leading-relaxed max-h-64 overflow-auto border border-slate-800 select-all">
                    {JSON.stringify(inspectGeoJson, null, 2)}
                  </pre>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400">
                    No GeoJSON data loaded.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div>
                {currentRole === 'Admin' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteShapefile(inspectingShapefile)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold flex items-center gap-1.5 transition border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Shapefile</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadGeoJson(inspectingShapefile, inspectGeoJson)}
                  disabled={!inspectGeoJson}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download GeoJSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectingShapefile(null);
                    setInspectGeoJson(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Shapefile Confirmation Modal */}
      {shapefileToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-rose-100 text-rose-700">
                  <Trash2 className="w-4 h-4" />
                </span>
                <h3 className="font-black text-slate-900 text-sm">Delete Shapefile Overlay</h3>
              </div>
              <button
                type="button"
                onClick={() => setShapefileToDelete(null)}
                disabled={isDeletingShapefile}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs font-sans">
              <p className="text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete the shapefile overlay for{' '}
                <strong className="text-slate-900 font-extrabold">{shapefileToDelete.name || shapefileToDelete.targetId || shapefileToDelete.id}</strong>?
              </p>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono text-[11px]">
                <div><span className="text-slate-400">Target ID:</span> <strong className="text-slate-800">{shapefileToDelete.targetId || shapefileToDelete.id}</strong></div>
                <div><span className="text-slate-400">Scope:</span> <span className="text-slate-800">{shapefileToDelete.targetType === 'project' ? 'Project Landscape' : 'Site Boundary'}</span></div>
                <div><span className="text-slate-400">Project:</span> <span className="text-slate-800">{getShapefileProject(shapefileToDelete)?.title || 'Unassigned'}</span></div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-2 text-rose-800 text-[11px] leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>This action cannot be undone. The GeoJSON boundary will be permanently purged from observatory storage and deregistered from map layers.</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShapefileToDelete(null)}
                disabled={isDeletingShapefile}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteShapefile}
                disabled={isDeletingShapefile}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isDeletingShapefile ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Shapefile...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
