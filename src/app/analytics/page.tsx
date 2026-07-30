'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Layers, 
  ShieldCheck, 
  FileSpreadsheet, 
  Filter,
  Activity,
  Cpu,
  Bird
} from 'lucide-react';
import { AccumulationChart } from '@/components/charts/AccumulationChart';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { supabase } from '@/lib/supabase';

export default function AnalyticsPage() {
  // 3-level Toolbar States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');

  const [liveProjects, setLiveProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalyticsData() {
      setLoading(true);
      try {
        const [{ data: projs }, { data: sitesData }, { data: stnData }, { data: detData }] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('sites').select('*').order('name'),
          supabase.from('stations').select('*').order('station_name'),
          supabase.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(200)
        ]);

        // STRICT FILTER: Only real Live stream daemons (Inside BirdLab / Test_Lab_1)
        const liveDetsFiltered = (detData || []).filter((d: any) => 
          d.station_id === 'Test_Lab_1' || 
          d.station_name === 'Inside BirdLab' || 
          d.station_name?.includes('BirdLab') || 
          d.station_id?.includes('Test_Lab')
        );

        setLiveProjects(projs || []);
        setSitesList(sitesData || []);
        setStationsList(stnData || []);
        setDetections(liveDetsFiltered);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalyticsData();
  }, []);

  const liveProjectIds = new Set(liveProjects.map(p => p.id));
  const availableSites = selectedProjectId === 'ALL'
    ? sitesList.filter(s => liveProjectIds.has(s.project_id))
    : sitesList.filter(s => s.project_id === selectedProjectId);

  const availableStations = ['Test_Lab_1'];

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedSiteId('ALL');
    setSelectedStationId('ALL');
  };

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedStationId('ALL');
  };

  const filteredDetections = detections.filter((det) => {
    let matchesStation = true;
    if (selectedStationId !== 'ALL') {
      matchesStation = det.station_id === selectedStationId || det.station_name === selectedStationId;
    }
    return matchesStation;
  });

  const activeStationsCount = availableStations.length;
  const totalDetectionsCount = filteredDetections.length;
  const uniqueSpeciesSet = new Set<string>(filteredDetections.map(d => d.common_name).filter(Boolean));
  const speciesRichness = uniqueSpeciesSet.size;

  // Calculate dynamic Shannon Diversity Index H' = - sum(p_i * ln(p_i))
  let shannonDiversity = 0;
  if (filteredDetections.length > 0 && speciesRichness > 0) {
    const countsMap: { [key: string]: number } = {};
    filteredDetections.forEach(d => {
      countsMap[d.scientific_name || d.common_name] = (countsMap[d.scientific_name || d.common_name] || 0) + 1;
    });

    const total = filteredDetections.length;
    Object.values(countsMap).forEach(count => {
      const p = count / total;
      if (p > 0) {
        shannonDiversity -= p * Math.log(p);
      }
    });
  }

  // Format top species data for chart dynamically
  const speciesFrequencyMap: { [key: string]: number } = {};
  filteredDetections.forEach(d => {
    speciesFrequencyMap[d.common_name] = (speciesFrequencyMap[d.common_name] || 0) + 1;
  });

  const topSpeciesChartData = Object.entries(speciesFrequencyMap)
    .map(([species, detections]) => ({ species, detections }))
    .sort((a, b) => b.detections - a.detections)
    .slice(0, 10);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Advanced Bioacoustic Analytics & Richness Curves</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Species accumulation modeling, diurnal call density distribution, and site-by-site bioacoustic diversity analysis.
          </p>
        </div>

        <button className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 self-start md:self-auto">
          <Download className="w-4 h-4" /> Export Analytics CSV
        </button>
      </div>

      {/* 2 Filter Dropdowns: Project & Site Filter Panel */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Filter Analytics Scope:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">1. Select Live Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Live Projects ({liveProjects.length})</option>
              {liveProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">2. Select Site</label>
            <select
              value={selectedSiteId}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Sites in Project ({availableSites.length})</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">3. Select Recorder Node</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Hardware Nodes ({availableStations.length})</option>
              {availableStations.map((id: string) => (
                <option key={id} value={id}>
                  {id === 'Test_Lab_1' ? 'Inside BirdLab (Test_Lab_1)' : id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Total Detections</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalDetectionsCount.toLocaleString()}</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Uploaded scope calls</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Species Richness</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{speciesRichness} species</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Unique identified taxa</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Bird className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Recording Nodes</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{activeStationsCount} Active Sites</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Monitored field nodes</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Shannon Diversity H&apos;</span>
            <div className="text-2xl font-black text-slate-900 mt-1">H&apos; = {shannonDiversity.toFixed(2)}</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {shannonDiversity > 0 ? 'Calculated diversity index' : 'Pending cloud data'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Analytics Charts Stacked Vertically */}
      <div className="space-y-6">
        {/* 1. Species Accumulation Curve */}
        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Species Accumulation Curve (15-Day Transect)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Cumulative unique species counts reaching plateau as monitoring progresses.</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">Transect Curve</span>
          </div>
          <AccumulationChart />
        </div>

        {/* 2. Diurnal Vocalization Activity Pattern */}
        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" /> Diurnal Vocalization Activity Pattern (24-Hour)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Hourly call frequency distribution across selected project & site scope.</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">24-Hour Scope</span>
          </div>
          <DiurnalChart />
        </div>

        {/* 3. Top Detected Species by Call Volume */}
        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Bird className="w-4 h-4 text-emerald-600" /> Top Detected Species by Call Volume (Filtered Scope)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Ranked frequency of bird vocalization detections for selected project and site.</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">Ranked Scope</span>
          </div>
          <TopSpeciesChart data={topSpeciesChartData} />
        </div>
      </div>
    </div>
  );
}
