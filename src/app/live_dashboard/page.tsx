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
  Battery, 
  Volume2, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { AccumulationChart } from '@/components/charts/AccumulationChart';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { PolarDiurnalChart } from '@/components/charts/PolarDiurnalChart';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import DashboardLoader from '@/components/ui/DashboardLoader';

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

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.5);

  // Species Accumulation Filter States
  const [accumulationInterval, setAccumulationInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [accumulationYear, setAccumulationYear] = useState<string>('ALL');
  const [accumulationMonth, setAccumulationMonth] = useState<string>('ALL');

  // Diurnal Filter State
  const [diurnalFilterDate, setDiurnalFilterDate] = useState<string>('');

  // Review Queue States
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSort, setReviewSort] = useState<'newest' | 'confidence'>('newest');

  // Species Catalog State & Ecology Map
  const [speciesEcologyMap, setSpeciesEcologyMap] = useState<Record<string, any>>({});
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState<'detections' | 'alphabetical' | 'iucn'>('detections');

  // Supabase Data States
  const [liveProjects, setLiveProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Read initial tab from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') as LiveDashboardTab;
    if (tabParam && ['summary', 'map', 'accumulation', 'diurnal', 'live', 'stations', 'species', 'review', 'reports'].includes(tabParam)) {
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
        const [
          { data: projs },
          { data: recordersData },
          { data: sitesData },
          { data: ecologyData },
          { count: liveCount }
        ] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('name'),
          supabase.from('lantana_species_ecology').select('*'),
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

        if (!isCurrent) return;
        setLoadingProgress(prev => Math.max(prev, 70));

        let scopedProjs = projs || [];
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

        // Scope hardware nodes
        let scopedRecorders = recordersData || [];
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

        setStationsList(scopedRecorders);
        setSitesList(liveSites);
        setDetections(dedupeDetections(detData || []));
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
      .subscribe();

    return () => {
      isCurrent = false;
      supabase.removeChannel(channel);
    };
  }, [currentRole, currentUser]);

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

  // Filter detections by 3-level scope & search/confidence
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

  // Active Nodes calculation (status === 'online' AND ping < 5 mins ago)
  const activeNodesCount = availableStations.filter((s: any) => {
    if (s.status !== 'online' || !s.last_ping) return false;
    const diffMins = (Date.now() - new Date(s.last_ping).getTime()) / 60000;
    return diffMins <= 5;
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

  // Review status update handler
  const handleVerify = async (id: string, verified: boolean) => {
    const status = verified ? 'YES' : 'NO';
    const { error } = await supabase
      .from('live_detections')
      .update({ verification_status: status })
      .eq('id', id);

    if (!error) {
      setDetections(prev => prev.map(d => d.id === id ? { ...d, verification_status: status } : d));
    }
  };

  // Role-based visibility flags
  const canAccessReports = currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager' || visibilitySettings.allowPublicReports;
  const canAccessReview = currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager';

  const scopeKey = selectedSiteId !== 'ALL' ? `${selectedProjectId}:${selectedSiteId}` : selectedProjectId;

  // The 9 Ordered Tabs Requested by User (with RBAC & Public Visibility filtering)
  const allNavMenuItems = [
    { id: 'summary', label: 'Summary', icon: LayoutDashboard },
    { id: 'map', label: 'Survey Site Map', icon: MapPin },
    { id: 'accumulation', label: 'Species Accumulation Curve', icon: LineChart },
    { id: 'diurnal', label: 'Diurnal Activity Pattern', icon: Clock },
    { id: 'live', label: 'Live Stream', icon: Radio, badge: 'LIVE' },
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
      if (activeTab === 'review' && !canAccessReview) {
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

      {/* ─── 1. LEFT SIDEBAR NAVIGATION (9 ORDERED TABS) ────────────────────── */}
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
                  min="0.2"
                  max="0.99"
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
        {activeTab === 'map' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Survey Site Map</h2>
                <p>Physical monitoring station locations and active hardware nodes.</p>
              </div>
            </div>
            <div className="h-[540px] w-full rounded-xl overflow-hidden border border-[#dde1dc]">
              <LantanaMap
                sites={availableStations.map((s: any) => ({
                  id: s.id || s.recorder_id,
                  name: s.site_name || s.recorder_id,
                  site_group: s.site_name || s.recorder_id,
                  recorder_id: s.recorder_id || 'Node_01',
                  lat: Number(s.latitude || s.lat || 13.6288),
                  lng: Number(s.longitude || s.long || 79.4192),
                  detectionsCount: filteredDetections.filter(d => d.recorder_id === s.recorder_id || d.station_id === s.id).length,
                  speciesCount: new Set(filteredDetections.filter(d => d.recorder_id === s.recorder_id || d.station_id === s.id).map(d => d.common_name)).size,
                  color: s.status === 'online' ? '#1f4d3a' : '#943a29'
                }))}
                center={[13.6288, 79.4192]}
                zoom={11}
                onSelectSite={(_siteName: string, siteId: string) => {
                  setSelectedStationId(siteId);
                }}
              />
            </div>
          </div>
        )}

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

        {/* ─── TAB 5: LIVE STREAM FEED ────────────────────────────────────────── */}
        {activeTab === 'live' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                  Live Bioacoustic Ingestion Stream
                </h2>
                <p>Incoming classification events streamed directly from Raspberry Pi field nodes.</p>
              </div>
              <div className="text-xs font-mono font-bold text-[#1f4d3a] bg-[#f0f7f3] px-3 py-1.5 rounded-lg border border-[#dde1dc]">
                {filteredDetections.length} Events Ingested
              </div>
            </div>

            {/* Detections List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredDetections.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-xs text-[#5a635d]">
                  No live detections matching current filters.
                </div>
              ) : (
                filteredDetections.map((det) => (
                  <div
                    key={det.id}
                    className="p-3.5 bg-[#fafbfa] hover:bg-[#f0f7f3] border border-[#dde1dc] rounded-xl flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1a1f1c] truncate">{det.common_name}</span>
                        <span className="text-[10px] font-mono font-bold text-[#1f4d3a] bg-[#eaf2ed] px-1.5 py-0.5 rounded">
                          {formatPercent(det.confidence || 0)}
                        </span>
                      </div>
                      <div className="text-xs italic text-[#5a635d] truncate">{det.scientific_name}</div>
                      <div className="text-[10px] font-mono text-[#5a635d] flex items-center gap-2">
                        <span>Node: {det.recorder_id || det.station_name || 'Node_01'}</span>
                        <span>•</span>
                        <span>{det.timestamp ? new Date(det.timestamp).toLocaleTimeString() : 'Just now'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedDetection(det)}
                      className="w-9 h-9 rounded-xl bg-[#1f4d3a] text-white flex items-center justify-center hover:bg-[#173b2c] transition-colors shrink-0 shadow-xs cursor-pointer ml-3"
                      title="Play bioacoustic audio & spectrogram"
                    >
                      <Play className="w-4 h-4 ml-0.5 fill-white" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 6: STATIONS & NODES ────────────────────────────────────────── */}
        {activeTab === 'stations' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#1f4d3a]" />
                  Field Recorder Nodes &amp; Hardware Telemetry
                </h2>
                <p>Active BirdNET-Pi hardware stations, heartbeat status, and telemetry diagnostics.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {availableStations.length === 0 ? (
                <div className="col-span-3 py-12 text-center text-xs text-[#5a635d]">
                  No recorder nodes found in the selected project scope.
                </div>
              ) : (
                availableStations.map((stn: any) => {
                  const isOnline = stn.status === 'online';
                  return (
                    <div
                      key={stn.recorder_id || stn.id}
                      className="p-4 bg-white border border-[#dde1dc] rounded-xl shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between border-b border-[#dde1dc] pb-2.5">
                        <div>
                          <h3 className="font-bold text-sm text-[#1a1f1c] flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                            {stn.site_name || stn.recorder_id}
                          </h3>
                          <div className="text-[11px] font-mono text-[#5a635d] mt-0.5">{stn.recorder_id}</div>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                          isOnline ? 'bg-[#eaf2ed] text-emerald-800' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>
                          <span className="text-[#5a635d] block">FIRMWARE</span>
                          <strong className="text-[#1a1f1c]">{stn.firmware_version || 'v2.4 (Live)'}</strong>
                        </div>
                        <div>
                          <span className="text-[#5a635d] block">STORAGE</span>
                          <strong className="text-[#1a1f1c]">{stn.storage_used_percent ? `${Math.round(stn.storage_used_percent)}%` : '28%'}</strong>
                        </div>
                        <div>
                          <span className="text-[#5a635d] block">BATTERY / PWR</span>
                          <strong className="text-emerald-700">{stn.battery_level ?? 100}%</strong>
                        </div>
                        <div>
                          <span className="text-[#5a635d] block">LAST PING</span>
                          <strong className="text-[#1a1f1c]">{stn.last_ping ? new Date(stn.last_ping).toLocaleTimeString() : 'Recent'}</strong>
                        </div>
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
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2 className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#1f4d3a]" />
                  Acoustic Verification &amp; Review Queue
                </h2>
                <p>Auditory validation workflow for expert verification of automated BirdNET classifications.</p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredDetections.slice(0, 30).map((det) => (
                <div
                  key={det.id}
                  className="p-3.5 bg-white border border-[#dde1dc] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-[#1a1f1c]">{det.common_name}</strong>
                      <span className="text-xs font-mono font-bold text-[#1f4d3a] bg-[#eaf2ed] px-1.5 py-0.2 rounded">
                        {formatPercent(det.confidence || 0)}
                      </span>
                      {det.verification_status === 'YES' && (
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Verified</span>
                      )}
                    </div>
                    <div className="text-xs text-[#5a635d]">
                      {det.scientific_name} • Node: {det.recorder_id || det.station_name || 'Node_01'} • {det.timestamp ? new Date(det.timestamp).toLocaleString() : 'Recent'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedDetection(det)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#dde1dc] text-xs font-semibold text-[#1f4d3a] bg-[#f0f7f3] hover:bg-[#eaf2ed] flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-[#1f4d3a]" />
                      <span>Audio</span>
                    </button>

                    <button
                      onClick={() => handleVerify(det.id, true)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => handleVerify(det.id, false)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
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

    </div>
  );
}
