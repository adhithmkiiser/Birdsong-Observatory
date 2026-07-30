'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Cpu, Radio, Sparkles, Layers, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Dynamically import SatelliteMap component with ssr: false
const SatelliteMap = dynamic(() => import('@/components/map/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-[24px] bg-slate-100 border border-slate-200 flex flex-col items-center justify-center space-y-3 text-slate-500 animate-pulse">
      <MapPin className="w-8 h-8 text-indigo-600 animate-bounce" />
      <div className="font-extrabold text-xs">Loading High-Resolution Satellite Map...</div>
    </div>
  )
});

export default function MapPage() {
  const [selectedProjectId, setSelectedProjectId] = React.useState('ALL');
  const [selectedSiteId, setSelectedSiteId] = React.useState('ALL');
  const [selectedStationId, setSelectedStationId] = React.useState('ALL');

  const [projectsList, setProjectsList] = React.useState<any[]>([]);
  const [sitesList, setSitesList] = React.useState<any[]>([]);
  const [stationsList, setStationsList] = React.useState<any[]>([]);

  React.useEffect(() => {
    async function loadMapFilters() {
      const [{ data: projs }, { data: sitesData }, { data: stnData }] = await Promise.all([
        supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
        supabase.from('sites').select('*').order('name'),
        supabase.from('stations').select('*').order('station_name')
      ]);

      setProjectsList(projs || []);
      setSitesList(sitesData || []);
      setStationsList(stnData || []);
    }

    loadMapFilters();
  }, []);

  const liveProjectIds = new Set(projectsList.map(p => p.id));
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

  return (
    <div className="space-y-6 pb-12 pt-2 max-w-6xl mx-auto px-4 md:px-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">GIS Satellite Field Station Network</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Interactive high-resolution satellite imagery map showing deployed acoustic recorder nodes across canopy and reserve habitats.
          </p>
        </div>
      </div>

      {/* 3 Connected Scope Dropdowns */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>GIS Map Scope Filter (Select Project ➔ Site ➔ Recorder Hardware Node):</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">1. Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Projects ({projectsList.length})</option>
              {projectsList.map((p) => (
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

      {/* Framed Curved-Edge Box Container for Satellite Map */}
      <div className="mt-4 mb-8">
        <SatelliteMap />
      </div>
    </div>
  );
}
