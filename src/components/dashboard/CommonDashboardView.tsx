'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  LayoutDashboard, 
  MapPin, 
  Grid, 
  LineChart, 
  Clock, 
  BarChart3, 
  Download, 
  ChevronRight, 
  Radio, 
  Search,
  X,
  Calendar,
  Share2,
  Link2,
  Check
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';
import DashboardLoader from '@/components/ui/DashboardLoader';
import { useDashboardStore } from '@/lib/store/useDashboardStore';
import CommonSpeciesHourMatrix from '@/components/charts/CommonSpeciesHourMatrix';

import { getSpeciesGradientColor } from '@/lib/colorUtils';
const LantanaMap = dynamic(() => import('@/components/map/LantanaMap'), { ssr: false });
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false }) as any;

const MONTH_NAMES = [
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

export interface CommonDashboardViewProps {
  initialProject?: string;
  initialSite?: string;
  initialTab?: 'summary' | 'map' | 'heatmap' | 'trends' | 'diurnal' | 'diversity';
}

export default function CommonDashboardView({
  initialProject,
  initialSite,
  initialTab
}: CommonDashboardViewProps = {}) {
  const { currentRole, currentUser, visibilitySettings, isTabVisibleForPublic } = useRole();
  const canExportCSV = currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager' || visibilitySettings?.allowPublicReports;
  const [activeTab, setActiveTab] = useState<'summary' | 'map' | 'heatmap' | 'trends' | 'diurnal' | 'diversity'>(initialTab || 'summary');
  const [copiedLinkToast, setCopiedLinkToast] = useState(false);
  
  const { 
    selectedProjectId, 
    selectedStationId, 
    selectedRecorderId, 
    confidenceThreshold,
    selectedSpecies,
    setProject,
    setStation,
    setRecorder,
    setConfidence,
    setSelectedSpecies,
  } = useDashboardStore();

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [recordersRegistryList, setRecordersRegistryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [stats, setStats] = useState<any>(null);
  const [mapSitesData, setMapSitesData] = useState<any[]>([]);

  // Ranked species list for search & top/least selection
  const [rankedSpecies, setRankedSpecies] = useState<{ common_name: string; count: number }[]>([]);
  const [speciesSearch, setSpeciesSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Chart data states
  const [trendData, setTrendData] = useState<any[]>([]);
  const [diversityData, setDiversityData] = useState<any[]>([]);
  const [diurnalData, setDiurnalData] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Chart date pickers & trend interval
  const [trendInterval, setTrendInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [diversityYear, setDiversityYear] = useState<string>('');
  const [diversityMonth, setDiversityMonth] = useState<string>('');
  const [diurnalDate, setDiurnalDate] = useState<string>('');

  // ECharts refs for graph export
  const trendChartRef = useRef<any>(null);
  const diurnalChartRef = useRef<any>(null);
  const diversityChartRef = useRef<any>(null);

  const chartColors = ['#1f4d3a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  // Copy Direct Share URL to clipboard
  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLinkToast(true);
    setTimeout(() => setCopiedLinkToast(false), 2500);
  };

  // Click outside search dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Initial load of reference data (Projects, Sites, Recorders)
  useEffect(() => {
    let isCurrent = true;

    async function initData() {
      setLoading(true);
      setLoadingProgress(25);
      try {
        const [projectsRes, sitesRes, recordersRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('name'),
          supabase.from('recorders_registry').select('*').order('recorder_id')
        ]);

        if (!isCurrent) return;
        setLoadingProgress(prev => Math.max(prev, 70));

        let allProjects = (projectsRes.data || []).filter((p: any) => !p.project_type || p.project_type === 'PAM');
        let allSites = sitesRes.data || [];

        // Apply RBAC filtering
        if (currentRole === 'Project Manager') {
          const assigned = currentUser?.assignedProjects || [];
          allProjects = allProjects.filter((p: any) => assigned.includes(p.id));
          allSites = allSites.filter((s: any) => assigned.includes(s.project_id));
        } else if (currentRole === 'Site Manager') {
          const assigned = currentUser?.assignedSites || [];
          allSites = allSites.filter((s: any) => assigned.includes(s.id));
          const allowedProjIds = new Set(allSites.map((s: any) => s.project_id));
          allProjects = allProjects.filter((p: any) => allowedProjIds.has(p.id));
        }

        const pamProjects = allProjects;
        const pamProjectIds = new Set(pamProjects.map((p: any) => p.id));
        setProjectsList(pamProjects);

        // Pre-select project from props, URL query param, or first PAM project
        const urlParams = new URLSearchParams(window.location.search);
        const queryProject = initialProject || urlParams.get('project');
        const querySite = initialSite || urlParams.get('site');
        const queryTab = initialTab || (urlParams.get('tab') as any);

        if (queryTab && ['summary', 'map', 'heatmap', 'trends', 'diurnal', 'diversity'].includes(queryTab)) {
          setActiveTab(queryTab);
        }

        if (queryProject && pamProjectIds.has(queryProject)) {
          setProject(queryProject);
        } else if (pamProjects.length > 0 && selectedProjectId === 'ALL_PROJECTS') {
          setProject(pamProjects[0].id);
        }

        const pamSites: any[] = allSites
          .filter((s: any) => pamProjectIds.has(s.project_id))
          .map(s => ({
            id: s.id,
            station_name: s.name,
            project_id: s.project_id,
            latitude: s.latitude,
            longitude: s.longitude
          }));

        setStationsList(pamSites);

        // Pre-select site from props or URL
        if (querySite) {
          const qNorm = querySite.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matched = pamSites.find(
            s => s.id === querySite || 
                 s.station_name.toLowerCase() === querySite.toLowerCase() ||
                 s.station_name.toLowerCase().replace(/[^a-z0-9]/g, '') === qNorm ||
                 s.station_name.toLowerCase().includes(querySite.toLowerCase()) ||
                 (qNorm.length >= 3 && s.station_name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(qNorm))
          );
          if (matched) {
            setStation(matched.id);
          }
        }

        const pamSiteNames = Array.from(new Set(pamSites.map((s: any) => s.station_name)));
        const actualRecorders = (recordersRes.data || []).filter(
          (r: any) => r.project_type === 'PAM' && pamSiteNames.some(name => name.includes(r.site_name))
        );

        const syntheticRecorders = pamSites.map((s: any) => ({
          id: `synth_${s.id}_Rec_01`,
          project_type: 'PAM',
          project_name: s.project_id,
          site_name: s.station_name,
          recorder_id: 'Rec_01'
        }));

        if (!isCurrent) return;
        setRecordersRegistryList([...actualRecorders, ...syntheticRecorders]);
        setLoadingProgress(100);
      } catch (err) {
        console.error('Error loading projects/sites:', err);
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }
    initData();
    return () => {
      isCurrent = false;
    };
  }, [currentRole, currentUser, initialProject, initialSite, initialTab]);

  // Two-way URL parameter synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || loading) return;
    const currentPath = window.location.pathname;
    const currentUrl = new URL(window.location.href);

    const isDynamicPath = currentPath.startsWith('/dashboard/') && currentPath !== '/dashboard/common' && currentPath !== '/dashboard/lantana';
    const activeStationObj = stationsList.find(s => s.id === selectedStationId);

    if (isDynamicPath) {
      const projSlug = (selectedProjectId && selectedProjectId !== 'ALL_PROJECTS') ? selectedProjectId : 'nilgiri';
      const siteSlug = (activeStationObj && selectedStationId !== 'ALL_SITES') ? encodeURIComponent(activeStationObj.station_name) : '';
      
      currentUrl.pathname = siteSlug ? `/dashboard/${projSlug}/${siteSlug}` : `/dashboard/${projSlug}`;
      currentUrl.searchParams.delete('project');
      currentUrl.searchParams.delete('site');
    } else {
      if (selectedProjectId && selectedProjectId !== 'ALL_PROJECTS') {
        currentUrl.searchParams.set('project', selectedProjectId);
      } else {
        currentUrl.searchParams.delete('project');
      }

      if (activeStationObj && selectedStationId !== 'ALL_SITES') {
        currentUrl.searchParams.set('site', activeStationObj.station_name);
      } else {
        currentUrl.searchParams.delete('site');
      }
    }

    if (activeTab && activeTab !== 'summary') {
      currentUrl.searchParams.set('tab', activeTab);
    } else {
      currentUrl.searchParams.delete('tab');
    }

    window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search);
  }, [selectedProjectId, selectedStationId, activeTab, stationsList, loading]);

  // Derived filter params for RPC queries
  const p_project_names = useMemo(() => {
    if (selectedProjectId === 'ALL_PROJECTS') return null;
    const projectSites = stationsList.filter(s => s.project_id === selectedProjectId);
    return projectSites.length > 0 ? projectSites.map(s => s.station_name) : ['NONE'];
  }, [selectedProjectId, stationsList]);

  const p_site_name = useMemo(() => {
    if (selectedStationId === 'ALL_SITES') return 'ALL_SITES';
    const s = stationsList.find(s => s.id === selectedStationId);
    return s ? s.station_name : 'ALL_SITES';
  }, [selectedStationId, stationsList]);

  const p_recorder_name = selectedRecorderId;

  // 1. Fetch Summary Stats (only when on summary tab or not yet loaded)
  useEffect(() => {
    async function fetchStats() {
      if (projectsList.length === 0 || loading) return;
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_project_names,
        p_site_name,
        p_recorder_name,
        p_confidence: confidenceThreshold
      });
      if (!error && data) {
        setStats(data);
      }
    }
    if (activeTab === 'summary' || !stats) {
      fetchStats();
    }
  }, [activeTab, p_project_names, p_site_name, p_recorder_name, confidenceThreshold, loading, projectsList.length]);

  // 2. Fetch Map Sites Data (only when map tab is opened)
  useEffect(() => {
    async function fetchMapData() {
      if (projectsList.length === 0 || loading) return;
      const { data, error } = await supabase.rpc('get_map_sites_data', {
        p_project_names,
        p_site_name,
        p_recorder_name,
        p_confidence: confidenceThreshold
      });
      if (!error && data) {
        setMapSitesData(data);
      }
    }
    if (activeTab === 'map' && mapSitesData.length === 0) {
      fetchMapData();
    }
  }, [activeTab, p_project_names, p_site_name, p_recorder_name, confidenceThreshold, loading, projectsList.length]);

  // 3. Fetch Top Species & Available Dates (when trends, diversity or diurnal tabs open)
  useEffect(() => {
    if (loading || (activeTab !== 'trends' && activeTab !== 'diurnal' && activeTab !== 'diversity')) return;
    async function initOptions() {
      const promises: PromiseLike<any>[] = [];
      if (rankedSpecies.length === 0) {
        promises.push(
          supabase.rpc('get_top_species', {
            p_limit: 300, p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      if (availableDates.length === 0) {
        promises.push(
          supabase.rpc('get_available_dates', {
            p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      const [topRes, datesRes] = await Promise.all(promises);

      if (topRes && topRes.data) {
        const rawList = topRes.data.map((d: any) => ({
          common_name: d.common_name,
          count: Number(d.count || 0)
        }));
        setRankedSpecies(rawList);

        if (selectedSpecies.length === 0 && rawList.length > 0) {
          setSelectedSpecies(rawList.slice(0, 8).map((s: { common_name: string; count: number }) => s.common_name));
        }
      }

      if (datesRes && datesRes.data && datesRes.data.length > 0) {
        const dates = datesRes.data.map((d: any) => d.date);
        setAvailableDates(dates);
        const latest = dates[0];
        const [y, m] = latest.split('-');
        if (!diversityYear) setDiversityYear(y);
        if (!diversityMonth) setDiversityMonth(m);
        if (!diurnalDate) setDiurnalDate(latest);
      }
    }
    initOptions();
  }, [activeTab, p_project_names, p_site_name, p_recorder_name, confidenceThreshold, loading]);

  // 4. Fetch Trend Data (only on trends tab)
  useEffect(() => {
    if (activeTab !== 'trends' || selectedSpecies.length === 0 || loading) return;
    async function fetchTrend() {
      const { data } = await supabase.rpc('get_trend_data', {
        p_species: selectedSpecies, p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold
      });
      if (data) setTrendData(data);
    }
    fetchTrend();
  }, [activeTab, selectedSpecies, p_project_names, p_site_name, p_recorder_name, confidenceThreshold, loading]);

  // 5. Fetch Diversity Data (only on diversity tab)
  useEffect(() => {
    if (activeTab !== 'diversity' || !diversityYear || !diversityMonth || loading) return;
    async function fetchDiversity() {
      const { data } = await supabase.rpc('get_diversity_data', {
        p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold,
        p_year: diversityYear, p_month: diversityMonth
      });
      if (data) setDiversityData(data);
    }
    fetchDiversity();
  }, [activeTab, diversityYear, diversityMonth, p_project_names, p_site_name, p_recorder_name, confidenceThreshold, loading]);

  // 6. Fetch Diurnal Data (only on diurnal tab)
  useEffect(() => {
    if (activeTab !== 'diurnal' || !diurnalDate || loading) return;
    async function fetchDiurnal() {
      const { data } = await supabase.rpc('get_diurnal_data', {
        p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold,
        p_date: diurnalDate
      });
      if (data) setDiurnalData(data);
    }
    fetchDiurnal();
  }, [activeTab, diurnalDate, p_project_names, p_site_name, p_recorder_name, confidenceThreshold, loading]);

  // Toggle species selection with max 10 enforcement
  const handleToggleSpecies = (speciesName: string) => {
    if (selectedSpecies.includes(speciesName)) {
      setSelectedSpecies(selectedSpecies.filter(s => s !== speciesName));
    } else {
      if (selectedSpecies.length >= 10) return;
      setSelectedSpecies([...selectedSpecies, speciesName]);
    }
  };

  const handleSelectTop8Most = () => {
    const top8 = rankedSpecies.slice(0, 8).map(s => s.common_name);
    setSelectedSpecies(top8);
  };

  const handleSelectTop8Least = () => {
    const withCalls = rankedSpecies.filter(s => s.count > 0);
    const least8 = withCalls.slice(Math.max(0, withCalls.length - 8)).map(s => s.common_name);
    setSelectedSpecies(least8);
  };

  const filteredSearchSpecies = useMemo(() => {
    if (!speciesSearch.trim()) return rankedSpecies.slice(0, 15);
    const q = speciesSearch.toLowerCase().trim();
    return rankedSpecies.filter(s => s.common_name.toLowerCase().includes(q)).slice(0, 15);
  }, [rankedSpecies, speciesSearch]);

  // Chart image downloader
  const downloadChartAsImage = (chartRef: React.RefObject<any>, defaultFilename: string) => {
    if (!chartRef.current) return;
    try {
      const echartsInstance = chartRef.current.getEchartsInstance();
      const dataUrl = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading chart image:', err);
    }
  };

  // CSV Exporter
  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadSummaryCSV = () => {
    const hdr = ['Metric', 'Value'];
    const rows = [
      ['Total Detections', stats?.total_detections || 0],
      ['Unique Species', stats?.unique_species || 0],
      ['Bird of Year', `"${stats?.bird_of_year_name || 'N/A'}" (${stats?.bird_of_year_count || 0} calls)`],
      ['Rarest Find', `"${stats?.rarest_find_name || 'N/A'}" (${stats?.rarest_find_count || 0} calls)`],
      ['Busiest Day', `"${stats?.busiest_day_date || 'N/A'}" (${stats?.busiest_day_count || 0} calls)`],
      ['Dawn Champion', `"${stats?.dawn_champion_name || 'N/A'}"`],
      ['Night Owl', `"${stats?.night_owl_name || 'N/A'}" (${stats?.night_owl_count || 0} calls)`]
    ];
    triggerDownload([hdr.join(','), ...rows.map(r => r.join(','))].join('\n'), `pam_summary_${selectedProjectId}.csv`);
  };

  const { mapSites, minSpecies, maxSpecies } = useMemo(() => {
    const dataMap = new Map((mapSitesData || []).map((d: any) => [d.site_name, d]));
    
    const validStations = stationsList
      .filter(s => s.latitude != null && s.longitude != null && Number(s.latitude) !== 0 && Number(s.longitude) !== 0)
      .map(s => {
        const siteStat = dataMap.get(s.station_name);
        const speciesCount = siteStat ? Number(siteStat.species_count || 0) : 0;
        const detectionsCount = siteStat ? Number(siteStat.detections_count || 0) : 0;
        return {
          id: s.id,
          name: s.station_name,
          site_group: s.station_name,
          recorder_id: 'Rec_01',
          lat: Number(s.latitude),
          lng: Number(s.longitude),
          detectionsCount,
          speciesCount
        };
      });

    const countsWithData = validStations.map(s => s.speciesCount).filter(c => c > 0);
    const min = countsWithData.length > 0 ? Math.min(...countsWithData) : 0;
    const max = countsWithData.length > 0 ? Math.max(...countsWithData) : 0;

    const styledSites = validStations.map(s => ({
      ...s,
      color: s.speciesCount > 0 ? getSpeciesGradientColor(s.speciesCount, min, max) : '#10b981'
    }));

    return { mapSites: styledSites, minSpecies: min, maxSpecies: max };
  }, [stationsList, mapSitesData]);

  // ── Trend Chart Option (Daily / Weekly / Monthly / Yearly) ───────────────
  const trendOption = useMemo(() => {
    const timeKeysSet = new Set<string>();
    const timeKeyDisplay = new Map<string, string>();
    const countsMap = new Map<string, Map<string, number>>();

    trendData.forEach((d: any) => {
      const rawDate = d.detection_date || d.date;
      if (!rawDate) return;
      const sp = d.common_name;
      const cnt = Number(d.detection_count || d.count || 0);

      let sortKey = rawDate;
      let displayLabel = rawDate;

      if (trendInterval === 'weekly') {
        const dt = new Date(rawDate + 'T00:00:00');
        const day = dt.getDay();
        const diff = dt.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        const mon = new Date(dt.setDate(diff));
        const y = mon.getFullYear();
        const m = String(mon.getMonth() + 1).padStart(2, '0');
        const dayNum = String(mon.getDate()).padStart(2, '0');
        sortKey = `${y}-${m}-${dayNum}`;
        const mShort = mon.toLocaleString('en-US', { month: 'short' });
        displayLabel = `Wk of ${mShort} ${dayNum}`;
      } else if (trendInterval === 'monthly') {
        const [y, m] = rawDate.split('-');
        sortKey = `${y}-${m}`;
        const dt = new Date(parseInt(y), parseInt(m) - 1, 1);
        displayLabel = dt.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      } else if (trendInterval === 'yearly') {
        const y = rawDate.split('-')[0];
        sortKey = y;
        displayLabel = y;
      }

      timeKeysSet.add(sortKey);
      timeKeyDisplay.set(sortKey, displayLabel);

      if (!countsMap.has(sortKey)) {
        countsMap.set(sortKey, new Map());
      }
      const spMap = countsMap.get(sortKey)!;
      spMap.set(sp, (spMap.get(sp) || 0) + cnt);
    });

    const sortedKeys = Array.from(timeKeysSet).sort();
    const xLabels = sortedKeys.map(k => timeKeyDisplay.get(k) || k);

    const series = selectedSpecies.map((species, idx) => {
      return {
        name: species,
        type: 'line' as const,
        smooth: true,
        showSymbol: true,
        symbolSize: trendInterval === 'daily' ? 4 : 6,
        data: sortedKeys.map(k => countsMap.get(k)?.get(species) || 0),
        itemStyle: { color: chartColors[idx % chartColors.length] },
        lineStyle: { width: 2.5 }
      };
    });

    const intervalUnit = trendInterval === 'daily' ? 'Daily' : trendInterval === 'weekly' ? 'Weekly' : trendInterval === 'monthly' ? 'Monthly' : 'Yearly';

    return {
      tooltip: { 
        trigger: 'axis' as const,
        formatter: (params: any) => {
          if (!params || !params.length) return '';
          let html = `<div style="font-family:Inter,sans-serif;padding:4px 8px"><div style="font-weight:700;font-size:12px;margin-bottom:4px">${params[0].name} (${intervalUnit})</div>`;
          params.forEach((p: any) => {
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;margin:2px 0"><span style="color:${p.color}">● ${p.seriesName}:</span><strong style="color:#0f172a">${Number(p.value).toLocaleString()} calls</strong></div>`;
          });
          html += `</div>`;
          return html;
        }
      },
      legend: { data: selectedSpecies, top: 0, textStyle: { color: '#475569', fontSize: 11 } },
      grid: { left: '4%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
      xAxis: { type: 'category' as const, data: xLabels, axisLabel: { fontSize: 10, color: '#64748b' } },
      yAxis: { type: 'value' as const, name: `${intervalUnit} Calls`, axisLabel: { fontSize: 10, color: '#64748b' } },
      series
    };
  }, [trendData, selectedSpecies, trendInterval]);

  // ── Diurnal Chart Option ─────────────────────────────────────────────────
  const diurnalOption = useMemo(() => {
    const hourCounts = Array(24).fill(0);
    diurnalData.forEach((d: any) => {
      const h = Number(d.hour);
      if (!isNaN(h) && h >= 0 && h < 24) {
        hourCounts[h] += Number(d.count || d.detection_count || 0);
      }
    });

    return {
      tooltip: { 
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `<div class="font-sans text-xs"><strong>${p.name}</strong><br/>Total Calls: <strong>${Number(p.value).toLocaleString()}</strong></div>`;
        }
      },
      grid: { left: '4%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
      xAxis: { type: 'category' as const, data: hourLabels, axisLabel: { interval: 1, fontSize: 10, color: '#64748b' } },
      yAxis: { type: 'value' as const, name: 'Calls', axisLabel: { fontSize: 10, color: '#64748b' } },
      series: [{
        data: hourCounts,
        type: 'bar' as const,
        itemStyle: { color: '#1f4d3a', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 32
      }]
    };
  }, [diurnalData, hourLabels]);

  // ── Diversity Chart Option ───────────────────────────────────────────────
  const diversityOption = useMemo(() => {
    const days = Array.from(new Set(diversityData.map((d: any) => d.day))).sort((a, b) => Number(a) - Number(b));
    
    // Construct exact date strings YYYY-MM-DD
    const dateLabels = days.map(day => {
      const dd = String(day).padStart(2, '0');
      const mm = String(diversityMonth || '01').padStart(2, '0');
      const yyyy = diversityYear || '2026';
      return `${yyyy}-${mm}-${dd}`;
    });

    const data = days.map(day => {
      const item = diversityData.find((d: any) => d.day === day);
      return item ? Number(item.unique_species_count || item.count || 0) : 0;
    });

    return {
      tooltip: { 
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `<div class="font-sans text-xs"><strong>Date: ${p.name}</strong><br/>Unique Species: <strong class="text-emerald-700">${p.value} species</strong></div>`;
        }
      },
      grid: { left: '4%', right: '4%', bottom: '14%', top: '15%', containLabel: true },
      xAxis: { 
        type: 'category' as const, 
        data: dateLabels, 
        axisLabel: { 
          fontSize: 10, 
          color: '#64748b',
          rotate: dateLabels.length > 15 ? 30 : 0
        } 
      },
      yAxis: { type: 'value' as const, name: 'Species Count', axisLabel: { fontSize: 10, color: '#64748b' } },
      series: [{
        data,
        type: 'bar' as const,
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24
      }]
    };
  }, [diversityData, diversityYear, diversityMonth]);

  const allNavMenuItems = [
    { id: 'summary', label: 'Summary', icon: LayoutDashboard },
    { id: 'map', label: 'Survey Site Map', icon: MapPin },
    { id: 'heatmap', label: 'Species Detection (Heatmap)', icon: Grid },
    { id: 'trends', label: 'Species Activity & Trend Analysis', icon: LineChart },
    { id: 'diurnal', label: 'Diurnal Activity Patterns', icon: Clock },
    { id: 'diversity', label: 'Avian Diversity & Richness Over Time', icon: BarChart3 },
  ];

  const scopeKey = selectedStationId !== 'ALL_SITES' ? `${selectedProjectId}:${selectedStationId}` : selectedProjectId;

  const navMenuItems = useMemo(() => {
    if (currentRole !== 'Public') return allNavMenuItems;
    return allNavMenuItems.filter(item => isTabVisibleForPublic('commonPam', item.id, scopeKey));
  }, [currentRole, isTabVisibleForPublic, scopeKey]);

  // If activeTab is hidden from public, redirect to first visible tab
  useEffect(() => {
    if (currentRole === 'Public' && navMenuItems.length > 0) {
      const isCurrentVisible = navMenuItems.some(item => item.id === activeTab);
      if (!isCurrentVisible) {
        setActiveTab(navMenuItems[0].id as any);
      }
    }
  }, [currentRole, navMenuItems, activeTab]);

  if (loading) return <DashboardLoader progress={loadingProgress} message="Loading PAM bioacoustics observatory..." />;

  return (
    <div className="w-full h-[calc(100vh-80px)] overflow-hidden text-[#1a1f1c] font-sans flex flex-col md:flex-row bg-[#f8faf8]">

      {/* ─── LEFT SIDEBAR NAVIGATION ────────────────────────────────────────── */}
      <aside className="w-full md:w-72 lg:w-80 bg-white border-r border-[#dde1dc] flex flex-col justify-between shrink-0 h-full overflow-y-auto shadow-sm">
        <div className="p-4 space-y-4">
          
          {/* Observatory Header Badge */}
          <div className="p-3.5 bg-[#f0f7f3] border border-[#dde1dc] rounded-xl">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">PAM Observatory</div>
            <div className="text-xs font-bold text-[#1a1f1c]">Monitoring Dashboard</div>
          </div>

          {/* Navigation Menu Links */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#5a635d]">
              Dashboard Menu
            </div>

            <nav className="space-y-1">
              {navMenuItems.map((item, idx) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-[#1f4d3a] text-white font-semibold shadow-sm'
                        : 'text-[#374151] hover:bg-[#f0f7f3] hover:text-[#1f4d3a]'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#eaf2ed] text-[#1f4d3a]'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'} leading-snug flex-1`}>
                      {item.label}
                    </span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-white shrink-0" />}
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
              <span className="text-[#5a635d]">MONITORED STATIONS</span>
              <span className="font-bold text-[#1f4d3a] bg-[#eaf2ed] px-2 py-0.5 rounded">{stationsList.length} Sites</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#5a635d]">AVIAN RICHNESS</span>
              <span className="font-bold text-[#1f4d3a] bg-[#eaf2ed] px-2 py-0.5 rounded">{stats?.unique_species || 0} Species</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#5a635d]">TOTAL DETECTIONS</span>
              <span className="font-bold text-[#1f4d3a] bg-[#eaf2ed] px-2 py-0.5 rounded">{(stats?.total_detections || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA (RIGHT SIDE) ─────────────────────────────────── */}
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

              {canExportCSV && activeTab === 'summary' && (
                <button onClick={downloadSummaryCSV} className="btn-primary text-xs cursor-pointer" title="Download Summary CSV">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Summary CSV</span>
                </button>
              )}
              {canExportCSV && activeTab === 'map' && (
                <button onClick={downloadSummaryCSV} className="btn-primary text-xs cursor-pointer" title="Download Sites CSV">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sites CSV</span>
                </button>
              )}
              {activeTab === 'trends' && (
                <button onClick={() => downloadChartAsImage(trendChartRef, 'species_trends.png')} className="btn-primary text-xs" title="Download Trend Graph (PNG)">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Graph</span>
                </button>
              )}
              {activeTab === 'diurnal' && (
                <button onClick={() => downloadChartAsImage(diurnalChartRef, 'diurnal_patterns.png')} className="btn-primary text-xs" title="Download Diurnal Graph (PNG)">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Graph</span>
                </button>
              )}
              {activeTab === 'diversity' && (
                <button onClick={() => downloadChartAsImage(diversityChartRef, 'avian_diversity.png')} className="btn-primary text-xs" title="Download Diversity Graph (PNG)">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Graph</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="filter-label">Monitoring Project</label>
              <select className="select-input" value={selectedProjectId} onChange={e => setProject(e.target.value)}>
                <option value="ALL_PROJECTS">All PAM Projects</option>
                {projectsList.map((p: any) => <option key={p.id} value={p.id}>{p.name || p.title}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="filter-label">Survey Site / Station</label>
              <select className="select-input" value={selectedStationId} onChange={e => setStation(e.target.value)}>
                <option value="ALL_SITES">All Survey Sites</option>
                {stationsList.map((s: any) => <option key={s.id} value={s.id}>{s.station_name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="filter-label">Recorder Unit</label>
              <select className="select-input" value={selectedRecorderId} onChange={e => setRecorder(e.target.value)}>
                <option value="ALL_RECORDERS">All Recorders</option>
                {recordersRegistryList.map((r: any) => <option key={r.id} value={r.recorder_id}>{r.recorder_id}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="filter-label">
                <span>BirdNet Cutoff</span>
                <span className="slider-val">{confidenceThreshold.toFixed(2)}</span>
              </label>
              <div className="slider-wrapper">
                <input
                  type="range" min="0.0" max="1.0" step="0.05"
                  value={confidenceThreshold}
                  onChange={e => setConfidence(Number(e.target.value))}
                  className="range-slider"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── TAB 1: SUMMARY / OVERVIEW ──────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            {/* 3 Summary KPI Cards */}
            <div className="summary-cards">
              <div className="kpi-card">
                <span className="kpi-label">Species Richness</span>
                <span className="kpi-value">{stats?.unique_species || 0}</span>
                <span className="kpi-subtext">Unique avian species detected</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Total Detections</span>
                <span className="kpi-value">{(stats?.total_detections || 0).toLocaleString()}</span>
                <span className="kpi-subtext">BirdNET classification triggers</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Survey Stations</span>
                <span className="kpi-value">{stationsList.length}</span>
                <span className="kpi-subtext">Active monitoring stations</span>
              </div>
            </div>

            {/* Bioacoustic Highlights Grid */}
            <div className="dashboard-section">
              <div className="section-header">
                <div>
                  <h2>Survey Bioacoustic Insights</h2>
                  <p>Automated ecological detections and significant vocalization records.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-[#f0f7f3] border border-[#dde1dc]">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">Bird of the Year</div>
                  <div className="font-bold text-[#1a1f1c] text-sm truncate mt-1">{stats?.bird_of_year_name || 'N/A'}</div>
                  <div className="text-xs text-[#1f4d3a] font-semibold mt-0.5">{(stats?.bird_of_year_count || 0).toLocaleString()} calls</div>
                </div>

                <div className="p-4 rounded-xl bg-[#f0f7f3] border border-[#dde1dc]">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">Rarest Find</div>
                  <div className="font-bold text-[#1a1f1c] text-sm truncate mt-1">{stats?.rarest_find_name || 'N/A'}</div>
                  <div className="text-xs text-amber-700 font-semibold mt-0.5">{stats?.rarest_find_count || 0} calls</div>
                </div>

                <div className="p-4 rounded-xl bg-[#f0f7f3] border border-[#dde1dc]">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">Busiest Day</div>
                  <div className="font-bold text-[#1a1f1c] text-sm truncate mt-1">{stats?.busiest_day_date || 'N/A'}</div>
                  <div className="text-xs text-[#1f4d3a] font-semibold mt-0.5">{(stats?.busiest_day_count || 0).toLocaleString()} calls heard</div>
                </div>

                <div className="p-4 rounded-xl bg-[#f0f7f3] border border-[#dde1dc]">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">Dawn Champion</div>
                  <div className="font-bold text-[#1a1f1c] text-sm truncate mt-1">{stats?.dawn_champion_name || 'N/A'}</div>
                  <div className="text-xs text-[#5a635d] font-semibold mt-0.5">First song at dawn</div>
                </div>

                <div className="p-4 rounded-xl bg-[#f0f7f3] border border-[#dde1dc]">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">Night Owl</div>
                  <div className="font-bold text-[#1a1f1c] text-sm truncate mt-1">{stats?.night_owl_name || 'N/A'}</div>
                  <div className="text-xs text-indigo-700 font-semibold mt-0.5">{stats?.night_owl_count || 0} calls after dark</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: SURVEY SITE MAP ─────────────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="dashboard-section" id="map-section">
            <div className="section-header">
              <div>
                <h2>Survey Site Map</h2>
                <p>Physical monitoring station locations colored by avian species richness (Green: Low → Red: High).</p>
              </div>
            </div>
            <div className="h-[520px] w-full rounded-xl overflow-hidden border border-[#dde1dc]">
              <LantanaMap
                sites={mapSites}
                center={[11.41, 76.69]}
                zoom={12}
                showRichnessLegend={true}
                minSpecies={minSpecies}
                maxSpecies={maxSpecies}
                onSelectSite={(siteName, siteId) => {
                  const matched = stationsList.find(s => s.station_name === siteName || s.id === siteId);
                  if (matched) {
                    setStation(matched.id);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* ─── TAB 3: SPECIES DETECTION HEATMAP ───────────────────────────────── */}
        {activeTab === 'heatmap' && (
          <CommonSpeciesHourMatrix
            p_project_names={p_project_names}
            p_site_name={p_site_name}
            p_recorder_name={p_recorder_name}
          />
        )}

        {/* ─── TAB 4: SPECIES TRENDS ──────────────────────────────────────────── */}
        {activeTab === 'trends' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Species Activity &amp; Trend Analysis</h2>
                <p>Acoustic vocalization trigger rates across selected species over time (Max 10 species).</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Time Interval Toggle */}
                <div className="flex items-center bg-[#f0f7f3] border border-[#dde1dc] rounded-lg p-0.5 shadow-xs">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setTrendInterval(interval)}
                      className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all capitalize ${
                        trendInterval === interval
                          ? 'bg-[#1f4d3a] text-white shadow-xs'
                          : 'text-[#5a635d] hover:text-[#1a1f1c]'
                      }`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>

                <div className="text-xs font-mono font-bold text-[#1f4d3a] bg-[#f0f7f3] px-2.5 py-1 rounded-lg border border-[#dde1dc]">
                  Selected: {selectedSpecies.length} / 10
                </div>
              </div>
            </div>

            {/* Species Search, Top 8, Least 8, and Clear Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Search Box with Autocomplete */}
              <div className="relative" ref={searchDropdownRef} style={{ width: '100%', maxWidth: '320px', zIndex: 40 }}>
                <div className="search-box" style={{ margin: 0 }}>
                  <Search className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search species to add..."
                    value={speciesSearch}
                    onChange={e => { setSpeciesSearch(e.target.value); setShowSearchDropdown(true); }}
                    onFocus={() => setShowSearchDropdown(true)}
                  />
                </div>

                {showSearchDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#dde1dc] rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                    {filteredSearchSpecies.length === 0 ? (
                      <div className="p-3 text-xs text-[#5a635d]">No species match your query.</div>
                    ) : (
                      filteredSearchSpecies.map(sp => {
                        const isSelected = selectedSpecies.includes(sp.common_name);
                        const isMax = selectedSpecies.length >= 10 && !isSelected;
                        return (
                          <div
                            key={sp.common_name}
                            onClick={() => {
                              if (!isMax) {
                                handleToggleSpecies(sp.common_name);
                                setSpeciesSearch('');
                                setShowSearchDropdown(false);
                              }
                            }}
                            className={`p-2.5 px-3 text-xs flex items-center justify-between border-b border-[#f1f5f9] transition-colors ${
                              isMax ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-[#f0f7f3]'
                            }`}
                          >
                            <span className="font-semibold text-[#1a1f1c]">{sp.common_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#5a635d]">{sp.count.toLocaleString()} calls</span>
                              {isSelected ? (
                                <span className="text-[10px] font-bold text-[#1f4d3a] bg-[#eaf2ed] px-1.5 py-0.5 rounded">Active</span>
                              ) : isMax ? (
                                <span className="text-[10px] text-amber-700">Max 10</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Fast Selector Action Buttons */}
              <button
                type="button"
                onClick={handleSelectTop8Most}
                className="btn-primary text-xs"
                title="Select 8 Most Detected Species"
              >
                Top 8 Most Detected
              </button>

              <button
                type="button"
                onClick={handleSelectTop8Least}
                className="btn-secondary text-xs"
                title="Select 8 Least Detected Species"
              >
                Top 8 Least Detected
              </button>

              <button
                type="button"
                onClick={() => setSelectedSpecies([])}
                className="btn-secondary text-xs"
                title="Clear selected species"
              >
                Clear
              </button>
            </div>

            {/* Active Selected Species Tag Chips */}
            {selectedSpecies.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedSpecies.map((species, idx) => (
                  <span
                    key={species}
                    style={{
                      background: chartColors[idx % chartColors.length],
                      color: '#ffffff',
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full shadow-xs"
                  >
                    <span>{species}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSpecies(species)}
                      className="hover:bg-black/20 rounded-full p-0.5 transition-colors"
                      title={`Remove ${species}`}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {selectedSpecies.length === 0 ? (
              <div className="empty-state">
                <span>No species selected. Search and select up to 10 species above or click &quot;Top 8 Most Detected&quot;.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #dde1dc', borderRadius: '10px' }}>
                <div style={{ minWidth: '800px', padding: '1rem 0' }}>
                  <ReactECharts ref={trendChartRef} option={trendOption} notMerge={true} style={{ height: '420px', width: '100%' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 5: DIURNAL ACTIVITY ────────────────────────────────────────── */}
        {activeTab === 'diurnal' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Diurnal Activity Patterns</h2>
                <p>24-hour daily call rhythm and vocalization activity cycles.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#5a635d] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#1f4d3a]" />
                  <span>Select Date:</span>
                </label>
                <input
                  type="date"
                  value={diurnalDate}
                  min={availableDates[availableDates.length - 1]}
                  max={availableDates[0]}
                  onChange={e => setDiurnalDate(e.target.value)}
                  className="select-input text-xs font-mono font-medium cursor-pointer"
                  style={{ minWidth: '150px' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #dde1dc', borderRadius: '10px' }}>
              <div style={{ minWidth: '800px', padding: '1rem 0' }}>
                <ReactECharts ref={diurnalChartRef} option={diurnalOption} notMerge={true} style={{ height: '420px', width: '100%' }} />
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 6: AVIAN DIVERSITY OVER TIME ────────────────────────────────── */}
        {activeTab === 'diversity' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Avian Diversity &amp; Richness Over Time</h2>
                <p>Number of distinct species classified per day across the survey period.</p>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  className="select-input text-xs font-semibold !w-auto min-w-[95px] max-w-[110px] h-[32px] !py-1 !px-2.5" 
                  value={diversityYear} 
                  onChange={e => setDiversityYear(e.target.value)}
                >
                  {Array.from(new Set(availableDates.map(d => d.split('-')[0]))).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select 
                  className="select-input text-xs font-semibold !w-auto min-w-[110px] max-w-[130px] h-[32px] !py-1 !px-2.5" 
                  value={diversityMonth} 
                  onChange={e => setDiversityMonth(e.target.value)}
                >
                  {MONTH_NAMES.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #dde1dc', borderRadius: '10px' }}>
              <div style={{ minWidth: '800px', padding: '1rem 0' }}>
                <ReactECharts ref={diversityChartRef} option={diversityOption} notMerge={true} style={{ height: '420px', width: '100%' }} />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
