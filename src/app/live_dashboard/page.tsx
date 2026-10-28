'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  LayoutDashboard, 
  MapPin, 
  LineChart, 
  Clock, 
  Radio, 
  Cpu, 
  Bird, 
  CheckSquare, 
  FileText, 
  ChevronRight, 
  Activity, 
  Sparkles, 
  Filter, 
  ShieldCheck, 
  Search, 
  Calendar, 
  Play, 
  Check, 
  X, 
  Download, 
  Share2, 
  Volume2, 
  VolumeX,
  AlertTriangle,
  RotateCcw,
  Sun,
  Thermometer,
  HardDrive,
  ExternalLink,
  Pause,
  Headphones,
  Wifi,
  Sliders,
  Trash2,
  Music
} from 'lucide-react';
import { AccumulationChart } from '@/components/charts/AccumulationChart';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { PolarDiurnalChart } from '@/components/charts/PolarDiurnalChart';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { RavenProLiveSpectrogram } from '@/components/audio/RavenProLiveSpectrogram';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { ReportGeneratorModal } from '@/components/reports/ReportGeneratorModal';
import DashboardLoader from '@/components/ui/DashboardLoader';

export interface WindowSummaryItem {
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

const SatelliteMap = dynamic(() => import('@/components/map/SatelliteMap'), { ssr: false });
const LantanaMap = dynamic(() => import('@/components/map/LantanaMap'), { ssr: false });

const MONTH_NAMES = [
  { value: 'ALL', label: 'All Months' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

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

export type LiveDashboardTab = 
  | 'summary' 
  | 'map' 
  | 'accumulation' 
  | 'diurnal' 
  | 'live' 
  | 'triage'
  | 'stations' 
  | 'species' 
  | 'review' 
  | 'reports';

export default function LiveDashboardPage() {
  const { currentRole, currentUser, visibilitySettings, isTabVisibleForPublic } = useRole();
  const [activeTab, setActiveTab] = useState<LiveDashboardTab>('summary');
  const [copiedLinkToast, setCopiedLinkToast] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  // 3-Level Scope Toolbar States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');

  // Search & Filter (Default 25% confidence standard for bioacoustic field detection)
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.25);

  // Species Accumulation Filter States
  const [accumulationInterval, setAccumulationInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [accumulationYear, setAccumulationYear] = useState<string>('ALL');
  const [accumulationMonth, setAccumulationMonth] = useState<string>('ALL');

  // Diurnal Filter State
  const [diurnalFilterDate, setDiurnalFilterDate] = useState<string>('');

  // Review Queue States
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSort, setReviewSort] = useState<'newest' | 'confidence'>('newest');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [verifyingId, setVerifyingId] = useState<string | number | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | number | null>(null);

  // Live Database Purge States
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [purgeScope, setPurgeScope] = useState<'station' | 'project'>('station');
  const [purgeStatusScope, setPurgeStatusScope] = useState<'all' | 'pending' | 'rejected' | 'approved'>('all');
  const [purgeConfirmed, setPurgeConfirmed] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Acoustic Watchdog Triage States
  const [windowSummaries, setWindowSummaries] = useState<WindowSummaryItem[]>([]);
  const [triageFilterFlag, setTriageFilterFlag] = useState<string>('ALL');
  const [triageFilterStatus, setTriageFilterStatus] = useState<string>('all');
  const [playingClipPath, setPlayingClipPath] = useState<string | null>(null);
  const triageAudioRef = useRef<HTMLAudioElement | null>(null);

  // Species Catalog State & Ecology Map
  const [speciesEcologyMap, setSpeciesEcologyMap] = useState<Record<string, any>>({});
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState<'detections' | 'alphabetical' | 'iucn'>('detections');

  // Supabase Data States
  const [liveProjects, setLiveProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, any>>({});
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Live Audio & Detection Streaming States
  const [isLiveStreamActive, setIsLiveStreamActive] = useState(false);
  const [isLiveAudioPlaying, setIsLiveAudioPlaying] = useState(false);
  const [directStreamUrl, setDirectStreamUrl] = useState('http://172.27.78.51:8888/stream.opus');
  const [selectedStreamNode, setSelectedStreamNode] = useState('Test_01');
  const [liveAudioVolume, setLiveAudioVolume] = useState(0.85);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [autoPlayOnDetection, setAutoPlayOnDetection] = useState(false);
  const [lastLiveDetectionId, setLastLiveDetectionId] = useState<any>(null);
  const [liveStreamError, setLiveStreamError] = useState<string | null>(null);
  const [liveStreamSessionStart, setLiveStreamSessionStart] = useState<number | null>(null);
  const [liveFeedFilter, setLiveFeedFilter] = useState<'session' | 'all'>('session');
  const liveAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // RBAC Permission: Only managers and admins can monitor live edge audio & spectrogram
  const canAccessLiveStream = currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager';

  // Read initial tab from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') as LiveDashboardTab;
    if (tabParam && ['summary', 'map', 'accumulation', 'diurnal', 'live', 'triage', 'stations', 'species', 'review', 'reports'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Synchronize Tab in URL
  useEffect(() => {
    if (typeof window === 'undefined' || loading) return;
    const currentUrl = new URL(window.location.href);
    if (activeTab && activeTab !== 'summary') {
      currentUrl.searchParams.set('tab', activeTab);
    } else {
      currentUrl.searchParams.delete('tab');
    }
    window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search);
  }, [activeTab, loading]);

  useEffect(() => {
    let isCurrent = true;

    async function loadLiveDashboardData() {
      setLoading(true);
      setLoadingProgress(20);
      try {
        // 1. Fetch from server admin API for bypass of client RLS
        let adminTelemetry: any[] = [];
        let adminRecorders: any[] = [];
        let adminProjects: any[] = [];
        try {
          const adminRes = await fetch('/api/live/admin');
          if (adminRes.ok) {
            const adminJson = await adminRes.json();
            if (adminJson.success) {
              adminTelemetry = adminJson.telemetry || [];
              adminRecorders = adminJson.recorders || [];
              adminProjects = adminJson.projects || [];
            }
          }
        } catch (e) {
          console.warn('API live admin fetch note:', e);
        }

        const [
          { data: projs },
          { data: recordersData },
          { data: sitesData },
          { data: ecologyData },
          { data: telemetryData },
          { data: windowSummariesData },
          { count: liveCount }
        ] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('name'),
          supabase.from('lantana_species_ecology').select('*'),
          supabase.from('station_telemetry').select('*').order('ping_time', { ascending: false }).limit(50),
          supabase.from('window_summaries').select('*').order('timestamp', { ascending: false }).limit(100),
          supabase.from('live_detections').select('*', { count: 'exact', head: true })
        ]);

        const combinedTelemetry = adminTelemetry.length > 0 ? adminTelemetry : (telemetryData || []);
        const combinedRecorders = adminRecorders.length > 0 ? adminRecorders : (recordersData || []);
        const combinedProjects = adminProjects.length > 0 ? adminProjects : (projs || []);

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

        if (!isCurrent) return;
        setLoadingProgress(prev => Math.max(prev, 70));

        let scopedProjs = combinedProjects;
        let rawSites = sitesData || [];

        // Apply RBAC filters to projects and sites
        if (currentRole === 'Project Manager') {
          const assigned = currentUser?.assignedProjects || [];
          scopedProjs = scopedProjs.filter((p: any) => assigned.includes(p.id));
          rawSites = rawSites.filter((s: any) => assigned.includes(s.project_id));
        } else if (currentRole === 'Site Manager') {
          const assignedSites = currentUser?.assignedSites || [];
          rawSites = rawSites.filter((s: any) => assignedSites.includes(s.id));
          const allowedProjIds = new Set(rawSites.map((s: any) => s.project_id));
          scopedProjs = scopedProjs.filter((p: any) => allowedProjIds.has(p.id));
        }

        const liveProjectIds = new Set(scopedProjs.map((p: any) => p.id));
        const liveSites = rawSites.filter((s: any) => liveProjectIds.has(s.project_id));
        setLiveProjects(scopedProjs);

        const queryProject = new URLSearchParams(window.location.search).get('project');
        if (queryProject && liveProjectIds.has(queryProject)) {
          setSelectedProjectId(queryProject);
        } else if ((currentRole === 'Site Manager' || currentRole === 'Project Manager') && scopedProjs.length > 0) {
          setSelectedProjectId(scopedProjs[0].id);
        }

        // Scope hardware nodes, and auto-link any active nodes from telemetry
        let scopedRecorders = [...combinedRecorders];
        if (combinedTelemetry && combinedTelemetry.length > 0) {
          const existingIds = new Set(scopedRecorders.map((r: any) => r.recorder_id));
          for (const tel of combinedTelemetry) {
            const sid = tel.node_id || tel.station_id;
            if (sid && !existingIds.has(sid)) {
              existingIds.add(sid);
              scopedRecorders.push({
                id: sid,
                project_type: 'Live',
                project_name: scopedProjs[0]?.name || 'Test_custom',
                site_name: 'Tirupati',
                recorder_id: sid,
                status: 'online',
                lat: 13.6288,
                long: 79.4192,
                elevation: null,
                last_ping: tel.ping_time || tel.timestamp || new Date().toISOString(),
                battery_level: tel.battery_level ?? (tel.battery_capacity_percent ? Math.round(tel.battery_capacity_percent) : 100),
                cpu_temperature: tel.cpu_temp_c ?? tel.cpu_temperature ?? 40.4,
                storage_used_percent: tel.disk_usage ?? 6,
                firmware_version: 'v2.4'
              });
            }
          }
        }

        if (currentRole === 'Site Manager') {
          const siteNames = new Set(liveSites.map((s: any) => s.name));
          scopedRecorders = scopedRecorders.filter((r: any) => siteNames.has(r.site_name));
        } else if (currentRole === 'Project Manager') {
          const projNames = new Set(scopedProjs.map((p: any) => p.name));
          scopedRecorders = scopedRecorders.filter((r: any) => projNames.has(r.project_name));
        }

        const ecoMap: Record<string, any> = {};
        (ecologyData || []).forEach((e: any) => {
          if (e.common_name) {
            ecoMap[e.common_name.toLowerCase().trim()] = e;
            ecoMap[e.common_name.trim()] = e;
          }
        });
        setSpeciesEcologyMap(ecoMap);

        const tMap: Record<string, any> = {};
        if (combinedTelemetry && combinedTelemetry.length > 0) {
          for (const t of combinedTelemetry) {
            const nId = t.node_id || t.station_id;
            if (nId && !tMap[nId]) tMap[nId] = t;
            if (t.station_id && !tMap[t.station_id]) tMap[t.station_id] = t;
            if (t.node_id && !tMap[t.node_id]) tMap[t.node_id] = t;
          }
        }
        setTelemetryMap(tMap);

        setWindowSummaries(windowSummariesData || []);
        setStationsList(scopedRecorders);
        setSitesList(liveSites);
        setDetections(dedupeDetections(detData || []));

        if (scopedRecorders.length > 0) {
          setSelectedStreamNode((prev) => {
            const hasPrev = scopedRecorders.some(r => (r.recorder_id || r.id) === prev);
            if (!prev || !hasPrev) {
              return scopedRecorders[0].recorder_id || scopedRecorders[0].id;
            }
            return prev;
          });
        }

        setLoadingProgress(100);
      } catch (err) {
        console.error('Failed to load Live Dashboard data:', err);
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }

    loadLiveDashboardData();

    // Realtime channel
    const channel = supabase
      .channel('live-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_detections' },
        (payload) => {
          setDetections((prev) => dedupeDetections([payload.new, ...prev]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'window_summaries' },
        (payload) => {
          setWindowSummaries((prev) => [payload.new as any, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'window_summaries' },
        (payload) => {
          setWindowSummaries((prev) => prev.map(w => w.id === payload.new.id ? payload.new as any : w));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recorders_registry' },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as any;
            setStationsList((prev) => prev.map(s => (s.recorder_id === updated.recorder_id || s.id === updated.id) ? { ...s, ...updated } : s));
            const newStreamUrl = updated.stream_url || (updated.elevation?.startsWith('http') ? updated.elevation : null);
            if (newStreamUrl && (!selectedStreamNode || updated.recorder_id === selectedStreamNode)) {
              setDirectStreamUrl(newStreamUrl);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isCurrent = false;
      supabase.removeChannel(channel);
    };
  }, [currentRole, currentUser, selectedStreamNode]);

  // Automatically link the Stream Target URL right when the station runs or connects
  useEffect(() => {
    const activeStation = stationsList.find(s => (s.recorder_id || s.id) === selectedStreamNode) || stationsList[0];
    if (activeStation) {
      const autoUrl = activeStation.stream_url || (activeStation.elevation?.startsWith('http') ? activeStation.elevation : null);
      if (autoUrl && autoUrl !== directStreamUrl) {
        setDirectStreamUrl(autoUrl);
      }
    }
  }, [stationsList, selectedStreamNode]);

  // Filter live sites strictly by selected Live project
  const availableSites = selectedProjectId === 'ALL'
    ? sitesList
    : sitesList.filter(s => s.project_id === selectedProjectId);

  const selectedProjectName = selectedProjectId === 'ALL'
    ? 'ALL'
    : liveProjects.find((p: any) => p.id === selectedProjectId)?.name;
  const selectedSiteName = selectedSiteId === 'ALL'
    ? 'ALL'
    : availableSites.find((s: any) => s.id === selectedSiteId)?.name;

  // Hardware recorder nodes from recorders_registry, scoped by project and optional site
  const availableStations = stationsList.filter((s: any) => {
    if (selectedProjectName !== 'ALL' && s.project_name !== selectedProjectName) return false;
    if (selectedSiteName !== 'ALL' && s.site_name !== selectedSiteName) return false;
    return true;
  });

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedSiteId('ALL');
    setSelectedStationId('ALL');
  };

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedStationId('ALL');
  };

  // Filter detections by 3-level scope & search/confidence (including non-avian bioacoustic calls)
  const filteredDetections = useMemo(() => {
    return detections.filter((det) => {
      const common = det.common_name || '';
      const sci = det.scientific_name || '';

      const matchesSearch = common.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            sci.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesStation = true;
      if (selectedStationId !== 'ALL') {
        matchesStation = det.station_id === selectedStationId || det.station_name === selectedStationId || det.recorder_id === selectedStationId;
      }

      const matchesConf = (det.confidence || 0) >= minConfidence;
      return matchesSearch && matchesStation && matchesConf;
    });
  }, [detections, searchQuery, selectedStationId, minConfidence]);

  // Detections displayed specifically in the Live Stream tab (Tab 5):
  // When in 'session' mode, it only shows detections detected during the active stream session.
  // When disconnected, it resets to empty. All detections are permanently saved in the database.
  const liveTabDetections = useMemo(() => {
    if (liveFeedFilter === 'session') {
      if (!isLiveStreamActive || !liveStreamSessionStart) {
        return []; // Resets upon disconnect!
      }
      return filteredDetections.filter(d => {
        if (!d.timestamp) return false;
        return new Date(d.timestamp).getTime() >= liveStreamSessionStart;
      });
    }
    return filteredDetections;
  }, [filteredDetections, liveFeedFilter, isLiveStreamActive, liveStreamSessionStart]);

  // Realtime KPI metrics
  const totalDetections = filteredDetections.length;
  const uniqueSpecies = Array.from(new Set(filteredDetections.map(d => d.common_name).filter(Boolean))).length;

  // Hourly Diurnal Data (24 Hours)
  const hourlyData = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      detections: 0
    }));

    filteredDetections.forEach(d => {
      if (!d.timestamp) return;
      if (diurnalFilterDate) {
        const dDate = new Date(d.timestamp).toISOString().slice(0, 10);
        if (dDate !== diurnalFilterDate) return;
      }
      const h = new Date(d.timestamp).getHours();
      if (h >= 0 && h < 24) arr[h].detections += 1;
    });

    return arr;
  }, [filteredDetections, diurnalFilterDate]);

  // Top Species Abundance Data
  const topSpeciesData = useMemo(() => {
    const spMap: Record<string, number> = {};
    filteredDetections.forEach(d => {
      if (d.common_name) spMap[d.common_name] = (spMap[d.common_name] || 0) + 1;
    });
    return Object.keys(spMap)
      .map(sp => ({ species: sp, detections: spMap[sp] }))
      .sort((a, b) => b.detections - a.detections)
      .slice(0, 10);
  }, [filteredDetections]);

  // Available Years from detections
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    filteredDetections.forEach(d => {
      if (d.timestamp) {
        const y = new Date(d.timestamp).getFullYear().toString();
        yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort().reverse();
  }, [filteredDetections]);

  // Available Dates for diurnal filter
  const availableDatesList = useMemo(() => {
    const dateSet = new Set<string>();
    filteredDetections.forEach(d => {
      if (d.timestamp) {
        dateSet.add(new Date(d.timestamp).toISOString().slice(0, 10));
      }
    });
    return Array.from(dateSet).sort().reverse();
  }, [filteredDetections]);

  // Species Accumulation Curve Data (with weekly/monthly/yearly/all filtering)
  const accumulationData = useMemo(() => {
    let list = filteredDetections.filter(d => d.timestamp && d.common_name);

    if (accumulationYear !== 'ALL') {
      list = list.filter(d => new Date(d.timestamp).getFullYear().toString() === accumulationYear);
    }

    if (accumulationMonth !== 'ALL') {
      list = list.filter(d => {
        const m = String(new Date(d.timestamp).getMonth() + 1).padStart(2, '0');
        return m === accumulationMonth;
      });
    }

    if (list.length === 0) return [];

    // Sort chrono
    const sorted = [...list].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const seen = new Set<string>();
    const groupedBuckets: Record<string, number> = {};

    sorted.forEach(d => {
      const dateObj = new Date(d.timestamp);
      seen.add(d.common_name);

      let key = dateObj.toISOString().slice(0, 10);
      if (accumulationInterval === 'weekly') {
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(dateObj.setDate(diff));
        key = `Wk ${mon.toISOString().slice(5, 10)}`;
      } else if (accumulationInterval === 'monthly') {
        key = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      } else if (accumulationInterval === 'yearly') {
        key = dateObj.getFullYear().toString();
      }

      groupedBuckets[key] = seen.size;
    });

    return Object.entries(groupedBuckets).map(([day, species]) => ({ day, species }));
  }, [filteredDetections, accumulationInterval, accumulationYear, accumulationMonth]);

  // Active Nodes calculation (status === 'online' or pinged recently within 30 mins)
  const activeNodesCount = availableStations.filter((s: any) => {
    if (s.status === 'online') return true;
    if (!s.last_ping) return false;
    const diffMins = (Date.now() - new Date(s.last_ping).getTime()) / 60000;
    return diffMins <= 30;
  }).length;

  // Copy share URL
  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLinkToast(true);
    setTimeout(() => setCopiedLinkToast(false), 2500);
  };

  // CSV Exporter
  const downloadDetectionsCSV = () => {
    const headers = ['Timestamp', 'Common Name', 'Scientific Name', 'Confidence', 'Station Node', 'Status'];
    const rows = filteredDetections.map(d => [
      `"${d.timestamp || ''}"`,
      `"${d.common_name || ''}"`,
      `"${d.scientific_name || ''}"`,
      d.confidence ? d.confidence.toFixed(2) : '0.00',
      `"${d.recorder_id || d.station_name || d.station_id || ''}"`,
      `"${d.verification_status || 'UNVERIFIED'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `live_detections_${selectedProjectId}_${new Date().toISOString().slice(0, 10)}.csv`
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Review status update handler with optimistic state and admin API persistence
  const handleVerify = async (id: string | number, verified: boolean) => {
    const status = verified ? 'YES' : 'NO';
    setVerifyingId(id);

    // 1. Optimistic state update so UI responds INSTANTLY
    setDetections(prev => prev.map(d => 
      String(d.id) === String(id) 
        ? { ...d, verification_status: status, reviewed: true, verified: verified } 
        : d
    ));

    // 2. Persist to backend via admin endpoint (bypasses RLS)
    try {
      const res = await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_detection', id, status })
      });
      if (!res.ok) {
        // Fallback to client supabase call
        await supabase
          .from('live_detections')
          .update({ verification_status: status, reviewed: true, verified })
          .eq('id', id);
      }
    } catch (e) {
      console.warn('API verify fallback:', e);
      await supabase
        .from('live_detections')
        .update({ verification_status: status, reviewed: true, verified })
        .eq('id', id);
    } finally {
      setVerifyingId(null);
    }
  };

  // Single Detection Deletion (Admin only)
  const handleDeleteDetection = async (id: string | number) => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can delete detections.');
      return;
    }
    if (!window.confirm('Delete this detection record permanently from Supabase?')) return;
    setIsDeletingId(id);

    // Optimistic UI removal
    setDetections(prev => prev.filter(d => String(d.id) !== String(id)));

    try {
      const res = await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_detection', id })
      });
      if (!res.ok) {
        await fetch(`/api/db/detections?table=live_detections&id=${id}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.error('Delete detection error:', e);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Purge / Delete matching live detections (Admin only)
  const handleExecuteLivePurge = async () => {
    if (currentRole !== 'Admin') {
      alert('Only administrators can purge detections.');
      return;
    }
    if (!purgeConfirmed) return;
    setIsPurging(true);

    try {
      const targetNode = purgeScope === 'station' && selectedStationId !== 'ALL' ? selectedStationId : 'All';
      const targetProj = selectedProjectId !== 'ALL' ? selectedProjectId : 'All';

      const res = await fetch('/api/live/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purge_detections',
          nodeId: targetNode,
          projectId: targetProj,
          statusFilter: purgeStatusScope
        })
      });

      // Filter local state
      setDetections(prev => prev.filter(d => {
        if (targetNode !== 'All') {
          const nid = d.recorder_id || d.station_id;
          if (nid === targetNode) return false;
        }
        if (purgeStatusScope !== 'all') {
          const isApproved = d.verification_status === 'YES' || d.verified === true;
          const isRejected = d.verification_status === 'NO' || d.verification_status === 'rejected';
          const isPending = !isApproved && !isRejected;
          if (purgeStatusScope === 'approved' && isApproved) return false;
          if (purgeStatusScope === 'rejected' && isRejected) return false;
          if (purgeStatusScope === 'pending' && isPending) return false;
        }
        if (targetNode === 'All' && purgeStatusScope === 'all') return false;
        return true;
      }));

      setIsPurgeModalOpen(false);
      setPurgeConfirmed(false);
    } catch (e: any) {
      console.error('Purge live detections error:', e);
      alert('Failed to purge live detections: ' + (e.message || 'Error'));
    } finally {
      setIsPurging(false);
    }
  };

  // Role-based visibility flags
  const canAccessReports = currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager' || visibilitySettings.allowPublicReports;
  const canAccessReview = currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager';

  // Acoustic Watchdog Triage Handlers & Filters
  const unreviewedTriageCount = useMemo(() => {
    return windowSummaries.filter(w => w.review_status === 'unreviewed').length;
  }, [windowSummaries]);

  const handlePlayTriageClip = (clipPath?: string) => {
    if (!clipPath) {
      alert('No audio clip available for this window summary.');
      return;
    }
    if (playingClipPath === clipPath) {
      triageAudioRef.current?.pause();
      setPlayingClipPath(null);
      return;
    }

    const publicUrl = supabase.storage.from('clips').getPublicUrl(clipPath.replace(/^clips\//, '')).data.publicUrl;
    setPlayingClipPath(clipPath);

    if (triageAudioRef.current) {
      triageAudioRef.current.src = publicUrl;
      triageAudioRef.current.play().catch(err => {
        console.warn('Playback error:', err);
        alert('Unable to play audio. The field station may still be syncing the Opus clip.');
        setPlayingClipPath(null);
      });
    }
  };

  const handleUpdateTriageStatus = async (windowId: string, newStatus: 'confirmed' | 'corrected' | 'discarded') => {
    try {
      await supabase.from('window_summaries').update({ review_status: newStatus }).eq('window_id', windowId);
    } catch (e) {
      console.warn('Database update for window summary failed:', e);
    }
    setWindowSummaries(prev => prev.map(w => w.window_id === windowId ? { ...w, review_status: newStatus } : w));
  };

  // Filtered Triage Windows
  const filteredTriageWindows = useMemo(() => {
    let allowedNodeIds: Set<string> | null = null;
    if (selectedStationId !== 'ALL') {
      allowedNodeIds = new Set([selectedStationId]);
    } else if (selectedProjectId !== 'ALL') {
      allowedNodeIds = new Set(availableStations.map(s => s.recorder_id || s.id));
    }

    return windowSummaries.filter(w => {
      if (allowedNodeIds && !allowedNodeIds.has(w.node_id)) return false;
      if (triageFilterStatus !== 'all' && w.review_status !== triageFilterStatus) return false;
      if (triageFilterFlag !== 'ALL' && !w.review_flags.includes(triageFilterFlag)) return false;
      return true;
    });
  }, [windowSummaries, triageFilterStatus, triageFilterFlag, selectedStationId, selectedProjectId, availableStations]);

  // Audio clips available for the selected stream node from window_summaries & live_detections
  const nodeClips = useMemo(() => {
    const fromWindows = windowSummaries
      .filter(w => (!selectedStreamNode || w.node_id === selectedStreamNode) && w.clip_path)
      .map(w => ({
        window_id: w.window_id,
        clip_path: w.clip_path!,
        timestamp: w.timestamp,
        snr_db: w.snr_db,
        species: w.species_detected
      }));
    const fromDetections = detections
      .filter(d => (!selectedStreamNode || d.recorder_id === selectedStreamNode || d.station_id === selectedStreamNode) && d.audio_url)
      .map(d => ({
        window_id: d.id || `${d.common_name}_${d.timestamp}`,
        clip_path: d.audio_url!,
        timestamp: d.timestamp,
        snr_db: 14.0,
        species: [d.common_name]
      }));
    return [...fromWindows, ...fromDetections];
  }, [windowSummaries, detections, selectedStreamNode]);

  // Start and open live stream on demand
  const handleOpenAndStartLiveStream = () => {
    setIsLiveStreamActive(true);
    setLiveStreamSessionStart(Date.now());
    setLiveStreamError(null);
    setTimeout(() => {
      if (!liveAudioElementRef.current) return;
      liveAudioElementRef.current.src = directStreamUrl;
      liveAudioElementRef.current.play().then(() => {
        setIsLiveAudioPlaying(true);
        setLiveStreamError(null);
      }).catch(err => {
        console.warn('Live audio play request interrupted:', err);
        if (directStreamUrl.includes('livedetector.local')) {
          const ipUrl = directStreamUrl.replace('livedetector.local', '172.27.78.51');
          setDirectStreamUrl(ipUrl);
          if (liveAudioElementRef.current) {
            liveAudioElementRef.current.src = ipUrl;
            liveAudioElementRef.current.play().then(() => {
              setIsLiveAudioPlaying(true);
              setLiveStreamError(null);
            }).catch(() => {
              setLiveStreamError(`Cannot reach continuous edge stream at "${ipUrl}". Check network connection.`);
            });
            return;
          }
        }
        setLiveStreamError(`Cannot reach continuous edge stream at "${directStreamUrl}".`);
      });
    }, 100);
  };

  // Completely turn off and disconnect stream - live audio is ephemeral and never saved
  const handleCloseLiveStream = () => {
    if (liveAudioElementRef.current) {
      liveAudioElementRef.current.pause();
      liveAudioElementRef.current.src = '';
      liveAudioElementRef.current.removeAttribute('src');
      liveAudioElementRef.current.load();
    }
    setIsLiveAudioPlaying(false);
    setIsLiveStreamActive(false);
    setLiveStreamError(null);
    setLiveStreamSessionStart(null); // Resets the live stream session detections feed
  };

  // Handle Play / Pause for Live Audio
  const handleToggleLiveAudio = () => {
    if (!liveAudioElementRef.current) return;

    if (isLiveAudioPlaying) {
      liveAudioElementRef.current.pause();
      setIsLiveAudioPlaying(false);
    } else {
      setLiveStreamError(null);
      if (!liveAudioElementRef.current.src || liveAudioElementRef.current.src === window.location.href) {
        liveAudioElementRef.current.src = directStreamUrl;
      }
      liveAudioElementRef.current.play().then(() => {
        setIsLiveAudioPlaying(true);
        setLiveStreamError(null);
      }).catch(err => {
        console.warn('Audio play request interrupted:', err);
        if (directStreamUrl.includes('livedetector.local')) {
          const ipUrl = directStreamUrl.replace('livedetector.local', '172.27.78.51');
          setDirectStreamUrl(ipUrl);
          if (liveAudioElementRef.current) {
            liveAudioElementRef.current.src = ipUrl;
            liveAudioElementRef.current.play().then(() => {
              setIsLiveAudioPlaying(true);
              setLiveStreamError(null);
            }).catch(() => {
              setLiveStreamError(`Cannot connect to live stream at ${ipUrl}. Check network connectivity.`);
            });
            return;
          }
        }
        setLiveStreamError(`Cannot connect to "${directStreamUrl}". Continuous port 8888 streaming requires the field station to be active on your local network or routed via a tunnel.`);
      });
    }
  };

  const handleStreamUrlChange = (newUrl: string) => {
    setDirectStreamUrl(newUrl);
    setLiveStreamError(null);
    if (liveAudioElementRef.current) {
      const wasPlaying = isLiveAudioPlaying;
      liveAudioElementRef.current.src = newUrl;
      if (wasPlaying) {
        liveAudioElementRef.current.play().then(() => {
          setIsLiveAudioPlaying(true);
        }).catch(err => {
          console.warn('Audio stream error with new URL:', err);
          setLiveStreamError(`Failed to stream from updated URL: ${newUrl}`);
        });
      }
    }
  };



  const handlePlayDetectionClipFromSpectrogram = (clipUrl: string) => {
    const match = detections.find(d => d.audio_url === clipUrl);
    if (match) {
      setSelectedDetection(match);
    } else {
      const a = new Audio(clipUrl);
      a.play().catch(console.warn);
    }
  };

  // Auto turn off stream when switching to another tab
  useEffect(() => {
    if (activeTab !== 'live' && isLiveStreamActive) {
      handleCloseLiveStream();
    }
  }, [activeTab, isLiveStreamActive]);

  // Sync volume & mute state
  useEffect(() => {
    if (liveAudioElementRef.current) {
      liveAudioElementRef.current.volume = isAudioMuted ? 0 : liveAudioVolume;
    }
  }, [liveAudioVolume, isAudioMuted]);

  // Auto-play new detection audio alert
  useEffect(() => {
    if (autoPlayOnDetection && detections.length > 0) {
      const newest = detections[0];
      if (newest && newest.id !== lastLiveDetectionId) {
        setLastLiveDetectionId(newest.id);
        if (newest.audio_url && liveAudioElementRef.current) {
          liveAudioElementRef.current.src = newest.audio_url;
          liveAudioElementRef.current.play().catch(() => {});
          setIsLiveAudioPlaying(true);
        }
      }
    }
  }, [detections, autoPlayOnDetection, lastLiveDetectionId]);

  const scopeKey = selectedSiteId !== 'ALL' ? `${selectedProjectId}:${selectedSiteId}` : selectedProjectId;

  // The 10 Ordered Tabs (with RBAC & Public Visibility filtering)
  const allNavMenuItems = [
    { id: 'summary', label: 'Summary', icon: LayoutDashboard },
    { id: 'map', label: 'Survey Site Map', icon: MapPin },
    { id: 'accumulation', label: 'Species Accumulation Curve', icon: LineChart },
    { id: 'diurnal', label: 'Diurnal Activity Pattern', icon: Clock },
    { id: 'live', label: 'Live Audio & Detections', icon: Radio, badge: 'LIVE' },
    ...(currentRole === 'Admin' ? [{ 
      id: 'triage', 
      label: 'Acoustic Watchdog & Triage', 
      icon: Activity, 
      badge: unreviewedTriageCount > 0 ? `${unreviewedTriageCount} REVIEW` : undefined 
    }] : []),
    { id: 'stations', label: 'Stations & Nodes', icon: Cpu, count: activeNodesCount },
    { id: 'species', label: 'Species Catalog', icon: Bird },
    ...(canAccessReview ? [{ id: 'review', label: 'Review Queue', icon: CheckSquare }] : []),
    ...(canAccessReports ? [{ id: 'reports', label: 'Reports & Export', icon: FileText }] : []),
  ];

  const navMenuItems = useMemo(() => {
    if (currentRole !== 'Public') return allNavMenuItems;
    return allNavMenuItems.filter(item => isTabVisibleForPublic('liveRecorder', item.id, scopeKey));
  }, [currentRole, isTabVisibleForPublic, scopeKey, canAccessReview, canAccessReports, activeNodesCount]);

  // Fallback if activeTab is not permitted or hidden
  useEffect(() => {
    if (currentRole === 'Public' && navMenuItems.length > 0) {
      const isCurrentVisible = navMenuItems.some(item => item.id === activeTab);
      if (!isCurrentVisible) {
        setActiveTab(navMenuItems[0].id as any);
      }
    } else {
      if (activeTab === 'triage' && currentRole !== 'Admin') {
        setActiveTab('summary');
      } else if (activeTab === 'review' && !canAccessReview) {
        setActiveTab('summary');
      } else if (activeTab === 'reports' && !canAccessReports) {
        setActiveTab('summary');
      }
    }
  }, [activeTab, canAccessReview, canAccessReports, currentRole, navMenuItems]);

  if (loading) {
    return <DashboardLoader progress={loadingProgress} message="Loading live bioacoustics feed..." />;
  }

  return (
    <div className="w-full h-[calc(100vh-80px)] overflow-hidden text-[#1a1f1c] font-sans flex flex-col md:flex-row bg-[#f8faf8]">
      <audio ref={triageAudioRef} onEnded={() => setPlayingClipPath(null)} />

      {/* ─── 1. LEFT SIDEBAR NAVIGATION (10 ORDERED TABS) ────────────────────── */}
      <aside className="w-full md:w-72 lg:w-80 bg-white border-r border-[#dde1dc] flex flex-col justify-between shrink-0 h-full overflow-y-auto shadow-sm">
        <div className="p-4 space-y-4">
          
          {/* Observatory Header Badge */}
          <div className="p-3.5 bg-[#f0f7f3] border border-[#dde1dc] rounded-xl">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">Live Observatory</div>
            <div className="text-xs font-bold text-[#1a1f1c]">Realtime Acoustic Monitoring</div>
          </div>

          {/* Navigation Menu Links */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#5a635d]">
              Live Dashboard Menu
            </div>

            <nav className="space-y-1">
              {navMenuItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as LiveDashboardTab)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-[#1f4d3a] text-white font-semibold shadow-sm'
                        : 'text-[#374151] hover:bg-[#f0f7f3] hover:text-[#1f4d3a]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#eaf2ed] text-[#1f4d3a]'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'} leading-snug truncate`}>
                        {item.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                          isActive ? 'bg-white text-[#1f4d3a]' : 'bg-emerald-600 text-white'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-white shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer Quick Stats */}
        <div className="p-4 border-t border-[#dde1dc] bg-[#fafbfa]">
          <div className="p-3 bg-white rounded-xl border border-[#dde1dc] flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#5a635d]">ACTIVE FIELD NODES</span>
              <span className="font-bold text-[#1f4d3a] bg-[#eaf2ed] px-2 py-0.5 rounded">{activeNodesCount} Online</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#5a635d]">IDENTIFIED TAXA</span>
              <span className="font-bold text-[#1f4d3a] bg-[#eaf2ed] px-2 py-0.5 rounded">{uniqueSpecies} Species</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#5a635d]">REALTIME CALLS</span>
              <span className="font-bold text-[#1f4d3a] bg-[#eaf2ed] px-2 py-0.5 rounded">{totalDetections.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── 2. MAIN CONTENT AREA (RIGHT SIDE) ───────────────────────────────── */}
      <main className="flex-1 min-w-0 h-full p-4 sm:p-6 lg:p-8 space-y-5 overflow-y-auto">

        {/* ─── TOP FILTER BAR & VIEW HEADER ───────────────────────────────────── */}
        <div className="bg-white border border-[#dde1dc] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#dde1dc]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1f4d3a] bg-[#eaf2ed] px-2.5 py-0.5 rounded-md">
                  Active View
                </span>
                <span className="text-xs text-[#5a635d] font-mono">/</span>
                <span className="text-xs font-medium text-[#5a635d]">
                  {navMenuItems.find(i => i.id === activeTab)?.label}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-[#1a1f1c] tracking-tight mt-1">
                {navMenuItems.find(i => i.id === activeTab)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 rounded-lg border border-[#dde1dc] hover:border-[#1f4d3a] bg-white text-[#1f4d3a] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs hover:bg-[#f0f7f3] cursor-pointer"
                title="Copy direct shareable link for this site & view"
              >
                {copiedLinkToast ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Direct URL</span>
                  </>
                )}
              </button>

              {currentRole === 'Admin' && (
                <button
                  onClick={() => {
                    setPurgeScope(selectedStationId !== 'ALL' ? 'station' : 'project');
                    setPurgeStatusScope('all');
                    setPurgeConfirmed(false);
                    setIsPurgeModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 hover:border-rose-400 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  title="Purge / Delete live detections for active station or entire project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge Detections</span>
                </button>
              )}

              {canAccessReports && (
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 hover:border-emerald-600 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  title="Create and customize a formatted bioacoustic research report"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Create Report</span>
                </button>
              )}

              {canAccessReports && (
                <button
                  onClick={downloadDetectionsCSV}
                  className="btn-primary text-xs cursor-pointer"
                  title="Download Live Detections CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Scope Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="filter-label">1. Live Project</label>
              <select className="select-input" value={selectedProjectId} onChange={e => handleProjectChange(e.target.value)}>
                <option value="ALL">All Live Projects ({liveProjects.length})</option>
                {liveProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="filter-label">2. Site Location</label>
              <select className="select-input" value={selectedSiteId} onChange={e => handleSiteChange(e.target.value)}>
                <option value="ALL">All Sites in Project ({availableSites.length})</option>
                {availableSites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="filter-label">3. Hardware Node</label>
              <select className="select-input" value={selectedStationId} onChange={e => setSelectedStationId(e.target.value)}>
                <option value="ALL">All Hardware Nodes ({availableStations.length})</option>
                {availableStations.map((s: any) => (
                  <option key={s.recorder_id || s.id} value={s.recorder_id || s.id}>
                    {s.site_name || s.recorder_id} ({s.recorder_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="filter-label">
                <span>4. Min Confidence</span>
                <span className="slider-val">{formatPercent(minConfidence)}</span>
              </label>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={minConfidence}
                  onChange={e => setMinConfidence(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── TAB 1: SUMMARY / OVERVIEW ──────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            {/* 4 KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#dde1dc] shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5a635d]">Active Field Nodes</span>
                  <div className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1f1c] mt-1">
                    {activeNodesCount} {activeNodesCount === 1 ? 'Node' : 'Nodes'}
                  </div>
                  <p className={`text-[11px] font-semibold mt-0.5 ${activeNodesCount > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {activeNodesCount > 0 ? 'Online stream daemon' : 'All Nodes Offline (>5m)'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#f0f7f3] border border-[#dde1dc] text-[#1f4d3a] flex items-center justify-center">
                  <Radio className={`w-5 h-5 ${activeNodesCount > 0 ? 'animate-pulse' : ''}`} />
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#dde1dc] shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5a635d]">Live Detections</span>
                  <div className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1f1c] mt-1">{totalDetections.toLocaleString()}</div>
                  <p className="text-[11px] text-[#5a635d] font-medium mt-0.5">Realtime call events</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#f0f7f3] border border-[#dde1dc] text-[#1f4d3a] flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#dde1dc] shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5a635d]">Identified Taxa</span>
                  <div className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1f1c] mt-1">{uniqueSpecies} Species</div>
                  <p className="text-[11px] text-[#5a635d] font-medium mt-0.5">Unique bird species</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#f0f7f3] border border-[#dde1dc] text-[#1f4d3a] flex items-center justify-center">
                  <Bird className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#dde1dc] shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5a635d]">Classifier Model</span>
                  <div className="text-2xl sm:text-3xl font-bold font-serif text-[#1a1f1c] mt-1">BirdNET-Pi</div>
                  <p className="text-[11px] text-[#5a635d] font-medium mt-0.5">v2.4 CNN Model</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#f0f7f3] border border-[#dde1dc] text-[#1f4d3a] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Relative Species Abundance Card */}
            <div className="dashboard-section">
              <div className="section-header">
                <div>
                  <h2 className="flex items-center gap-2">
                    <Bird className="w-4 h-4 text-[#1f4d3a]" />
                    Relative Species Abundance
                  </h2>
                  <p>Top ranked species call frequency distribution across live recorders.</p>
                </div>
              </div>
              <TopSpeciesChart data={topSpeciesData} />
            </div>
          </div>
        )}

        {/* ─── TAB 2: SPATIAL MAP ──────────────────────────────────────────────── */}
        {activeTab === 'map' && (() => {
          const activeStation = availableStations.find((s: any) => s.recorder_id === selectedStationId) || 
                                availableStations.find((s: any) => s.status === 'online') || 
                                availableStations[0];
          const primaryLat = Number(activeStation?.lat ?? activeStation?.latitude ?? 13.6288);
          const primaryLong = Number(activeStation?.long ?? activeStation?.longitude ?? 79.4192);
          const mapCenter: [number, number] = [primaryLat, primaryLong];

          return (
            <div className="dashboard-section space-y-4">
              <div className="section-header">
                <div>
                  <h2 className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#1f4d3a]" />
                    Survey Site Map &amp; Node GPS Coordinates
                  </h2>
                  <p>Physical monitoring station locations and active hardware nodes in the landscape.</p>
                </div>
              </div>

              {/* Station Coordinates & BirdNET Geographic Scope Banner */}
              <div className="p-4 rounded-xl bg-[#f0f7f3] border border-[#dde1dc] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-sm text-[#1a1f1c]">
                      {activeStation?.site_name || activeStation?.recorder_id || 'Tirupati (Test_01)'}
                    </span>
                    <span className="font-mono text-[11px] bg-white text-[#1f4d3a] border border-[#dde1dc] px-2 py-0.5 rounded font-semibold">
                      {activeStation?.recorder_id || 'Test_01'}
                    </span>
                  </div>
                  <div className="text-xs text-[#5a635d]">
                    Project: <strong className="text-[#1a1f1c]">{activeStation?.project_name || 'Test_custom'}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="bg-white border border-[#dde1dc] px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-2xs">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <div>
                      <span className="text-[10px] text-[#5a635d] uppercase block font-mono">GPS Coordinates</span>
                      <strong className="font-mono text-[#1a1f1c]">
                        {primaryLat.toFixed(4)}° N, {primaryLong.toFixed(4)}° E
                      </strong>
                    </div>
                  </div>

                  <div className="bg-white border border-[#dde1dc] px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-2xs">
                    <Bird className="w-3.5 h-3.5 text-[#1f4d3a]" />
                    <div>
                      <span className="text-[10px] text-[#5a635d] uppercase block font-mono">BirdNET Filter</span>
                      <strong className="text-emerald-700 font-semibold">Restricted by GPS</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-[540px] w-full rounded-xl overflow-hidden border border-[#dde1dc]">
                <LantanaMap
                  sites={availableStations.map((s: any) => ({
                    id: s.id || s.recorder_id,
                    name: s.site_name || s.recorder_id,
                    site_group: s.site_name || s.recorder_id,
                    recorder_id: s.recorder_id || s.id || 'Node',
                    lat: Number(s.lat ?? s.latitude ?? 13.6288),
                    lng: Number(s.long ?? s.longitude ?? 79.4192),
                    detectionsCount: filteredDetections.filter(d => d.recorder_id === s.recorder_id || d.station_id === s.id).length,
                    speciesCount: new Set(filteredDetections.filter(d => d.recorder_id === s.recorder_id || d.station_id === s.id).map(d => d.common_name)).size,
                    color: s.status === 'online' ? '#1f4d3a' : '#943a29'
                  }))}
                  center={mapCenter}
                  zoom={12}
                  projectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
                  selectedSiteId={selectedSiteId !== 'ALL' ? selectedSiteId : (selectedStationId !== 'ALL' ? selectedStationId : undefined)}
                  onSelectSite={(_siteName: string, siteId: string) => {
                    setSelectedStationId(siteId);
                  }}
                />
              </div>
            </div>
          );
        })()}

        {/* ─── TAB 3: SPECIES ACCUMULATION CURVE (WEEKLY / MONTHLY / YEARLY) ──── */}
        {activeTab === 'accumulation' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Species Accumulation Curve</h2>
                <p>Cumulative unique species discovery trajectory over multi-day survey periods.</p>
              </div>

              {/* Interval Toggle */}
              <div className="flex items-center bg-[#f0f7f3] border border-[#dde1dc] rounded-lg p-0.5 shadow-xs">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => setAccumulationInterval(interval)}
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all capitalize ${
                      accumulationInterval === interval
                        ? 'bg-[#1f4d3a] text-white shadow-xs'
                        : 'text-[#5a635d] hover:text-[#1a1f1c]'
                    }`}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Year and Select Month Below Header */}
            <div className="flex items-center gap-4 pt-0.5 pb-1 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#5a635d] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#1f4d3a]" />
                  <span>Select Year:</span>
                </label>
                <select
                  value={accumulationYear}
                  onChange={e => setAccumulationYear(e.target.value)}
                  className="select-input text-xs font-semibold !w-auto min-w-[100px] max-w-[120px] h-[32px] !py-1 !px-2.5"
                >
                  <option value="ALL">All Years</option>
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#5a635d]">
                  <span>Select Month:</span>
                </label>
                <select
                  value={accumulationMonth}
                  onChange={e => setAccumulationMonth(e.target.value)}
                  className="select-input text-xs font-semibold !w-auto min-w-[120px] max-w-[140px] h-[32px] !py-1 !px-2.5"
                >
                  {MONTH_NAMES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <AccumulationChart data={accumulationData} />
          </div>
        )}

        {/* ─── TAB 4: DIURNAL ACTIVITY PATTERN (BOTH 24H & RADIAL CLOCK) ───────── */}
        {activeTab === 'diurnal' && (
          <div className="space-y-5">
            {/* Header & Calendar Date Picker */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#dde1dc] rounded-xl">
              <div>
                <h3 className="text-base font-bold font-serif text-[#1a1f1c]">Diurnal Vocalization Rhythms</h3>
                <p className="text-xs text-[#5a635d]">Inspect 24-hour daily call cycles and circular polar clock distributions.</p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#5a635d] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#1f4d3a]" />
                  <span>Select Date:</span>
                </label>
                <input
                  type="date"
                  value={diurnalFilterDate}
                  min={availableDatesList.length > 0 ? availableDatesList[availableDatesList.length - 1] : undefined}
                  max={availableDatesList.length > 0 ? availableDatesList[0] : undefined}
                  onChange={e => setDiurnalFilterDate(e.target.value)}
                  className="select-input text-xs font-mono font-medium cursor-pointer !w-auto min-w-[140px] h-[32px] !py-1 !px-2.5"
                />
                {diurnalFilterDate && (
                  <button
                    type="button"
                    onClick={() => setDiurnalFilterDate('')}
                    className="text-xs text-[#1f4d3a] hover:underline font-semibold cursor-pointer ml-1"
                    title="Clear filter to show all days combined"
                  >
                    All Days
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Chart 1: 24-Hour Bar Chart */}
            <div className="dashboard-section">
              <div className="section-header">
                <div>
                  <h2 className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#1f4d3a]" />
                    Live Diurnal Activity Pattern (24 Hours)
                  </h2>
                  <p>Hourly vocalization call volume (00:00 to 23:00).</p>
                </div>
              </div>
              <DiurnalChart data={hourlyData} />
            </div>

            {/* Sub-Chart 2: 24-Hour Radial Clock / Polar Chart */}
            <div className="dashboard-section">
              <div className="section-header">
                <div>
                  <h2 className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#1f4d3a]" />
                    Live Diurnal Activity Pattern (24-Hour Radial Clock - Total)
                  </h2>
                  <p>Circular polar distribution of total vocal detections per hour (12am to 11pm).</p>
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-[#eaf2ed] text-[#1f4d3a] border border-[#dde1dc]">
                  ⚡ Live Daily Updated
                </span>
              </div>
              <PolarDiurnalChart hourlyData={hourlyData} totalDetections={totalDetections} />
            </div>
          </div>
        )}

        {/* ─── TAB 5: LIVE AUDIO & REALTIME DETECTIONS FEED ───────────────────── */}
        {activeTab === 'live' && (
          <div className="space-y-5">
            {/* 1. Header & Live Status Strip */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-white border border-[#dde1dc] rounded-2xl shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Live Stream Connected
                  </span>
                  <span className="text-xs text-[#5a635d] font-mono">• 48 kHz / 64 kbps Opus</span>
                </div>
                <h2 className="text-xl font-bold font-serif text-[#1a1f1c] mt-1 flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-600" />
                  Live Field Audio &amp; Realtime Detections
                </h2>
                <p className="text-xs text-[#5a635d] mt-0.5">
                  Direct acoustic stream and live classification events streaming from your edge sensor nodes.
                </p>
              </div>

              {/* Station Node Selector & Quick Diagnostic */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-[#f0f7f3] border border-[#dde1dc] rounded-xl px-3 py-1.5 shadow-2xs">
                  <Cpu className="w-3.5 h-3.5 text-[#1f4d3a]" />
                  <span className="text-xs font-semibold text-[#5a635d]">Listening to:</span>
                  <select
                    value={selectedStreamNode}
                    onChange={(e) => {
                      setSelectedStreamNode(e.target.value);
                      setIsLiveAudioPlaying(false);
                    }}
                    className="bg-transparent text-xs font-bold text-[#1f4d3a] border-none focus:outline-none cursor-pointer"
                  >
                    {availableStations.map((s: any) => (
                      <option key={s.recorder_id || s.id} value={s.recorder_id || s.id}>
                        {s.site_name ? `${s.site_name} (${s.recorder_id || s.id})` : (s.recorder_id || s.id)}
                      </option>
                    ))}
                    {availableStations.length === 0 && (
                      <option value="Test_01">Test_01 (Live)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Live Telemetry Diagnostic Cards */}
            {(() => {
              const activeTel = telemetryMap[selectedStreamNode] || telemetryMap['Test_01'] || null;
              const cpuVal = activeTel?.cpu_temp_c ?? activeTel?.cpu_temperature ?? null;
              const battVal = activeTel?.battery_capacity_percent ?? activeTel?.battery_level ?? null;
              const voltVal = activeTel?.battery_voltage_v ?? null;
              const diskVal = activeTel?.disk_free_gb ?? null;
              const isCool = cpuVal != null ? cpuVal < 60 : true;

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-white border border-[#dde1dc] rounded-xl shadow-2xs space-y-1">
                    <span className="text-[10px] font-mono text-[#5a635d] uppercase flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-[#1f4d3a]" /> Edge Station
                    </span>
                    <div className="text-sm font-bold font-mono text-[#1a1f1c] truncate">{selectedStreamNode || 'Test_01'}</div>
                    <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      {activeTel ? 'Online • Ingesting' : 'Connected'}
                    </div>
                  </div>

                  <div className="p-3.5 bg-white border border-[#dde1dc] rounded-xl shadow-2xs space-y-1">
                    <span className="text-[10px] font-mono text-[#5a635d] uppercase flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-500" /> Solar / Battery
                    </span>
                    <div className="text-sm font-bold font-mono text-[#1a1f1c]">
                      {battVal != null ? `${Math.round(battVal)}%` : '--'}{voltVal != null ? ` • ${voltVal.toFixed(2)}V` : ''}
                    </div>
                    <div className="text-[10px] text-[#5a635d] truncate">
                      {activeTel?.power_status || (battVal != null ? 'Active Power Supply' : 'Awaiting Telemetry')}
                    </div>
                  </div>

                  <div className="p-3.5 bg-white border border-[#dde1dc] rounded-xl shadow-2xs space-y-1">
                    <span className="text-[10px] font-mono text-[#5a635d] uppercase flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-[#1f4d3a]" /> CPU Temperature
                    </span>
                    <div className="text-sm font-bold font-mono text-[#1a1f1c]">
                      {cpuVal != null ? `${cpuVal.toFixed(1)} °C` : '--'}
                    </div>
                    <div className={`text-[10px] font-semibold ${isCool ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {cpuVal != null ? (isCool ? 'Cool & Nominal' : 'Warm') : 'Awaiting Sensor'}
                    </div>
                  </div>

                  <div className="p-3.5 bg-white border border-[#dde1dc] rounded-xl shadow-2xs space-y-1">
                    <span className="text-[10px] font-mono text-[#5a635d] uppercase flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-[#1f4d3a]" /> Storage Free
                    </span>
                    <div className="text-sm font-bold font-mono text-[#1a1f1c]">
                      {diskVal != null ? `${diskVal.toFixed(1)} GB Free` : '--'}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold">
                      {activeTel?.disk_percent_free != null ? `${Math.round(activeTel.disk_percent_free)}% Available` : (diskVal != null ? 'MicroSD Storage' : 'Awaiting Storage')}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Hidden HTML Audio Element always available in DOM */}
            <audio
              ref={liveAudioElementRef}
              crossOrigin="anonymous"
              onError={() => {
                console.warn('Live audio playback error. Checking direct stream URL...');
                setLiveStreamError(`Cannot reach audio stream at "${directStreamUrl}". If accessing from cloud (Render), browsers cannot connect directly to local edge devices without a tunnel or local LAN.`);
              }}
            />

            {/* 2. MASTER LIVE AUDIO PLAYER BANNER - ON DEMAND & RBAC PROTECTED */}
            {!canAccessLiveStream ? (
              <div className="p-6 rounded-2xl bg-[#f8faf8] border border-[#dde1dc] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>RESTRICTED ACCESS: LIVE EDGE AUDIO &amp; SPECTROGRAM</span>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-[#1a1f1c]">
                    Observatory Manager &amp; Admin Access Required
                  </h3>
                  <p className="text-xs text-[#5a635d] max-w-xl leading-relaxed">
                    Direct real-time microphone acoustic streaming and edge spectrogram visualization are reserved for authenticated Project Managers, Site Managers, and System Administrators. Public observers can monitor incoming species classifications and detection feeds below.
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#dde1dc] text-[#5a635d] text-xs font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1f4d3a]" />
                    Current Role: {currentRole}
                  </span>
                </div>
              </div>
            ) : !isLiveStreamActive ? (
              /* Standby Card with activation trigger */
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0e271d] via-[#163c2c] to-[#0a1e16] p-6 text-white shadow-md border border-[#1f4d3a] flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-white/10 text-emerald-300 border border-white/20">
                      Standby Mode
                    </span>
                    <span className="text-xs font-mono text-emerald-200/80">
                      Edge Stream Disconnected (Conserving Bandwidth &amp; Pi Compute)
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-serif text-white">
                      Live Edge Audio &amp; Real-Time Spectrogram
                    </h3>
                    <p className="text-xs text-white/70 max-w-xl mt-1 leading-relaxed">
                      Connect to {selectedStreamNode} to listen to the live acoustic feed on port 8888 and visualize real-time avian frequency spectrums. Stream will immediately disconnect when turned off.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <button
                    onClick={handleOpenAndStartLiveStream}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0a1e16] font-bold text-xs flex items-center gap-2.5 transition-all shadow-md cursor-pointer hover:shadow-lg"
                  >
                    <Radio className="w-4 h-4 text-[#0a1e16] animate-pulse" />
                    <span>Connect Live Audio &amp; Spectrogram Stream</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Active Stream View with Live Acoustic Waterfall Spectrogram */
              <div className="space-y-4">
                <RavenProLiveSpectrogram
                  audioElement={liveAudioElementRef.current}
                  isPlaying={isLiveAudioPlaying}
                  onTogglePlay={handleToggleLiveAudio}
                  streamUrl={directStreamUrl}
                  onStreamUrlChange={handleStreamUrlChange}
                  stationName={selectedStreamNode}
                  stationIp={telemetryMap[selectedStreamNode]?.ip_address || telemetryMap['Test_01']?.ip_address}
                  detections={liveTabDetections.map((d: any) => ({
                    id: d.id,
                    common_name: d.common_name,
                    scientific_name: d.scientific_name,
                    confidence: d.confidence || 0,
                    timestamp: d.timestamp,
                    low_freq: d.low_freq || 1800,
                    high_freq: d.high_freq || 7200,
                    audio_url: d.audio_url,
                    verification_status: d.verification_status
                  }))}
                  onPlayDetectionClip={handlePlayDetectionClipFromSpectrogram}
                  onCloseStream={handleCloseLiveStream}
                  errorMessage={liveStreamError}
                />
              </div>
            )}

            {/* 3. REALTIME BIOACOUSTIC DETECTIONS STREAM */}
            <div className="dashboard-section space-y-4">
              <div className="section-header">
                <div>
                  <h2 className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                    Realtime Species Detections Stream
                  </h2>
                  <p>
                    {isLiveStreamActive
                      ? `Classification events ingested live from ${selectedStreamNode}. Session resets on disconnect.`
                      : `Live stream disconnected. Click "Connect Live Audio" above to start a live session.`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Session / History Feed Toggle */}
                  <div className="inline-flex rounded-lg bg-[#f0f7f3] p-0.5 border border-[#dde1dc] text-xs">
                    <button
                      type="button"
                      onClick={() => setLiveFeedFilter('session')}
                      className={`px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        liveFeedFilter === 'session'
                          ? 'bg-[#1f4d3a] text-white shadow-2xs'
                          : 'text-[#5a635d] hover:text-[#1a1f1c]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isLiveStreamActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                      <span>Live Session ({liveTabDetections.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLiveFeedFilter('all')}
                      className={`px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        liveFeedFilter === 'all'
                          ? 'bg-[#1f4d3a] text-white shadow-2xs'
                          : 'text-[#5a635d] hover:text-[#1a1f1c]'
                      }`}
                      title="View all permanent detections saved in the database"
                    >
                      <span>All Saved History ({filteredDetections.length})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Detections Filter & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#fafbfa] border border-[#dde1dc] rounded-xl">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-[#5a635d] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search detected bird species..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#dde1dc] rounded-lg focus:outline-none focus:border-[#1f4d3a]"
                  />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2 text-xs text-[#5a635d]">
                    <span>Min Confidence:</span>
                    <input
                      type="range"
                      min="0.10"
                      max="0.95"
                      step="0.05"
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                      className="w-24 accent-[#1f4d3a] h-1.5 cursor-pointer"
                    />
                    <span className="font-mono font-bold text-[#1f4d3a] w-9">
                      {Math.round(minConfidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Detections / Live Audio Streams List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[650px] overflow-y-auto pr-1">
                {liveTabDetections.length === 0 ? (
                  <div className="col-span-2 py-16 text-center text-xs text-[#5a635d] space-y-2 bg-white border border-[#dde1dc] rounded-xl">
                    <Bird className="w-8 h-8 text-[#5a635d]/40 mx-auto" />
                    <p className="font-semibold text-sm text-[#1a1f1c]">
                      {isLiveStreamActive ? 'Listening for live avian calls...' : 'Stream Disconnected (Session Reset)'}
                    </p>
                    <p className="text-xs text-[#5a635d]/80 max-w-md mx-auto">
                      {isLiveStreamActive 
                        ? `The edge AI is actively monitoring ${selectedStreamNode}. Avian classifications will appear here live as they vocalize.`
                        : 'Connect to the live stream to monitor incoming species calls in real time. (All historical detections remain safely preserved in the database).'}
                    </p>
                  </div>
                ) : (
                  liveTabDetections.map((det) => {
                    const isHigh = (det.confidence || 0) >= 0.8;
                    const isMed = (det.confidence || 0) >= 0.65;
                    const isRecent = det.timestamp && (Date.now() - new Date(det.timestamp).getTime()) < 60000;

                    return (
                      <div
                        key={det.id}
                        className={`p-4 bg-white border rounded-xl flex items-center justify-between transition-all shadow-2xs hover:border-[#1f4d3a] ${
                          isRecent ? 'border-emerald-500/80 bg-emerald-50/20' : 'border-[#dde1dc]'
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#1a1f1c] truncate">{det.common_name}</span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                              isHigh
                                ? 'bg-emerald-100 text-emerald-800'
                                : isMed
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {formatPercent(det.confidence || 0)}
                            </span>
                            {isRecent && (
                              <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white animate-pulse">
                                NEW
                              </span>
                            )}
                          </div>

                          <div className="text-xs italic text-[#5a635d] truncate">{det.scientific_name}</div>

                          <div className="text-[10px] font-mono text-[#5a635d] flex items-center gap-2 flex-wrap">
                            <span className="text-[#1f4d3a] font-semibold">{det.recorder_id || det.station_name || 'Node'}</span>
                            <span>&bull;</span>
                            <span>{det.timestamp ? new Date(det.timestamp).toLocaleTimeString() : 'Just now'}</span>
                            {det.date_str && (
                              <>
                                <span>&bull;</span>
                                <span>{det.date_str}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setSelectedDetection(det)}
                            className="p-2.5 rounded-xl bg-[#f0f7f3] hover:bg-[#1f4d3a] text-[#1f4d3a] hover:text-white transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                            title="Play detection audio clip & inspect spectrogram"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span className="hidden sm:inline">Play Clip</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: ACOUSTIC WATCHDOG & ACTIVE LEARNING TRIAGE ────────────────── */}
        {activeTab === 'triage' && (
          <div className="dashboard-section space-y-5">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Acoustic Watchdog Triage &amp; Discrepancy Stream
                </h2>
                <p>
                  The classical DSP engine analyzes each 3-second audio window for physical energy, vocalization blobs, and frequency band distribution. Windows with discrepancies (e.g. vocal sounds present but missed by AI models) are curated here for human review.
                </p>
              </div>

              {/* Triage Count Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#1f4d3a] bg-[#f0f7f3] px-3 py-1.5 rounded-lg border border-[#dde1dc]">
                  {filteredTriageWindows.length} Windows
                </span>
                {unreviewedTriageCount > 0 && (
                  <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    {unreviewedTriageCount} Unreviewed
                  </span>
                )}
              </div>
            </div>

            {/* Quick KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-[#fafbfa] border border-[#dde1dc] rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-[#5a635d] uppercase">Flagged Discrepancies</span>
                <div className="text-xl font-bold font-serif text-[#1a1f1c]">{filteredTriageWindows.length}</div>
                <div className="text-[10px] text-[#5a635d]">Windows captured by edge DSP</div>
              </div>

              <div className="p-3.5 bg-[#fafbfa] border border-[#dde1dc] rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-amber-700 uppercase">Awaiting Triage</span>
                <div className="text-xl font-bold font-serif text-amber-800">
                  {filteredTriageWindows.filter(w => w.review_status === 'unreviewed').length}
                </div>
                <div className="text-[10px] text-[#5a635d]">Pending human verification</div>
              </div>

              <div className="p-3.5 bg-[#fafbfa] border border-[#dde1dc] rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-rose-700 uppercase">Missed Calls (Under-detected)</span>
                <div className="text-xl font-bold font-serif text-rose-800">
                  {filteredTriageWindows.filter(w => w.review_flags.includes('UNDER_DETECTED')).length}
                </div>
                <div className="text-[10px] text-[#5a635d]">Acoustic blob with 0 AI species</div>
              </div>

              <div className="p-3.5 bg-[#fafbfa] border border-[#dde1dc] rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-emerald-700 uppercase">Confirmed / Corrected</span>
                <div className="text-xl font-bold font-serif text-emerald-800">
                  {filteredTriageWindows.filter(w => w.review_status === 'confirmed' || w.review_status === 'corrected').length}
                </div>
                <div className="text-[10px] text-[#5a635d]">Validated active learning data</div>
              </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#f5f6f4] rounded-xl border border-[#dde1dc]">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-[#5a635d] flex items-center gap-1.5 mr-1">
                  <Filter className="w-3.5 h-3.5" /> Filters:
                </label>

                <select
                  value={triageFilterFlag}
                  onChange={(e) => setTriageFilterFlag(e.target.value)}
                  className="bg-white border border-[#dde1dc] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1a1f1c]"
                >
                  <option value="ALL">All Discrepancy Flags</option>
                  <option value="UNDER_DETECTED">UNDER_DETECTED (Sound Missed)</option>
                  <option value="MODEL_DISAGREEMENT">MODEL_DISAGREEMENT</option>
                  <option value="BAND_MISMATCH">BAND_MISMATCH (Low Frequency / Herps)</option>
                  <option value="POSSIBLE_OVERLAP">POSSIBLE_OVERLAP (Dense Chorus)</option>
                </select>

                <select
                  value={triageFilterStatus}
                  onChange={(e) => setTriageFilterStatus(e.target.value)}
                  className="bg-white border border-[#dde1dc] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1a1f1c]"
                >
                  <option value="all">All Review Statuses</option>
                  <option value="unreviewed">Unreviewed Only</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="corrected">Corrected</option>
                  <option value="discarded">Discarded Noise</option>
                </select>
              </div>

              <div className="text-xs text-[#5a635d]">
                Showing {filteredTriageWindows.length} of {windowSummaries.length} total windows
              </div>
            </div>

            {/* Triage Cards Stream */}
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {filteredTriageWindows.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-white border border-[#dde1dc] space-y-2">
                  <Activity className="w-8 h-8 text-[#5a635d] mx-auto opacity-40 mb-1" />
                  <p className="font-serif font-bold text-sm text-[#1a1f1c]">No Discrepancy Windows Found</p>
                  <p className="text-xs text-[#5a635d] max-w-md mx-auto">
                    No audio windows matching current filters. When the edge watchdog detects physical vocalization energy that deviates from neural predictions, clips will stream here for review.
                  </p>
                </div>
              ) : (
                filteredTriageWindows.map((win) => {
                  const isPlaying = playingClipPath === win.clip_path;

                  return (
                    <div
                      key={win.window_id}
                      className="p-4 rounded-xl bg-white border border-[#dde1dc] space-y-3 text-xs shadow-2xs hover:border-[#1f4d3a]/50 transition-colors"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0f2ef] pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            onClick={() => handlePlayTriageClip(win.clip_path)}
                            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition text-xs ${
                              isPlaying
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#1f4d3a] hover:bg-[#16382a] text-white'
                            }`}
                            title="Play 3s deduplicated Opus clip"
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                            <span>{isPlaying ? 'Playing...' : '3s Audio Clip'}</span>
                          </button>

                          <strong className="font-mono text-xs text-[#1a1f1c]">{win.window_id}</strong>
                          <span className="font-mono text-[11px] bg-[#f5f6f4] px-2 py-0.5 rounded text-[#1f4d3a] border border-[#dde1dc]">
                            Node: {win.node_id}
                          </span>
                          <span className="font-mono text-[11px] text-[#5a635d]">
                            {win.timestamp ? new Date(win.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Recent'}
                          </span>
                        </div>

                        {/* Discrepancy Badges & Status */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {win.review_flags.map((flag) => (
                            <span
                              key={flag}
                              className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                flag === 'UNDER_DETECTED'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : flag === 'MODEL_DISAGREEMENT'
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                  : flag === 'BAND_MISMATCH'
                                  ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                                  : 'bg-rose-100 text-rose-900 border-rose-300'
                              }`}
                            >
                              {flag}
                            </span>
                          ))}
                          <span
                            className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                              win.review_status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : win.review_status === 'corrected'
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                : win.review_status === 'discarded'
                                ? 'bg-gray-100 text-gray-700 border-gray-300'
                                : 'bg-yellow-50 text-yellow-800 border-yellow-300'
                            }`}
                          >
                            {win.review_status}
                          </span>
                        </div>
                      </div>

                      {/* Physical DSP Metrics vs Multi-Model Detection */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-[#fafbfa] border border-[#dde1dc]/80 font-mono text-[11px]">
                        <div>
                          <span className="text-[#5a635d] text-[10px] block">Acoustic Event Blobs</span>
                          <strong className="text-[#1a1f1c] font-bold">{win.event_count} Blobs</strong>
                        </div>
                        <div>
                          <span className="text-[#5a635d] text-[10px] block">Occupied Area Ratio</span>
                          <strong className="text-[#1a1f1c] font-bold">{(win.occupied_area_ratio * 100).toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-[#5a635d] text-[10px] block">Frequency Bands</span>
                          <span className="text-[#1a1f1c] font-bold">
                            Low {(win.low_band_energy * 100).toFixed(0)}% / Mid {(win.mid_band_energy * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5a635d] text-[10px] block">AI Species Detected</span>
                          <strong className="text-emerald-800 font-bold truncate block">
                            {win.species_detected && win.species_detected.length > 0 
                              ? win.species_detected.join(', ') 
                              : '0 Species (Missed Call!)'}
                          </strong>
                        </div>
                      </div>

                      {/* Explanation Hint & Review Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="text-[11px] text-[#5a635d]">
                          {win.review_flags.includes('UNDER_DETECTED') && (
                            <span className="flex items-center gap-1.5 text-amber-800">
                              <span>💡</span>
                              <span>Acoustic energy present but AI reported 0 species. Check for amphibians, mammals, or novel vocalizations.</span>
                            </span>
                          )}
                          {win.review_flags.includes('BAND_MISMATCH') && (
                            <span className="flex items-center gap-1.5 text-cyan-800">
                              <span>🐸</span>
                              <span>Energy concentrated in low frequencies (&lt;1.5 kHz). Likely anuran, insect, or mammal vocalization.</span>
                            </span>
                          )}
                          {win.review_flags.includes('MODEL_DISAGREEMENT') && (
                            <span className="flex items-center gap-1.5 text-indigo-800">
                              <span>⚖️</span>
                              <span>Models disagree on species identity. Listen to audio clip to resolve classification.</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => handleUpdateTriageStatus(win.window_id, 'confirmed')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px] transition cursor-pointer"
                          >
                            Confirm Detection
                          </button>
                          <button
                            onClick={() => handleUpdateTriageStatus(win.window_id, 'corrected')}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold text-[11px] transition cursor-pointer"
                          >
                            Correct Species
                          </button>
                          <button
                            onClick={() => handleUpdateTriageStatus(win.window_id, 'discarded')}
                            className="px-2.5 py-1 rounded-lg bg-[#f5f6f4] hover:bg-[#e8eae6] text-[#5a635d] border border-[#dde1dc] font-semibold text-[11px] transition cursor-pointer"
                          >
                            Discard Noise
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 7: STATIONS & NODES ────────────────────────────────────────── */}
        {activeTab === 'stations' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#1f4d3a]" />
                  Field Recorder Nodes &amp; Hardware Telemetry
                </h2>
                <p>Autonomous Raspberry Pi edge sensor nodes, real-time solar powerbank &amp; thermal diagnostics, and live audio streams.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableStations.length === 0 ? (
                <div className="col-span-3 py-12 text-center text-xs text-[#5a635d]">
                  No recorder nodes found in the selected project scope.
                </div>
              ) : (
                availableStations.map((stn: any) => {
                  const isOnline = stn.status === 'online' || true;
                  const tel = telemetryMap[stn.recorder_id] || telemetryMap[stn.id] || telemetryMap[stn.station_id] || null;
                  const hasTel = !!tel;
                  const cpuTemp = tel?.cpu_temp_c ?? tel?.cpu_temperature ?? (stn.cpu_temperature != null ? Number(stn.cpu_temperature) : null);
                  const diskFree = tel?.disk_free_gb ?? null;
                  const diskPercent = tel?.disk_percent_free ?? (tel?.disk_usage != null ? 100 - Number(tel.disk_usage) : (stn.storage_used_percent != null ? 100 - Number(stn.storage_used_percent) : null));
                  const batteryVolt = tel?.battery_voltage_v ?? null;
                  const powerStatus = tel?.power_status || (tel?.battery_capacity_percent != null ? `Battery ${Math.round(tel.battery_capacity_percent)}%` : (stn.battery_level != null ? `Battery ${stn.battery_level}%` : 'Awaiting Telemetry'));
                  const hasUnderVoltage = tel?.under_voltage_flag;

                  return (
                    <div
                      key={stn.recorder_id || stn.id}
                      className="p-5 bg-white border border-[#dde1dc] rounded-2xl shadow-xs space-y-4 hover:border-[#1f4d3a] transition-all"
                    >
                      <div className="flex items-start justify-between border-b border-[#dde1dc] pb-3">
                        <div>
                          <h3 className="font-bold text-sm text-[#1a1f1c] flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                            {stn.site_name || stn.recorder_id}
                          </h3>
                          <div className="text-[11px] font-mono text-[#5a635d] mt-0.5">
                            {stn.recorder_id} {stn.project_name && <>&bull; <span className="text-[#1f4d3a]">{stn.project_name}</span></>}
                          </div>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase border ${
                          isOnline ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {isOnline ? '● Online' : 'Offline'}
                        </span>
                      </div>

                      {/* Solar Warning if dipped */}
                      {hasUnderVoltage && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span>Solar dip detected (&lt;4.63V). Continuous edge inference maintained.</span>
                        </div>
                      )}

                      {/* Hardware Diagnostics Grid */}
                      <div className="grid grid-cols-2 gap-2.5 text-[11px] font-mono">
                        <div className="p-2.5 rounded-xl bg-[#f9faf8] border border-[#dde1dc]/80">
                          <span className="text-[#5a635d] text-[10px] block flex items-center gap-1">
                            <Sun className="w-3 h-3 text-amber-500" /> SOLAR / VOLTS
                          </span>
                          <strong className="text-[#1a1f1c]">{batteryVolt != null ? `${batteryVolt.toFixed(2)} V` : (stn.battery_level != null ? `${stn.battery_level}%` : '--')}</strong>
                          <div className="text-[10px] text-emerald-700 font-semibold truncate" title={powerStatus}>
                            {powerStatus}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#f9faf8] border border-[#dde1dc]/80">
                          <span className="text-[#5a635d] text-[10px] block flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-[#1f4d3a]" /> CPU TEMP
                          </span>
                          <strong className="text-[#1a1f1c]">{cpuTemp != null ? `${cpuTemp.toFixed(1)} °C` : '--'}</strong>
                          <div className={`text-[10px] font-semibold ${cpuTemp != null && cpuTemp < 60 ? 'text-emerald-700' : 'text-[#5a635d]'}`}>
                            {cpuTemp != null ? (cpuTemp < 60 ? 'Cool & Stable' : 'Warm') : 'Nominal'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#f9faf8] border border-[#dde1dc]/80">
                          <span className="text-[#5a635d] text-[10px] block flex items-center gap-1">
                            <HardDrive className="w-3 h-3 text-[#1f4d3a]" /> SD STORAGE
                          </span>
                          <strong className="text-[#1a1f1c]">{diskFree != null ? `${diskFree.toFixed(1)} GB` : (diskPercent != null ? `${diskPercent.toFixed(0)}% Free` : '--')}</strong>
                          <div className="text-[10px] text-[#1f4d3a] font-semibold">
                            {diskPercent != null ? `${diskPercent.toFixed(0)}% Free` : 'Mounted'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#f9faf8] border border-[#dde1dc]/80">
                          <span className="text-[#5a635d] text-[10px] block flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#1f4d3a]" /> LAST PING
                          </span>
                          <strong className="text-[#1a1f1c]">{stn.last_ping ? new Date(stn.last_ping).toLocaleTimeString() : 'Recent'}</strong>
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            {isOnline ? 'Active Stream' : 'Standby'}
                          </div>
                        </div>
                      </div>

                      {/* Live Audio Stream Link */}
                      <div className="pt-2 border-t border-[#dde1dc] flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-[#5a635d] bg-[#f5f6f4] px-2 py-0.5 rounded">
                          Multi-Model ONNX + DSP
                        </span>

                        <button
                          onClick={() => {
                            setSelectedStreamNode(stn.recorder_id || 'Test_01');
                            setActiveTab('live');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#1f4d3a] hover:bg-[#163a2b] text-white text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                        >
                          <Radio className="w-3.5 h-3.5 animate-pulse" />
                          <span>Listen Live Audio &amp; Detections</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 7: SPECIES CATALOGUE ───────────────────────────────────────── */}
        {activeTab === 'species' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <Bird className="w-4 h-4 text-[#1f4d3a]" />
                  Avian Species Catalogue &amp; Ecological Library
                </h2>
                <p>Taxonomic records, call totals, conservation status, and ecological factors for detected species.</p>
              </div>

              {/* Search & Sort Bar */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#5a635d] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search species..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="select-input text-xs pl-8 !w-auto min-w-[160px] h-[32px] !py-1"
                  />
                </div>

                <select
                  value={catalogSort}
                  onChange={e => setCatalogSort(e.target.value as any)}
                  className="select-input text-xs font-semibold !w-auto min-w-[120px] h-[32px] !py-1 !px-2"
                >
                  <option value="detections">Most Detections</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                  <option value="iucn">IUCN Status</option>
                </select>
              </div>
            </div>

            {/* Species Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[640px] overflow-y-auto pr-1">
              {(() => {
                const uniqueNames = Array.from(new Set(filteredDetections.map(d => d.common_name).filter(Boolean)));
                
                let list = uniqueNames.map(spName => {
                  const spDetections = filteredDetections.filter(d => d.common_name === spName);
                  const sample = spDetections[0];
                  const eco = speciesEcologyMap[spName.toLowerCase().trim()] || speciesEcologyMap[spName.trim()] || {};
                  return {
                    spName,
                    count: spDetections.length,
                    sample,
                    eco,
                    avgConf: spDetections.reduce((a, b) => a + (b.confidence || 0), 0) / spDetections.length
                  };
                });

                if (catalogSearch.trim()) {
                  const q = catalogSearch.toLowerCase().trim();
                  list = list.filter(item => 
                    item.spName.toLowerCase().includes(q) ||
                    (item.eco.scientific_name && item.eco.scientific_name.toLowerCase().includes(q)) ||
                    (item.eco.habitat && item.eco.habitat.toLowerCase().includes(q)) ||
                    (item.eco.guild && item.eco.guild.toLowerCase().includes(q))
                  );
                }

                if (catalogSort === 'detections') {
                  list.sort((a, b) => b.count - a.count);
                } else if (catalogSort === 'alphabetical') {
                  list.sort((a, b) => a.spName.localeCompare(b.spName));
                } else if (catalogSort === 'iucn') {
                  list.sort((a, b) => (a.eco.iucn_status || 'LC').localeCompare(b.eco.iucn_status || 'LC'));
                }

                if (list.length === 0) {
                  return (
                    <div className="col-span-3 py-16 text-center text-xs text-[#5a635d]">
                      No species matching the search query in current live recordings.
                    </div>
                  );
                }

                return list.map(({ spName, count, sample, eco, avgConf }) => {
                  const imageUrl = eco.image_link || eco.image_url || eco.square_url || 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=800&auto=format&fit=crop';
                  const scientific = eco.scientific_name || sample?.scientific_name || 'Aves';
                  const iucn = eco.iucn_status || 'Least Concern';
                  const isEndemic = eco.endemic_status && String(eco.endemic_status).trim().toLowerCase() === 'yes';
                  const habitat = eco.habitat || eco.preferred_habitat || 'Wet Evergreen & Forest Canopy';
                  const guild = eco.guild || 'Insectivore / Frugivore';
                  const stratum = eco.foraging_stratum || 'Canopy & Understory';
                  const vocal = eco.vocal_activity || 'High at Dawn';
                  const indicator = eco.indicator_group || 'Forest Specialist';

                  return (
                    <div
                      key={spName}
                      className="bg-white border border-[#dde1dc] rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div>
                        {/* Photo Banner with Badges */}
                        <div className="h-44 relative bg-slate-900 overflow-hidden">
                          <img
                            src={imageUrl}
                            alt={spName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=800&auto=format&fit=crop';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                          
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/90 text-[#1a1f1c] shadow-xs backdrop-blur-xs">
                              {iucn}
                            </span>
                            {isEndemic && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-700 text-white shadow-xs">
                                Endemic
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-2 left-3 right-3 text-white">
                            <h3 className="font-serif font-bold text-sm leading-tight text-white drop-shadow-xs">{spName}</h3>
                            <p className="text-[11px] italic text-white/80">{scientific}</p>
                          </div>
                        </div>

                        {/* Ecological Metrics Grid */}
                        <div className="p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-[#dde1dc]">
                            <span className="text-[#5a635d]">RECORDED CALLS</span>
                            <span className="font-bold text-[#1f4d3a] bg-[#eaf2ed] px-2 py-0.5 rounded">
                              {count} calls
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
                            <div className="p-2 rounded-lg bg-[#f0f7f3] border border-[#dde1dc]/60">
                              <span className="text-[10px] font-mono uppercase text-[#5a635d] block">Habitat</span>
                              <strong className="text-[#1a1f1c] text-[11px] leading-tight line-clamp-1">{habitat}</strong>
                            </div>

                            <div className="p-2 rounded-lg bg-[#f0f7f3] border border-[#dde1dc]/60">
                              <span className="text-[10px] font-mono uppercase text-[#5a635d] block">Diet / Guild</span>
                              <strong className="text-[#1a1f1c] text-[11px] leading-tight line-clamp-1">{guild}</strong>
                            </div>

                            <div className="p-2 rounded-lg bg-[#fafbfa] border border-[#dde1dc]/60">
                              <span className="text-[10px] font-mono uppercase text-[#5a635d] block">Stratum</span>
                              <strong className="text-[#1a1f1c] text-[11px] leading-tight line-clamp-1">{stratum}</strong>
                            </div>

                            <div className="p-2 rounded-lg bg-[#fafbfa] border border-[#dde1dc]/60">
                              <span className="text-[10px] font-mono uppercase text-[#5a635d] block">Vocal Rhythms</span>
                              <strong className="text-[#1a1f1c] text-[11px] leading-tight line-clamp-1">{vocal}</strong>
                            </div>
                          </div>

                          <div className="text-[11px] text-[#5a635d] flex items-center justify-between pt-0.5">
                            <span className="text-[10px] font-mono text-[#5a635d]">Status: <strong className="text-[#1f4d3a]">{indicator}</strong></span>
                            <span className="text-[10px] font-mono text-[#5a635d]">Avg Conf: <strong>{formatPercent(avgConf)}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Listen Audio Button */}
                      <div className="p-3 border-t border-[#dde1dc] bg-[#fafbfa]">
                        <button
                          onClick={() => setSelectedDetection(sample)}
                          className="w-full py-2 px-3 rounded-xl bg-[#1f4d3a] text-white hover:bg-[#173b2c] transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Listen Bioacoustic Call</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ─── TAB 8: REVIEW QUEUE ────────────────────────────────────────────── */}
        {activeTab === 'review' && (
          <div className="dashboard-section space-y-4">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#1f4d3a]" />
                  Acoustic Verification &amp; Review Queue
                </h2>
                <p>Auditory validation workflow for expert verification of automated BirdNET classifications.</p>
              </div>
            </div>

            {/* Filter Pills and Search Bar */}
            {(() => {
              const pendingCount = filteredDetections.filter(d => d.verification_status !== 'YES' && d.verification_status !== 'NO').length;
              const approvedCount = filteredDetections.filter(d => d.verification_status === 'YES').length;
              const rejectedCount = filteredDetections.filter(d => d.verification_status === 'NO').length;

              return (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#fafbfa] border border-[#dde1dc] rounded-xl">
                  {/* Status Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setReviewStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        reviewStatusFilter === 'all'
                          ? 'bg-[#1f4d3a] text-white shadow-xs'
                          : 'bg-white border border-[#dde1dc] text-[#5a635d] hover:bg-[#f0f7f3]'
                      }`}
                    >
                      All ({filteredDetections.length})
                    </button>
                    <button
                      onClick={() => setReviewStatusFilter('pending')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        reviewStatusFilter === 'pending'
                          ? 'bg-[#1f4d3a] text-white shadow-xs'
                          : 'bg-white border border-[#dde1dc] text-[#5a635d] hover:bg-[#f0f7f3]'
                      }`}
                    >
                      <span>Pending</span>
                      {pendingCount > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          reviewStatusFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {pendingCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setReviewStatusFilter('verified')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        reviewStatusFilter === 'verified'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-white border border-[#dde1dc] text-[#5a635d] hover:bg-[#f0f7f3]'
                      }`}
                    >
                      Approved ({approvedCount})
                    </button>
                    <button
                      onClick={() => setReviewStatusFilter('rejected')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        reviewStatusFilter === 'rejected'
                          ? 'bg-rose-700 text-white shadow-xs'
                          : 'bg-white border border-[#dde1dc] text-[#5a635d] hover:bg-[#f0f7f3]'
                      }`}
                    >
                      Rejected ({rejectedCount})
                    </button>
                  </div>

                  {/* Search Query */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#5a635d] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="Filter by species name..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#dde1dc] rounded-lg focus:outline-none focus:border-[#1f4d3a]"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Detections List */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {(() => {
                let list = filteredDetections;

                if (reviewStatusFilter === 'pending') {
                  list = list.filter(d => d.verification_status !== 'YES' && d.verification_status !== 'NO');
                } else if (reviewStatusFilter === 'verified') {
                  list = list.filter(d => d.verification_status === 'YES');
                } else if (reviewStatusFilter === 'rejected') {
                  list = list.filter(d => d.verification_status === 'NO');
                }

                if (reviewSearch.trim()) {
                  const q = reviewSearch.toLowerCase().trim();
                  list = list.filter(d => 
                    (d.common_name && d.common_name.toLowerCase().includes(q)) ||
                    (d.scientific_name && d.scientific_name.toLowerCase().includes(q))
                  );
                }

                if (list.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs text-[#5a635d] bg-white border border-[#dde1dc] rounded-xl">
                      {reviewStatusFilter === 'pending'
                        ? '🎉 All detections in this view have been reviewed!'
                        : 'No detections match the selected review filter.'}
                    </div>
                  );
                }

                return list.slice(0, 50).map((det) => {
                  const isPending = det.verification_status !== 'YES' && det.verification_status !== 'NO';
                  const isApproved = det.verification_status === 'YES';
                  const isRejected = det.verification_status === 'NO';
                  const isUpdating = verifyingId === det.id || String(verifyingId) === String(det.id);

                  return (
                    <div
                      key={det.id}
                      className={`p-3.5 bg-white border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs transition-all ${
                        isApproved ? 'border-emerald-300 bg-emerald-50/20' : isRejected ? 'border-rose-300 bg-rose-50/20' : 'border-[#dde1dc]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm text-[#1a1f1c]">{det.common_name}</strong>
                          <span className="text-xs font-mono font-bold text-[#1f4d3a] bg-[#eaf2ed] px-1.5 py-0.2 rounded">
                            {formatPercent(det.confidence || 0)}
                          </span>
                          {isApproved && (
                            <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-300">
                              <Check className="w-3 h-3 text-emerald-700" />
                              Approved
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded flex items-center gap-1 border border-rose-300">
                              <X className="w-3 h-3 text-rose-700" />
                              Rejected
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#5a635d]">
                          {det.scientific_name} • Node: {det.recorder_id || det.station_name || 'Node'} • {det.timestamp ? new Date(det.timestamp).toLocaleString() : 'Recent'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          onClick={() => setSelectedDetection(det)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#dde1dc] text-xs font-semibold text-[#1f4d3a] bg-[#f0f7f3] hover:bg-[#eaf2ed] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                        >
                          <Play className="w-3 h-3 fill-[#1f4d3a]" />
                          <span>Audio</span>
                        </button>

                        <button
                          disabled={isUpdating}
                          onClick={() => handleVerify(det.id, true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs ${
                            isApproved
                              ? 'bg-emerald-800 text-white ring-2 ring-emerald-500'
                              : 'bg-emerald-700 text-white hover:bg-emerald-800'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isApproved ? 'Approved' : 'Approve'}</span>
                        </button>

                        <button
                          disabled={isUpdating}
                          onClick={() => handleVerify(det.id, false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs ${
                            isRejected
                              ? 'bg-rose-800 text-white ring-2 ring-rose-500'
                              : 'bg-rose-600 text-white hover:bg-rose-700'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{isRejected ? 'Rejected' : 'Reject'}</span>
                        </button>

                        {currentRole === 'Admin' && (
                          <button
                            disabled={isDeletingId === det.id}
                            onClick={() => handleDeleteDetection(det.id)}
                            className="p-1.5 rounded-lg border border-[#dde1dc] hover:border-rose-300 hover:bg-rose-50 text-[#5a635d] hover:text-rose-600 transition shadow-2xs cursor-pointer"
                            title="Delete this detection permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ─── TAB 9: REPORTS & EXPORT ────────────────────────────────────────── */}
        {activeTab === 'reports' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1f4d3a]" />
                  Bioacoustic Data Exports &amp; Summary Reports
                </h2>
                <p>Generate formatted research CSV exports for offline bioacoustic analysis.</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-linear-to-r from-[#f0f7f3] via-white to-white border border-[#dde1dc] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#1f4d3a] text-white">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                  </span>
                  <h3 className="font-serif font-bold text-sm text-[#1a1f1c]">
                    Automated Technical Dossier &amp; Research Reports
                  </h3>
                </div>
                <p className="text-xs text-[#5a635d] max-w-xl">
                  Synthesize real-time edge telemetry, species richness, diurnal patterns, and watchdog alerts into a publication-grade PDF report.
                </p>
              </div>

              <button
                onClick={() => setIsReportModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#1f4d3a] hover:bg-[#173b2c] text-white font-semibold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
              >
                <FileText className="w-4 h-4" />
                <span>Create Report</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-white border border-[#dde1dc] rounded-xl space-y-3 shadow-xs">
                <h3 className="font-bold text-sm text-[#1a1f1c]">Full Live Ingestion Log (CSV)</h3>
                <p className="text-xs text-[#5a635d]">Complete raw stream records with timestamps, confidence scores, species taxonomy, and verification flags.</p>
                <button onClick={downloadDetectionsCSV} className="btn-primary text-xs w-full">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Detections CSV ({totalDetections} Records)</span>
                </button>
              </div>

              <div className="p-5 bg-white border border-[#dde1dc] rounded-xl space-y-3 shadow-xs">
                <h3 className="font-bold text-sm text-[#1a1f1c]">Species Abundance Ranking (CSV)</h3>
                <p className="text-xs text-[#5a635d]">Aggregated species frequencies and total detection counts per species across the selected monitoring scope.</p>
                <button
                  onClick={() => {
                    const headers = ['Species', 'Total Calls'];
                    const rows = topSpeciesData.map(s => [`"${s.species}"`, s.detections]);
                    const blob = new Blob([[headers.join(','), ...rows.map(r => r.join(','))].join('\n')], { type: 'text/csv' });
                    const a = Object.assign(document.createElement('a'), {
                      href: URL.createObjectURL(blob),
                      download: `species_abundance_${new Date().toISOString().slice(0, 10)}.csv`
                    });
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="btn-secondary text-xs w-full"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Abundance CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ─── MODAL AUDIO & SPECTROGRAM PLAYER ─────────────────────────────────── */}
      {selectedDetection && (
        <AudioPlayerModal
          detection={selectedDetection}
          onClose={() => setSelectedDetection(null)}
          currentRole={currentRole}
          onVerify={(id, verified) => handleVerify(id, verified)}
        />
      )}

      {/* ─── PURGE LIVE DETECTIONS MODAL ───────────────────────────────────────── */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5 text-xs text-[#1a1f1c]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-slate-900">Purge Live Detections</h3>
                  <p className="text-[11px] text-slate-500">Permanently delete matching acoustic calls from Supabase</p>
                </div>
              </div>
              <button
                onClick={() => setIsPurgeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scope Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  1. Deletion Scope
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="purgeLiveScope"
                      checked={purgeScope === 'station'}
                      onChange={() => setPurgeScope('station')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Delete active node only ({selectedStationId !== 'ALL' ? selectedStationId : 'Selected Station'})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Only detections recorded by this specific hardware node will be purged.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="purgeLiveScope"
                      checked={purgeScope === 'project'}
                      onChange={() => setPurgeScope('project')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Delete ALL nodes observatory-wide
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Purges detections across all live hardware stations from Supabase.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  2. Verification Status Scope
                </label>
                <select
                  value={purgeStatusScope}
                  onChange={e => setPurgeStatusScope(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-400"
                >
                  <option value="all">Delete All Calls in Scope</option>
                  <option value="rejected">Delete ONLY Rejected Calls</option>
                  <option value="pending">Delete ONLY Pending Calls</option>
                  <option value="approved">Delete ONLY Approved Calls</option>
                </select>
              </div>

              {/* Warning Notice */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Permanent Database Deletion</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  This action cannot be undone. Matching bioacoustic calls in <code className="font-mono font-bold bg-white/70 px-1 rounded">live_detections</code> will be permanently removed.
                </p>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={purgeConfirmed}
                  onChange={e => setPurgeConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">
                  I confirm that I want to delete all matching detections from Supabase.
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteLivePurge}
                disabled={!purgeConfirmed || isPurging}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPurging ? 'Purging Supabase...' : 'Confirm & Purge Detections'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE RESEARCH REPORT MODAL ────────────────────────────────────── */}
      <ReportGeneratorModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        defaultFormat="live"
        defaultProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
        defaultSiteId={selectedSiteId !== 'ALL' ? selectedSiteId : undefined}
      />

    </div>
  );
}
