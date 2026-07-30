'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Play, 
  Check, 
  X, 
  RotateCcw, 
  Filter, 
  Search, 
  Calendar, 
  Volume2, 
  Sliders, 
  ShieldCheck, 
  Sparkles,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { formatPercent } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AudioPlayerModal } from '@/components/audio/AudioPlayerModal';

export default function ReviewQueuePage() {
  const { currentRole } = useRole();
  const [selectedDetection, setSelectedDetection] = useState<any | null>(null);

  // Filters State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'confidence'>('newest');

  // Supabase Data
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviewData() {
      setLoading(true);
      try {
        const [{ data: projs }, { data: sitesData }, { data: stnData }, { data: detData }] = await Promise.all([
          supabase.from('projects').select('*').eq('project_type', 'Live').order('name'),
          supabase.from('sites').select('*').order('name'),
          supabase.from('stations').select('*').order('station_name'),
          supabase.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(200)
        ]);

        const liveProjectIds = new Set((projs || []).map(p => p.id));
        const liveSites = (sitesData || []).filter(s => liveProjectIds.has(s.project_id));
        const liveDets = (detData || []).filter(d => 
          d.station_id === 'Test_Lab_1' || 
          d.station_name === 'Inside BirdLab' || 
          d.station_name?.includes('BirdLab') ||
          d.station_id?.includes('Test_Lab')
        );

        setProjectsList(projs || []);
        setSitesList(liveSites);
        setStationsList(stnData || []);
        setDetections(liveDets);
      } catch (err) {
        console.error('Error loading review queue data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadReviewData();
  }, []);

  const availableSites = selectedProjectId === 'ALL'
    ? sitesList
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

  // Filter Detections
  let filtered = detections.filter((det) => {
    const common = det.common_name || '';
    const sci = det.scientific_name || '';
    const matchesSearch = common.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sci.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStation = true;
    if (selectedStationId !== 'ALL') {
      matchesStation = det.station_id === selectedStationId || det.station_name === selectedStationId;
    }

    return matchesSearch && matchesStation;
  });

  // Sort Detections
  if (sortOrder === 'newest') {
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } else if (sortOrder === 'oldest') {
    filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } else if (sortOrder === 'confidence') {
    filtered.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }

  // Handle Verification Decision
  const handleVerify = async (detId: string, decision: 'YES' | 'NO') => {
    try {
      const { error } = await supabase
        .from('live_detections')
        .update({
          reviewed: true,
          verified: decision === 'YES',
          verification_status: decision
        })
        .eq('id', detId);

      if (error) {
        console.error('Error updating verification_status:', error);
      }

      setDetections((prev) =>
        prev.map((d) => (d.id === detId ? { ...d, reviewed: true, verified: decision === 'YES', verification_status: decision } : d))
      );
    } catch (err) {
      console.error('Verification error:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Researcher Bioacoustic Review Queue</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Human-in-the-loop expert validation for AI classifications. Confirm or reject predictions with station audio playback.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-3.5 py-2 rounded-2xl border border-indigo-100">
          <Sparkles className="w-4 h-4 text-indigo-600" /> {filtered.length} Audio Items Pending Review
        </div>
      </div>

      {/* 3 Scope Dropdowns + Search & Sort Toolbar */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-3">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Review Scope Filter (Select Project ➔ Site ➔ Recorder Node):</span>
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

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by species common or scientific name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="font-extrabold text-slate-700 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" /> Sort Order:
            </label>
            <select
              value={sortOrder}
              onChange={(e: any) => setSortOrder(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="confidence">Highest Confidence</option>
            </select>
          </div>
        </div>
      </div>

      {/* Detections Review Cards Grid */}
      {loading ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 animate-pulse">
          <CheckSquare className="w-8 h-8 text-indigo-400 mx-auto animate-bounce" />
          <p className="text-xs text-slate-500 mt-2 font-bold">Loading Bioacoustic Review Queue...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <CheckSquare className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-base font-black text-slate-900">Review Queue Clear!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No bioacoustic detections match the selected scope filter for review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const isConfirmed = item.verified || item.verification_status === 'YES';

            return (
              <div
                key={item.id}
                className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Header info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
                        <Volume2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">{item.common_name}</h3>
                        <p className="text-xs italic text-slate-500 font-medium">{item.scientific_name || 'Taxon'}</p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                      {formatPercent(item.confidence)}
                    </span>
                  </div>

                  {/* Metadata Box */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Station Node: <strong className="text-slate-900">{item.station_name || item.station_id}</strong></span>
                      <span className="flex items-center gap-1 font-mono text-slate-400">
                        <Calendar className="w-3.5 h-3.5" /> {item.time_str || ''} ({item.date_str || 'Today'})
                      </span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  {isConfirmed ? (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" /> Confirmed Taxon Identification (YES)
                    </div>
                  ) : item.verification_status === 'NO' ? (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                      <X className="w-4 h-4 text-rose-600" /> Rejected Prediction (NO)
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600" /> Pending Researcher Verification
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 gap-3">
                  <button
                    onClick={() => setSelectedDetection(item)}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition"
                  >
                    <Play className="w-4 h-4 fill-white" /> Listen Audio
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerify(item.id, 'NO')}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-black transition border border-rose-200 flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                      onClick={() => handleVerify(item.id, 'YES')}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Confirm Species (YES)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Audio Player Modal */}
      {selectedDetection && (
        <AudioPlayerModal
          detection={selectedDetection}
          onClose={() => setSelectedDetection(null)}
          currentRole={currentRole}
        />
      )}
    </div>
  );
}
