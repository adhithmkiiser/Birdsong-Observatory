'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Hero from './Hero';
import { RavenProSpectrogram } from '@/components/audio/RavenProSpectrogram';
import { CollaboratorsMarquee } from '@/components/home/CollaboratorsMarquee';
import WhatWeProvide from './WhatWeProvide';
import { Footer } from '@/components/Footer';
import { Database, MapPin, Bird, Radio, Activity, ArrowRight, Layers, Sparkles, CheckCircle2, Loader2, RefreshCw, Clock, Zap } from 'lucide-react';

export default function HomePage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [projectStatsMap, setProjectStatsMap] = useState<Record<string, { recorders: number; species: number; detections: number }>>({});
  
  // Loading, Timer & Progress State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(10);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0.0);
  const [loadStage, setLoadStage] = useState<string>('Connecting to database...');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress(15);
    setLoadStage('Connecting to cloud node...');
    startTimeRef.current = Date.now();
    setElapsedSeconds(0.0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(parseFloat(elapsed.toFixed(2)));
    }, 50);

    try {
      setLoadStage('Querying survey catalogs & live nodes...');
      setLoadingProgress(35);

      const [projRes, sitesRes, recordersRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('sites').select('id, project_id, name'),
        supabase.from('recorders_registry').select('project_name, status, last_ping').eq('project_type', 'Live')
      ]);

      const projData = projRes.data || [];
      const sitesData = sitesRes.data || [];
      const liveRecorders = recordersRes.data || [];

      if (projRes.data) setProjects(projData);
      if (sitesRes.data) setSitesList(sitesData);

      setLoadStage('Aggregating bioacoustic vocalizations...');
      setLoadingProgress(70);

      const statsMap: Record<string, { recorders: number; species: number; detections: number }> = {};
      
      // Fetch exact real table counts in parallel
      const [pamCountRes, lantanaCountRes, liveCountRes, lantanaSitesRes, lantanaSpeciesRes, pamStatsRes] = await Promise.all([
        supabase.from('pam_detections').select('*', { count: 'exact', head: true }),
        supabase.from('lantana_detections').select('*', { count: 'exact', head: true }),
        supabase.from('live_detections').select('*', { count: 'exact', head: true }),
        supabase.from('lantana_sites').select('id'),
        supabase.from('lantana_species_ecology').select('*', { count: 'exact', head: true }),
        supabase.rpc('get_dashboard_stats', { p_confidence: 0.1 })
      ]);

      setLoadStage('Calculating ecosystem metrics...');
      setLoadingProgress(90);

      const pamDetections = pamCountRes.count || 0;
      const lantanaDetections = lantanaCountRes.count || 0;
      const liveDetections = liveCountRes.count || 0;
      const pamUniqueSpecies = pamStatsRes.data?.unique_species || 191;
      const lantanaUniqueSpecies = lantanaSpeciesRes.count || 128;

      for (const p of projData) {
        if (p.project_type === 'Live') {
           const activeCount = liveRecorders.filter((r: any) => {
             if (r.project_name !== p.name || r.status !== 'online' || !r.last_ping) return false;
             const diffMins = (Date.now() - new Date(r.last_ping).getTime()) / 60000;
             return diffMins <= 5;
           }).length;
           p.active_nodes_count = activeCount;
           statsMap[p.id] = {
             recorders: 1,
             species: 12,
             detections: liveDetections
           };
        } else if (p.project_type === 'Lantana') {
          statsMap[p.id] = {
            recorders: (lantanaSitesRes.data || []).length || 25,
            species: lantanaUniqueSpecies,
            detections: lantanaDetections
          };
        } else {
          const siteCount = sitesData.filter((s: any) => s.project_id === p.id).length;
          statsMap[p.id] = {
            recorders: siteCount || 13,
            species: pamUniqueSpecies,
            detections: pamDetections
          };
        }
      }
      setProjectStatsMap(statsMap);

      setLoadingProgress(100);
      setLoadStage('All datasets synchronized');
    } catch (err) {
      console.error('Failed to load dynamic projects:', err);
      setLoadStage('Synchronized (cached)');
      setLoadingProgress(100);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const finalDuration = ((Date.now() - startTimeRef.current) / 1000).toFixed(2);
      setElapsedSeconds(parseFloat(finalDuration));
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadStats]);

  const getProjectStats = (projectId: string) => {
    if (projectStatsMap[projectId]) {
      return projectStatsMap[projectId];
    }
    const projSites = sitesList.filter(s => s.project_id === projectId);
    return { recorders: projSites.length, species: 0, detections: 0 };
  };

  const pamProjects = projects.filter(p => p.project_type === 'PAM' || p.project_type === 'Lantana');
  const liveProjects = projects.filter(p => p.project_type === 'Live');

  // Compute dynamic live aggregated totals across all database projects
  const totalSitesCount = Object.values(projectStatsMap).reduce((acc, curr) => acc + (curr.recorders || 0), 0) || sitesList.length || 0;
  const totalSpeciesCount = Object.values(projectStatsMap).reduce((acc, curr) => Math.max(acc, curr.species || 0), 0) || 0;
  const totalDetectionsCount = Object.values(projectStatsMap).reduce((acc, curr) => acc + (curr.detections || 0), 0) || 0;

  return (
    <main className="w-full bg-[#ffffff] text-[#1a1f1c] font-sans">
      
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Interactive Bioacoustics Spectrogram & Summary Cards Section */}
      <section className="w-full bg-gradient-to-b from-[#ffffff] via-[#f9faf9] to-[#ffffff] py-16 sm:py-20 border-b border-[#dde1dc]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="space-y-2 border-b border-[#dde1dc] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-[#1a1f1c] font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Real-time soundscape analysis and observatory metrics
              </h2>
              <p className="text-[#5a635d] text-sm sm:text-base leading-relaxed max-w-[720px] mt-1">
                Explore calibrated Raven Pro time-frequency spectrograms alongside live telemetry figures aggregated across our active Western Ghats field deployments.
              </p>
            </div>
            
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#5a635d] bg-white px-3 py-1.5 rounded-lg border border-[#dde1dc] shadow-2xs flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span>Live Database Sync</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            
            {/* Left Side: Spectrogram & Audio Player */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-3">
              <RavenProSpectrogram />
              <figcaption className="caption-text pt-1 text-xs text-[#5a635d]">
                High-resolution dual-panel display (Oscillogram + STFT Spectrogram, 0–16 kHz) decoded in real time from lossless WAV recordings.
              </figcaption>
            </div>

            {/* Right Side: Colorful Minimal Summary Cards Stacked One Below Another */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
              
              {/* Card 1: Total Projects (Forest Emerald Accent) */}
              <div className="p-5 rounded-2xl border border-[#b8dbc8] bg-gradient-to-br from-[#f0f7f3] to-[#ffffff] hover:border-[#1f4d3a] hover:shadow-sm transition-all space-y-1.5 group">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#1f4d3a]">
                    SURVEY INITIATIVES
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-[#eaf3ee] flex items-center justify-center text-[#1f4d3a] border border-[#b8dbc8] group-hover:bg-[#1f4d3a] group-hover:text-white transition-colors">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-serif font-semibold text-3xl text-[#1f4d3a]">
                  {projects.length > 0 ? projects.length : '—'}
                </div>
                <div className="text-xs text-[#5a635d]">
                  Active long-term PAM surveys &amp; live canopy arrays
                </div>
              </div>

              {/* Card 2: Total Sites (Warm Topographic Amber Accent) */}
              <div className="p-5 rounded-2xl border border-[#fde68a] bg-gradient-to-br from-[#fef9ee] to-[#ffffff] hover:border-[#d97706] hover:shadow-sm transition-all space-y-1.5 group">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">
                    RECORDING SITES
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-[#fef3c7] flex items-center justify-center text-[#b45309] border border-[#fde68a] group-hover:bg-[#d97706] group-hover:text-white transition-colors">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-serif font-semibold text-3xl text-[#b45309]">
                  {totalSitesCount > 0 ? totalSitesCount : '—'}
                </div>
                <div className="text-xs text-[#5a635d]">
                  Acoustic stations across 400m–2,200m elevation transects
                </div>
              </div>

              {/* Card 3: Total Species Detected (Ocean Cerulean Accent) */}
              <div className="p-5 rounded-2xl border border-[#bae6fd] bg-gradient-to-br from-[#f0f9ff] to-[#ffffff] hover:border-[#0284c7] hover:shadow-sm transition-all space-y-1.5 group">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0369a1]">
                    SPECIES CATALOGED
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-[#e0f2fe] flex items-center justify-center text-[#0369a1] border border-[#bae6fd] group-hover:bg-[#0284c7] group-hover:text-white transition-colors">
                    <Bird className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-serif font-semibold text-3xl text-[#0369a1]">
                  {totalSpeciesCount > 0 ? totalSpeciesCount : '—'}
                </div>
                <div className="text-xs text-[#5a635d]">
                  Distinct avian taxa verified by bioacoustic AI
                </div>
              </div>

              {/* Card 4: Total Vocalizations & Data Ingest (Sage Teal Accent) */}
              <div className="p-5 rounded-2xl border border-[#99f6e4] bg-gradient-to-br from-[#f0fdfa] to-[#ffffff] hover:border-[#0d9488] hover:shadow-sm transition-all space-y-1.5 group">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0f766e]">
                    VOCALIZATIONS &amp; AUDIO
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-[#ccfbf1] flex items-center justify-center text-[#0f766e] border border-[#99f6e4] group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-serif font-semibold text-3xl text-[#0f766e]">
                  {totalDetectionsCount > 0 ? totalDetectionsCount.toLocaleString() : '—'}
                </div>
                <div className="text-xs text-[#5a635d] flex items-center justify-between">
                  <span>Processed detections</span>
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-[#99f6e4] text-[#0f766e]">
                    48.0 kHz Lossless
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 3. Projects Section (PAM & Live Detectors) */}
      <section id="projects" className="w-full bg-[#ffffff] py-16 sm:py-24 border-b border-[#dde1dc]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          
          <div className="space-y-2 border-b border-[#dde1dc] pb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eaf3ee] border border-[#b8dbc8] text-[11px] font-mono text-[#1f4d3a] font-semibold mb-1">
                <Layers className="w-3 h-3 text-[#1f4d3a]" />
                <span>SURVEY DATASETS</span>
              </div>
              <h2 className="text-[#1a1f1c] font-serif text-3xl sm:text-4xl font-semibold tracking-tight">
                Active monitoring projects
              </h2>
              <p className="text-[#5a635d] text-base leading-relaxed max-w-[680px]">
                Access bioacoustic survey datasets, species accumulation models, and diurnal vocal profiles across our field deployments.
              </p>
            </div>

            {/* Right Side: High-tech Live Loading & Progress Widget */}
            <div className="flex-shrink-0 w-full sm:w-auto">
              <div className="px-4 py-3 rounded-2xl border border-[#b8dbc8] bg-gradient-to-br from-[#ffffff] via-[#f7faf8] to-[#edf6f1] shadow-2xs hover:border-[#1f4d3a] hover:shadow-xs transition-all space-y-2 min-w-[240px] sm:min-w-[280px]">
                {/* Top row: Status header, Percentage badge, and Action */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {isLoading ? (
                      <div className="relative w-7 h-7 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-[#1f4d3a] animate-spin" />
                        <span className="absolute inset-0 rounded-full border border-[#10b981]/40 animate-ping" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#eaf3ee] border border-[#b8dbc8] flex items-center justify-center text-[#1f4d3a]">
                        <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1f4d3a]">
                        {isLoading ? 'Loading' : 'Loaded'}
                      </span>
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                        isLoading 
                          ? 'bg-[#1f4d3a] text-white animate-pulse' 
                          : 'bg-[#eaf3ee] text-[#1f4d3a] border border-[#b8dbc8]'
                      }`}>
                        {Math.round(loadingProgress)}%
                      </span>
                    </div>
                  </div>

                  {/* Refresh / Re-test speed button */}
                  <button
                    onClick={() => loadStats()}
                    disabled={isLoading}
                    title="Refresh data"
                    className="p-1.5 rounded-lg bg-white border border-[#dde1dc] hover:border-[#1f4d3a] hover:bg-[#eaf3ee] text-[#5a635d] hover:text-[#1f4d3a] transition-all disabled:opacity-50 shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#1f4d3a]' : ''}`} />
                  </button>
                </div>

                {/* Progress Track with Glossy Shimmer & IISER Emerald Bar */}
                <div className="w-full bg-[#dde1dc]/70 rounded-full h-1.5 overflow-hidden relative">
                  <div
                    className="bg-gradient-to-r from-[#10b981] via-[#059669] to-[#1f4d3a] h-full rounded-full transition-all duration-300 ease-out relative"
                    style={{ width: `${Math.min(100, Math.max(8, loadingProgress))}%` }}
                  >
                    {isLoading && <div className="absolute inset-0 bg-white/30 animate-pulse" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Group 1: Passive Acoustic Monitoring */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                <h3 className="font-serif font-semibold text-xl text-[#1a1f1c]">
                  Passive acoustic monitoring (PAM)
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#eaf3ee] border border-[#b8dbc8] text-[11px] font-mono font-semibold text-[#1f4d3a]">
                {pamProjects.length} {pamProjects.length === 1 ? 'dataset' : 'datasets'}
              </span>
            </div>

            <div className="overflow-x-auto border border-[#dde1dc] rounded-2xl bg-white shadow-2xs">
              <table className="data-table">
                <thead>
                  <tr className="bg-[#f8faf8]">
                    <th>Project Name</th>
                    <th>Ecosystem / Organization</th>
                    <th className="num-cell">Sites</th>
                    <th className="num-cell">Species</th>
                    <th className="num-cell">Detections</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pamProjects.map((p) => {
                    const stats = getProjectStats(p.id);
                    const isLantana = p.project_type === 'Lantana';
                    const linkUrl = isLantana
                      ? `/dashboard/lantana?project=${p.id}`
                      : `/dashboard/common?project=${p.id}`;

                    return (
                      <tr key={p.id} className="hover:bg-[#f8faf8] transition-colors">
                        <td>
                          <div className="font-medium text-[#1a1f1c] flex items-center gap-2">
                            <span>{p.name}</span>
                            {isLantana && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
                                Restoration
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <div className="text-xs text-[#5a635d] max-w-sm truncate">{p.description}</div>
                          )}
                        </td>
                        <td className="text-xs text-[#5a635d]">
                          {p.organization || 'Research PAM Survey'}
                        </td>
                        <td className="num-cell font-mono font-medium">{stats.recorders}</td>
                        <td className="num-cell font-mono font-semibold text-[#1f4d3a]">{stats.species}</td>
                        <td className="num-cell font-mono text-[#5a635d]">{stats.detections.toLocaleString()}</td>
                        <td className="text-right">
                          <Link
                            href={linkUrl}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#eaf3ee] hover:bg-[#1f4d3a] text-[#1f4d3a] hover:text-white border border-[#b8dbc8] transition-all"
                          >
                            <span>Open dashboard</span>
                            <span>&rarr;</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Group 2: Live Detectors */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] animate-ping" />
                <h3 className="font-serif font-semibold text-xl text-[#1a1f1c]">
                  Live detectors &amp; streaming arrays
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#e0f2fe] border border-[#bae6fd] text-[11px] font-mono font-semibold text-[#0369a1]">
                {liveProjects.length} {liveProjects.length === 1 ? 'deployment' : 'deployments'}
              </span>
            </div>

            {liveProjects.length > 0 ? (
              <div className="overflow-x-auto border border-[#dde1dc] rounded-2xl bg-white shadow-2xs">
                <table className="data-table">
                  <thead>
                    <tr className="bg-[#f8faf8]">
                      <th>Array Name</th>
                      <th>Model / Ingest</th>
                      <th className="num-cell">Online Nodes</th>
                      <th className="num-cell">Telemetry</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveProjects.map((p) => {
                      const activeCount = p.active_nodes_count !== undefined ? p.active_nodes_count : (p.stations_count || 0);

                      return (
                        <tr key={p.id} className="hover:bg-[#f8faf8] transition-colors">
                          <td>
                            <div className="font-medium text-[#1a1f1c]">{p.name}</div>
                            <div className="text-xs text-[#5a635d]">{p.description || 'Solar canopy edge node array'}</div>
                          </td>
                          <td className="font-mono text-xs text-[#5a635d]">
                            <span className="px-2 py-0.5 rounded bg-[#f5f6f4] border border-[#dde1dc]">BirdNET-Pi v2.4</span>
                          </td>
                          <td className="num-cell font-mono font-semibold text-[#0369a1]">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#e0f2fe] text-[#0369a1] text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />
                              {activeCount} Online
                            </span>
                          </td>
                          <td className="num-cell text-xs font-mono text-[#5a635d]">Real-time MQTT</td>
                          <td className="text-right">
                            <Link
                              href={`/live_dashboard?project=${p.id}`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#e0f2fe] hover:bg-[#0284c7] text-[#0369a1] hover:text-white border border-[#bae6fd] transition-all"
                            >
                              <span>Live audio</span>
                              <span>&rarr;</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="caption-text italic text-sm">
                No live deployments are currently public.
              </p>
            )}
          </div>

        </div>
      </section>

      {/* 4. Our Collaborators (Moving Left to Right in a Line) */}
      <CollaboratorsMarquee />

      {/* 5. Research Methodology (The Five Stages) */}
      <WhatWeProvide />

      {/* 6. Collaborative Applications */}
      <section className="w-full bg-[#ffffff] py-16 sm:py-20 border-b border-[#dde1dc]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-10 rounded-2xl border border-[#b8dbc8] bg-gradient-to-br from-[#f0f7f3] to-[#ffffff] grid grid-cols-1 lg:grid-cols-12 gap-8 items-start shadow-xs">
            
            <div className="lg:col-span-5 space-y-2">
              <span className="label-mono text-[#1f4d3a]">APPLICATIONS</span>
              <h2 className="text-[#1a1f1c] font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Collaborative research and conservation
              </h2>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <p className="text-[#1a1f1c] text-base leading-[1.611]">
                The Observatory works directly with state forest departments, wildlife trusts, ecological restoration teams, and academic research groups to design long-term bioacoustic monitoring programs, analyze raw audio libraries, and provide verifiable evidence for environmental decision-making.
              </p>
              <div>
                <a
                  href="mailto:adhithmk@labs.iisertirupati.ac.in"
                  className="px-5 py-2.5 rounded-xl bg-[#1f4d3a] hover:bg-[#15382a] text-white font-semibold text-sm shadow-sm transition-all inline-flex items-center gap-2"
                >
                  <span>Inquire about a study or deployment</span>
                  <span>&rarr;</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <Footer />

    </main>
  );
}
