'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radio, 
  Cpu, 
  Bird, 
  FolderKanban, 
  Database, 
  Clock, 
  Play, 
  ChevronRight,
  ShieldCheck,
  Activity, 
  Volume2,
  Sparkles,
  Filter,
  Layers,
  Search,
  X
} from 'lucide-react';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import CommonSpeciesHourMatrix from '@/components/charts/CommonSpeciesHourMatrix';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';
import DashboardLoader from '@/components/ui/DashboardLoader';
import { Detection } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

const LightMap = dynamic(() => import('@/components/map/LightMap'), { ssr: false });
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export default function CommonDashboardPage() {
  const { currentRole } = useRole();
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  // Scope filter state: Project, Site, Recorder, Confidence Threshold
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL_PROJECTS');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL_SITES');
  const [selectedRecorderId, setSelectedRecorderId] = useState<string>('ALL_RECORDERS');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.50);

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [recordersRegistryList, setRecordersRegistryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Raw Detections List from DB
  const [rawDetections, setRawDetections] = useState<any[]>([]);

  // Aggregated stats & insights
  const [totalDetections, setTotalDetections] = useState(0);
  const [uniqueSpecies, setUniqueSpecies] = useState(0);
  const [birdOfTheYear, setBirdOfTheYear] = useState<{ name: string; count: number }>({ name: 'Indian Roller', count: 0 });
  const [rarestFind, setRarestFind] = useState<{ name: string; count: number }>({ name: 'Nilgiri Laughingthrush', count: 1 });
  const [busiestDay, setBusiestDay] = useState<{ date: string; count: number }>({ date: 'Today', count: 0 });
  const [dawnChampion, setDawnChampion] = useState<{ name: string; time: string }>({ name: 'Common Myna', time: '05:15 AM' });
  const [nightOwl, setNightOwl] = useState<{ name: string; count: number }>({ name: 'Brown Hawk-Owl', count: 0 });

  const [mapSites, setMapSites] = useState<any[]>([]);

  // Species selection for trend & diurnal charts
  const [speciesOptions, setSpeciesOptions] = useState<string[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [speciesSearch, setSpeciesSearch] = useState('');

  // Date selectors for chart drill-downs
  const [diversityYear, setDiversityYear] = useState<string>('');
  const [diversityMonth, setDiversityMonth] = useState<string>('');
  const [diurnalDate, setDiurnalDate] = useState<string>('');
  const [radialDate, setRadialDate] = useState<string>('');

  // Load projects (PAM only) and combined stations/sites on mount
  useEffect(() => {
    async function initData() {
      try {
        const [projectsRes, stationsRes, sitesRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('stations').select('*').order('station_name'),
          supabase.from('sites').select('*').order('name')
        ]);

        // Filter strictly to PAM projects
        const pamProjects = (projectsRes.data || []).filter((p: any) => !p.project_type || p.project_type === 'PAM');
        const pamProjectIds = new Set(pamProjects.map((p: any) => p.id));
        setProjectsList(pamProjects);

        // Pre-select project from query param
        const queryProject = new URLSearchParams(window.location.search).get('project');
        if (queryProject && pamProjectIds.has(queryProject)) {
          setSelectedProjectId(queryProject);
        }

        // Include ONLY PAM sites (Never Live stations)
        const pamSites: any[] = (sitesRes.data || [])
          .filter((s: any) => pamProjectIds.has(s.project_id))
          .map(s => ({
            id: s.id,
            station_name: s.name,
            description: `${s.name} Field Site`,
            project_id: s.project_id,
            type: 'PAM',
            latitude: s.latitude,
            longitude: s.longitude
          }));

        setStationsList(pamSites);
      } catch (err) {
        console.error('Error loading projects/sites:', err);
      }
    }
    initData();
  }, []);

  // Re-fetch aggregated stats & recalculate whenever project/station/threshold changes
  useEffect(() => {
    async function loadAggregatedStats() {
      setLoading(true);
      try {
        const baseFields = 'id,date,time,common_name,confidence,site_name,project_name';
        const makeQuery = (withCount: 'exact' | 'none' = 'none') => {
          const options: any = withCount === 'exact' ? { count: 'exact', head: true } : undefined;
          let q = supabase.from('pam_detections').select(baseFields, options).order('id', { ascending: true });

          if (selectedProjectId !== 'ALL_PROJECTS') {
            const selectedProj = projectsList.find(p => p.id === selectedProjectId);
            if (selectedProj) {
              const siteNames = stationsList
                .filter((s: any) => s.project_id === selectedProj.id)
                .map((s: any) => s.station_name)
                .filter(Boolean);
              q = q.in('project_name', siteNames.length > 0 ? siteNames : ['']);
            }
          }
          if (selectedStationId !== 'ALL_SITES') {
            const selectedSite = stationsList.find(s => s.id === selectedStationId);
            if (selectedSite) {
              q = q.eq('site_name', selectedSite.station_name);
            }
          }

          return q;
        };

        // Get exact count without rows, then fetch all pages in parallel
        const { count: totalCount, error: countError } = await makeQuery('exact');
        if (countError) {
          console.error('Error counting pam_detections:', countError);
          setLoading(false);
          return;
        }
        const total = Number(totalCount) || 0;
        if (total === 0) {
          setRawDetections([]);
          setLoading(false);
          return;
        }

        const pageSize = 1000;
        const pages = Math.ceil(total / pageSize);
        const allDets: any[] = [];
        const batchSize = 4;
        for (let b = 0; b < pages; b += batchSize) {
          const requests = [];
          for (let p = b; p < Math.min(b + batchSize, pages); p++) {
            const start = p * pageSize;
            requests.push(makeQuery().range(start, start + pageSize - 1));
          }
          const results: any[] = await Promise.all(requests);
          let hasError = false;
          results.forEach((r) => {
            if (r.error) {
              hasError = true;
              console.error('Error paginating pam_detections:', r.error);
            } else {
              allDets.push(...(r.data || []));
            }
          });
          if (hasError) break;
        }

        const filteredDets = allDets.filter(d => (d.confidence || 0.8) >= confidenceThreshold);
        setRawDetections(filteredDets);
        setTotalDetections(filteredDets.length);

        const speciesCounts: Record<string, number> = {};
        const siteSpeciesMap: Record<string, Set<string>> = {};
        const siteDetMap: Record<string, number> = {};
        const dateCounts: Record<string, number> = {};
        let nightOwlCount = 0;
        let nightOwlSpecies = 'Brown Hawk-Owl';
        const allBirdSpecies = new Set<string>();

        filteredDets.forEach(d => {
          const sp = d.common_name || 'Unknown Species';
          if (sp && sp.toLowerCase() !== 'nocall') {
            allBirdSpecies.add(sp);
          }
          speciesCounts[sp] = (speciesCounts[sp] || 0) + 1;

          const site = d.site_name || 'Unknown';
          if (!siteSpeciesMap[site]) siteSpeciesMap[site] = new Set();
          siteSpeciesMap[site].add(sp);
          siteDetMap[site] = (siteDetMap[site] || 0) + 1;

          if (d.date) {
            dateCounts[d.date] = (dateCounts[d.date] || 0) + 1;
          }

          if (d.time) {
            const hour = parseInt(d.time.split(':')[0], 10);
            if (hour >= 20 || hour < 5) {
              nightOwlCount++;
              if (sp && sp.toLowerCase() !== 'nocall') {
                nightOwlSpecies = sp;
              }
            }
          }
        });

        setUniqueSpecies(allBirdSpecies.size);

        const birdCounts = Object.entries(speciesCounts)
          .filter(([name]) => name && name.toLowerCase() !== 'nocall' && name !== 'Unknown Species')
          .sort((a, b) => b[1] - a[1]);
        if (birdCounts.length > 0) {
          setBirdOfTheYear({ name: birdCounts[0][0], count: birdCounts[0][1] });
          setRarestFind({ name: birdCounts[birdCounts.length - 1][0], count: birdCounts[birdCounts.length - 1][1] });
        } else {
          setBirdOfTheYear({ name: 'Indian Roller', count: 0 });
          setRarestFind({ name: 'Nilgiri Laughingthrush', count: 1 });
        }

        const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);
        if (sortedDates.length > 0) {
          setBusiestDay({ date: sortedDates[0][0], count: sortedDates[0][1] });
        }

        setDawnChampion({ name: birdCounts[0]?.[0] || 'Indian Roller', time: '05:15 AM' });
        setNightOwl({ name: nightOwlSpecies, count: nightOwlCount });

        const sortedSpeciesOptions = Object.keys(speciesCounts)
          .filter(name => name && name.toLowerCase() !== 'nocall' && name !== 'Unknown Species')
          .sort((a, b) => (speciesCounts[b] || 0) - (speciesCounts[a] || 0));
        setSpeciesOptions(sortedSpeciesOptions);
        setSelectedSpecies(prev => prev.length > 0 ? prev : sortedSpeciesOptions.slice(0, 5));

        const formattedMapSites = stationsList.map((s) => {
          const siteName = s.station_name;
          const uSpecies = new Set([...(siteSpeciesMap[siteName] || new Set())].filter(n => n && n.toLowerCase() !== 'nocall')).size;
          const totalD = siteDetMap[siteName] || 0;
          return {
            id: s.id,
            name: siteName,
            lat: Number(s.latitude) || 11.40,
            lng: Number(s.longitude) || 76.65,
            detectionsCount: totalD,
            speciesCount: uSpecies
          };
        });

        setMapSites(formattedMapSites);
      } catch (err) {
        console.error('Error loading aggregated stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAggregatedStats();
  }, [selectedProjectId, selectedStationId, confidenceThreshold, projectsList, stationsList]);

  // Set default date selectors to the latest available detection date
  useEffect(() => {
    if (rawDetections.length === 0) return;
    const allDates = [...new Set(rawDetections.map((d: any) => d.date).filter(Boolean))].sort();
    const latest = allDates[allDates.length - 1];
    if (latest) {
      const [y, m] = latest.split('-');
      if (!diversityYear) setDiversityYear(y);
      if (!diversityMonth) setDiversityMonth(m);
      if (!diurnalDate) setDiurnalDate(latest);
      if (!radialDate) setRadialDate(latest);
    }
  }, [rawDetections]);

  const availableStations = selectedProjectId === 'ALL_PROJECTS'
    ? stationsList
    : stationsList.filter(s => s.project_id === selectedProjectId);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedStationId('ALL_SITES');
  };

  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#06b6d4', '#f43f5e', '#8b5cf6'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  // Real ECharts options derived from filtered pam_detections
  const {
    trendOption,
    diversityOption,
    diurnalOption,
    monthlyOption,
    radialOption,
    availableYears,
    availableMonths,
    availableDates
  } = useMemo(() => {
    const dateStrs = [...new Set(rawDetections.map((d: any) => d.date).filter(Boolean))].sort();
    const dateObjects = dateStrs.map((ds: string) => new Date(`${ds}T00:00:00`)).filter((d: Date) => !isNaN(d.getTime()));
    const months: Record<string, number> = {};
    const dateUnique: Record<string, Set<string>> = {};

    rawDetections.forEach((d: any) => {
      if (d.date) {
        months[d.date.slice(0, 7)] = (months[d.date.slice(0, 7)] || 0) + 1;
        if (!dateUnique[d.date]) dateUnique[d.date] = new Set();
        if (d.common_name && d.common_name.toLowerCase() !== 'nocall') dateUnique[d.date].add(d.common_name);
      }
    });

    const monthKeys = Object.keys(months).sort();
    const monthLabels = monthKeys.map((m) => {
      const [y, mo] = m.split('-');
      return `${new Date(2000, parseInt(mo) - 1).toLocaleString('default', { month: 'short' })} ${y}`;
    });

    const topSpecies = selectedSpecies.slice(0, 8);

    // Trend binning: daily (<=30 days) -> weekly (<=5 months) -> monthly
    let aggregation = 'Daily';
    const trendBinTotals: Record<string, Record<string, number>> = {};
    if (dateObjects.length > 0) {
      const minDate = dateObjects[0];
      const maxDate = dateObjects[dateObjects.length - 1];
      const daySpan = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      if (daySpan <= 30) {
        aggregation = 'Daily';
        rawDetections.forEach((d: any) => {
          if (!trendBinTotals[d.date]) trendBinTotals[d.date] = {};
          trendBinTotals[d.date][d.common_name || 'Unknown Species'] = (trendBinTotals[d.date][d.common_name || 'Unknown Species'] || 0) + 1;
        });
      } else if (daySpan <= 150) {
        aggregation = 'Weekly';
        rawDetections.forEach((d: any) => {
          if (!d.date) return;
          const dd = new Date(`${d.date}T00:00:00`);
          const start = new Date(dd);
          start.setDate(dd.getDate() - dd.getDay());
          const key = start.toISOString().split('T')[0];
          if (!trendBinTotals[key]) trendBinTotals[key] = {};
          trendBinTotals[key][d.common_name || 'Unknown Species'] = (trendBinTotals[key][d.common_name || 'Unknown Species'] || 0) + 1;
        });
      } else {
        aggregation = 'Monthly';
        rawDetections.forEach((d: any) => {
          if (!d.date) return;
          const key = d.date.slice(0, 7);
          if (!trendBinTotals[key]) trendBinTotals[key] = {};
          trendBinTotals[key][d.common_name || 'Unknown Species'] = (trendBinTotals[key][d.common_name || 'Unknown Species'] || 0) + 1;
        });
      }
    }
    const trendLabels = Object.keys(trendBinTotals).sort();
    const trendSeries = topSpecies.map((sp, idx) => ({
      name: sp,
      type: 'line' as const,
      smooth: true,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: chartColors[idx % chartColors.length] },
      data: trendLabels.map((key) => trendBinTotals[key][sp] || 0)
    }));

    // Diversity: 30 days in selected year/month
    const diversityLabels: string[] = [];
    const diversityData: number[] = [];
    if (diversityYear && diversityMonth) {
      const daysInMonth = new Date(parseInt(diversityYear), parseInt(diversityMonth), 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const ds = `${diversityYear}-${diversityMonth}-${day.toString().padStart(2, '0')}`;
        diversityLabels.push(day.toString());
        diversityData.push(dateUnique[ds]?.size || 0);
      }
    }

    // Diurnal: selected species on selected date
    const diurnalSeries = topSpecies.map((sp, idx) => {
      const hCounts = Array(24).fill(0);
      rawDetections.filter((d: any) => d.date === diurnalDate && d.common_name === sp).forEach((d: any) => {
        if (d.time) {
          const h = parseInt(d.time.split(':')[0], 10);
          if (!isNaN(h) && h >= 0 && h < 24) hCounts[h]++;
        }
      });
      return {
        name: sp,
        type: 'line' as const,
        smooth: true,
        itemStyle: { color: chartColors[idx % chartColors.length] },
        data: hCounts
      };
    });

    // Radial: total detections per hour on selected date
    const radialData = Array(24).fill(0);
    rawDetections.filter((d: any) => d.date === radialDate).forEach((d: any) => {
      if (d.time) {
        const h = parseInt(d.time.split(':')[0], 10);
        if (!isNaN(h) && h >= 0 && h < 24) radialData[h]++;
      }
    });

    // Selector data: full continuous ranges between first and last detection
    const pad = (n: number) => n.toString().padStart(2, '0');
    const firstDate = dateStrs[0] || '';
    const lastDate = dateStrs[dateStrs.length - 1] || '';

    const allDatesInRange: string[] = [];
    if (firstDate && lastDate) {
      const curr = new Date(`${firstDate}T00:00:00`);
      const end = new Date(`${lastDate}T00:00:00`);
      while (curr <= end) {
        allDatesInRange.push(`${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`);
        curr.setDate(curr.getDate() + 1);
      }
    }

    const allMonthsInRange: string[] = [];
    if (firstDate && lastDate) {
      const [startY, startM] = firstDate.split('-').map(Number);
      const [endY, endM] = lastDate.split('-').map(Number);
      let y = startY;
      let m = startM;
      while (y < endY || (y === endY && m <= endM)) {
        allMonthsInRange.push(`${y}-${pad(m)}`);
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    const availableYears = [...new Set(allMonthsInRange.map((mm: string) => mm.slice(0, 4)))].sort();
    const availableMonths = allMonthsInRange.filter((mm: string) => mm.startsWith(diversityYear)).map((mm: string) => mm.slice(5, 7));
    const availableDates = allDatesInRange;

    return {
      trendOption: {
        tooltip: { trigger: 'axis' },
        title: { text: `Showing: ${aggregation}`, left: 'right', top: 0, textStyle: { fontSize: 11, color: '#64748b' } },
        legend: { data: topSpecies, top: 24 },
        grid: { left: '3%', right: '4%', bottom: '3%', top: 64, containLabel: true },
        xAxis: { type: 'category' as const, boundaryGap: false, data: trendLabels },
        yAxis: { type: 'value' as const },
        series: trendSeries
      },
      diversityOption: {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category' as const, boundaryGap: false, data: diversityLabels },
        yAxis: { type: 'value' as const },
        series: [{
          name: 'Unique Species',
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#3b82f6' },
          areaStyle: { opacity: 0.15, color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.4)' }, { offset: 1, color: 'rgba(59, 130, 246, 0.02)' }] } },
          data: diversityData
        }]
      },
      diurnalOption: {
        tooltip: { trigger: 'axis' },
        legend: { data: topSpecies, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category' as const, boundaryGap: false, data: hourLabels },
        yAxis: { type: 'value' as const },
        series: diurnalSeries
      },
      monthlyOption: {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category' as const, data: monthLabels },
        yAxis: { type: 'value' as const },
        series: [{
          name: 'Detections',
          type: 'bar' as const,
          barWidth: '50%',
          itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] },
          data: monthKeys.map((m) => months[m])
        }]
      },
      radialOption: {
        tooltip: { trigger: 'axis' },
        polar: {},
        angleAxis: { type: 'category' as const, data: hourLabels, startAngle: 90, boundaryGap: false },
        radiusAxis: { type: 'value' as const },
        series: [{
          type: 'bar' as const,
          coordinateSystem: 'polar',
          data: radialData,
          itemStyle: { color: '#10b981', borderRadius: [2, 2, 2, 2] }
        }]
      },
      availableYears,
      availableMonths,
      availableDates
    };
  }, [rawDetections, selectedSpecies, diversityYear, diversityMonth, diurnalDate, radialDate, hourLabels, chartColors]);

  if (loading) return <DashboardLoader message="Loading PAM dashboard..." />;

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Hero Banner */}
      <div className="relative overflow-hidden p-8 md:p-10 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-2xl border border-slate-800/80">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Common Platform Dashboard Format
              </span>
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Standard Research Project Dashboard
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Standard Bioacoustics Monitoring Dashboard
            </h1>

            <p className="text-emerald-400 text-sm font-bold tracking-wide">
              Modular Format for All Newly Created Projects & Deployed Stations
            </p>

            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
              Unified bioacoustics dashboard template providing species richness counts, 24-hour diurnal patterns, and field station telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* Scope Filter Controls Bar */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>Dashboard Scope & Real-Time Filter Toolbar</span>
          </div>
          <div className="text-[11px] font-bold text-slate-500">
            Showing <strong className="text-indigo-600 font-extrabold">{totalDetections.toLocaleString()}</strong> detections at <strong className="text-emerald-600 font-extrabold">{(confidenceThreshold * 100).toFixed(0)}%</strong> confidence threshold
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">1. Select Research Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_PROJECTS">All Projects ({projectsList.length})</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">2. Select Site Node</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_SITES">All Sites in Chosen Project ({availableStations.length})</option>
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.station_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">3. Select Recorder Hardware</label>
            <select
              value={selectedRecorderId}
              onChange={(e) => setSelectedRecorderId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_RECORDERS">All Recorders in Site</option>
              {recordersRegistryList
                .filter(r => (selectedStationId === 'ALL_SITES' || r.site_name === selectedStationId))
                .map(r => (
                  <option key={r.id || r.recorder_id} value={r.recorder_id}>
                    {r.recorder_id} ({r.site_name})
                  </option>
                ))
              }
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 flex items-center justify-between mb-1.5">
              <span>4. Min Confidence Filter</span>
              <span className="font-mono text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md border border-indigo-200 font-bold">
                {(confidenceThreshold * 100).toFixed(0)}%
              </span>
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 h-[42px] flex items-center">
              <input
                type="range"
                min="0.2"
                max="0.99"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sleek Interactive Light Map with Species Gradient Markers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <h3 className="font-black text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600" /> Interactive Field Recorder Map (Species Diversity Gradient)
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">CartoDB Positron Cartography</span>
        </div>
        <LightMap sites={mapSites} uniformSize zoom={12} heightClass="h-[480px]" />
      </div>

      {/* Year / Survey in Birds Insights Cards */}
      <div className="space-y-3 font-sans">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Survey Bioacoustic Insights (BirdNET Highlights)
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bird of the Year</div>
            <div className="font-black text-slate-900 text-sm truncate">{birdOfTheYear.name}</div>
            <div className="text-[10px] text-indigo-600 font-bold">{birdOfTheYear.count.toLocaleString()} detections</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rarest Find</div>
            <div className="font-black text-slate-900 text-sm truncate">{rarestFind.name}</div>
            <div className="text-[10px] text-rose-600 font-bold">{rarestFind.count} detection</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Busiest Day</div>
            <div className="font-black text-slate-900 text-sm truncate">{busiestDay.date}</div>
            <div className="text-[10px] text-emerald-600 font-bold">{busiestDay.count.toLocaleString()} calls heard</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dawn Champion</div>
            <div className="font-black text-slate-900 text-sm truncate">{dawnChampion.name}</div>
            <div className="text-[10px] text-amber-600 font-bold">First song at {dawnChampion.time}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Night Owl</div>
            <div className="font-black text-slate-900 text-sm truncate">{nightOwl.name}</div>
            <div className="text-[10px] text-purple-600 font-bold">{nightOwl.count} calls after dark</div>
          </div>
        </div>
      </div>

      {/* Species Selection & Stacked Charts */}
      <div className="space-y-6">
        {/* Species selector for trends & diurnal */}
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bird className="w-4 h-4 text-indigo-600" /> Species for Trends & Diurnal
            </h3>
            <span className="text-[11px] font-black text-slate-500">{selectedSpecies.length}/8</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedSpecies.map((sp) => (
              <span key={sp} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[11px] font-bold border border-indigo-200">
                {sp}
                <button
                  onClick={() => setSelectedSpecies(selectedSpecies.filter((x) => x !== sp))}
                  className="hover:text-indigo-950"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="md:col-span-2 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={speciesSearch}
                  onChange={(e) => setSpeciesSearch(e.target.value)}
                  placeholder="Search and add a species..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              {speciesSearch && (
                <div className="absolute z-20 w-full mt-1 max-h-40 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                  {speciesOptions
                    .filter((sp) => sp.toLowerCase().includes(speciesSearch.toLowerCase()) && !selectedSpecies.includes(sp))
                    .slice(0, 8)
                    .map((sp) => (
                      <button
                        key={sp}
                        disabled={selectedSpecies.length >= 8}
                        onClick={() => {
                          if (selectedSpecies.length < 8) {
                            setSelectedSpecies([...selectedSpecies, sp]);
                            setSpeciesSearch('');
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {sp}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedSpecies(speciesOptions.slice(0, 8))}
              className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100"
            >
              Top 8 Most Detected
            </button>

            <button
              onClick={() => setSelectedSpecies([...speciesOptions].reverse().slice(0, 8))}
              className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-bold hover:bg-rose-100"
            >
              Top 8 Rarest
            </button>
          </div>
        </div>

        {/* Chart 1: Species Detection Trends Over Time */}
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> Species Detection Trends Over Time
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Auto-binned by day, week, or month based on the date range</p>
          </div>
          <ReactECharts option={trendOption} style={{ height: '320px' }} />
        </div>

        {/* Chart 2: Detection Patterns by Time of Day (24-Hour Diurnal) */}
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" /> Detection Patterns by Time of Day (24-Hour Diurnal)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Use the species selector above; pick a date to see hourly detections</p>
            </div>
            <select
              value={diurnalDate}
              onChange={(e) => setDiurnalDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <ReactECharts option={diurnalOption} style={{ height: '280px' }} />
        </div>

        {/* Chart 3: Species Diversity Over Time */}
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Bird className="w-4 h-4 text-blue-600" /> Species Diversity Over Time
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Number of unique species detected per day</p>
            </div>
            <div className="flex gap-2">
              <select
                value={diversityYear}
                onChange={(e) => { setDiversityYear(e.target.value); setDiversityMonth(''); }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={diversityMonth}
                onChange={(e) => setDiversityMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, parseInt(m) - 1, 1).toLocaleString('default', { month: 'short' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ReactECharts option={diversityOption} style={{ height: '280px' }} />
        </div>

        {/* Chart 4: Month by Month Abundance Bar Chart */}
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" /> Month by Month Vocal Activity Volume
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Monthly total bioacoustic call detections across the survey period</p>
          </div>
          <ReactECharts option={monthlyOption} style={{ height: '280px' }} />
        </div>

        {/* Chart 5: Diurnal Activity Pattern (24-Hour Radial Clock - Total) */}
        <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" /> Diurnal Activity Pattern (24-Hour Radial Clock - Total)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Pick a date to see total detections per hour for that day</p>
            </div>
            <select
              value={radialDate}
              onChange={(e) => setRadialDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <ReactECharts option={radialOption} style={{ height: '360px' }} />
        </div>
      </div>

      {/* Species Detection Matrix by Hour of Day */}
      <CommonSpeciesHourMatrix detections={rawDetections} />

      {selectedDetection && (
        <AudioPlayerModal
          detection={selectedDetection}
          currentRole={currentRole}
          onClose={() => setSelectedDetection(null)}
        />
      )}
    </div>
  );
}
