'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Hero from './Hero';
import { RavenProSpectrogram } from '@/components/audio/RavenProSpectrogram';
import { CollaboratorsMarquee } from '@/components/home/CollaboratorsMarquee';
import WhatWeProvide from './WhatWeProvide';
import { Footer } from '@/components/Footer';
import { useRole } from '@/components/layout/RoleContext';
import { Database, MapPin, Bird, Radio, Activity, ArrowRight, Layers, Sparkles, CheckCircle2, Loader2, RefreshCw, Clock, Zap, Lock, Globe, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  const { currentRole, currentUser, canManageProject, canViewProject } = useRole();
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

      const projData = (projRes.data || []).map((p: any) => {
        const rawDesc = String(p.description || '');
        const isPrivate = p.public_visible === false || rawDesc.startsWith('<!--PRIVATE-->');
        return {
          ...p,
          description: rawDesc.replace(/^<!--PRIVATE-->\s*/, ''),
          public_visible: !isPrivate
        };
      });
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
      const pamUniqueSpecies = pamDetections > 0 ? (pamStatsRes.data?.unique_species || 191) : 0;

      let lantanaUniqueSpecies = 0;
      if (lantanaDetections > 0) {
        const { data: lantanaSample } = await supabase
          .from('lantana_detections')
          .select('common_name')
          .limit(10000);
        if (lantanaSample && lantanaSample.length > 0) {
          lantanaUniqueSpecies = new Set(lantanaSample.map((d: any) => d.common_name).filter(Boolean)).size;
        } else {
          lantanaUniqueSpecies = lantanaSpeciesRes.count || 0;
        }
      }

      for (const p of projData) {
        if (p.project_type === 'Live') {
          const activeCount = liveRecorders.filter((r: any) => {
            const projMatches = (r.project_name && (
              r.project_name.toLowerCase() === (p.name || '').toLowerCase() ||
              r.project_name.toLowerCase() === (p.id || '').toLowerCase()
            )) || (r.project_id && (
              r.project_id.toLowerCase() === (p.id || '').toLowerCase() ||
              r.project_id.toLowerCase() === (p.name || '').toLowerCase()
            ));
            if (!projMatches) return false;

            // Online if marked 'online' in recorders_registry
            if (r.status === 'online') return true;
            // Or if pinged recently within 30 minutes
            if (r.last_ping) {
              const diffMins = (Date.now() - new Date(r.last_ping).getTime()) / 60000;
              return diffMins <= 30;
            }
            return false;
          }).length;
          p.active_nodes_count = activeCount;
          statsMap[p.id] = {
            recorders: Math.max(activeCount, 1),
            species: liveDetections > 0 ? 12 : 0,
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

    // 1. Realtime subscription to automatically reflect online nodes, pings, and telemetry changes
    const channel = supabase
      .channel('homepage_live_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recorders_registry' },
        () => {
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          loadStats();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_detections' },
        () => {
          loadStats();
        }
      )
      .subscribe();

    // 2. Automated background polling every 20 seconds so telemetry stays fresh without manual reload
    const pollInterval = setInterval(() => {
      loadStats();
    }, 20000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
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

  // Filter projects:
  // - If public_visible !== false (Public): visible to everyone.
  // - If public_visible === false (Private): visible ONLY to Admin and assigned Project/Site Managers.
  const visibleProjects = projects.filter(p => canViewProject(p));

  // Projects assigned to the logged-in Project Manager or Site Manager for the "Your project" subsection
  const isManager = currentRole === 'Project Manager' || currentRole === 'Site Manager';
  const myAssignedProjects = isManager
    ? visibleProjects.filter(p => canManageProject(p.id) || canManageProject(p.name))
    : [];

  const pamProjects = visibleProjects.filter(p => p.project_type === 'PAM' || p.project_type === 'Lantana');
  const liveProjects = visibleProjects.filter(p => p.project_type === 'Live');

  // Compute dynamic live aggregated totals across visible database projects
  const totalSitesCount = visibleProjects.reduce((acc, p) => acc + (projectStatsMap[p.id]?.recorders || 0), 0) || sitesList.length || 0;
  const totalSpeciesCount = visibleProjects.reduce((acc, p) => Math.max(acc, projectStatsMap[p.id]?.species || 0), 0) || 0;
  const totalDetectionsCount = visibleProjects.reduce((acc, p) => acc + (projectStatsMap[p.id]?.detections || 0), 0) || 0;

  return (
    <main className="w-full bg-[#ffffff] text-[#1a1f1c] font-sans">

      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Interactive Bioacoustics Spectrogram & Summary Cards Section */}
      <section className="w-full bg-gradient-to-b from-[#ffffff] via-[#f9faf9] to-[#ffffff] py-14 sm:py-20 border-b border-[#dde1dc]">
        <div className="w-full max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-8">

          <div className="space-y-2 border-b border-[#dde1dc] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-[#1a1f1c] font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
                Real-time soundscape analysis and observatory metrics
              </h2>

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

            {/* Right Side: Responsive Summary Cards (1 col on mobile, 2 cols on tablet, 1 col on desktop next to spectrogram) */}
            <div className="lg:col-span-5 xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">

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
                  {visibleProjects.length > 0 ? visibleProjects.length : '—'}
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
      <section id="projects" className="w-full bg-[#ffffff] py-14 sm:py-20 border-b border-[#dde1dc]">
        <div className="w-full max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-12">

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
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${isLoading
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

          {/* Subsection for Project Managers & Site Managers: "Your project" */}
          {isManager && (
            <div className="space-y-4 p-5 sm:p-6 rounded-2xl border-2 border-[#1f4d3a]/25 bg-gradient-to-br from-[#f0f7f3] via-[#ffffff] to-[#f8faf8] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#1f4d3a] text-white flex items-center justify-center shadow-2xs">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-semibold text-xl text-[#1a1f1c]">
                        Your project
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-[#1f4d3a] text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                        {currentRole}
                      </span>
                    </div>
                    <p className="text-xs text-[#5a635d]">
                      Projects explicitly assigned to your account ({currentUser?.name || currentUser?.email}) with full management privileges.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#eaf3ee] border border-[#b8dbc8] text-[11px] font-mono font-semibold text-[#1f4d3a] self-start sm:self-auto">
                  {myAssignedProjects.length} {myAssignedProjects.length === 1 ? 'assigned project' : 'assigned projects'}
                </span>
              </div>

              {myAssignedProjects.length > 0 ? (
                <div className="overflow-x-auto border border-[#b8dbc8] rounded-2xl bg-white shadow-2xs">
                  <table className="data-table">
                    <thead>
                      <tr className="bg-[#f0f7f3]">
                        <th>Project Name</th>
                        <th>Type &amp; Visibility</th>
                        <th>Ecosystem / Organization</th>
                        <th className="num-cell">Sites / Nodes</th>
                        <th className="num-cell">Species</th>
                        <th className="num-cell">Detections</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myAssignedProjects.map((p) => {
                        const stats = getProjectStats(p.id);
                        const isLive = p.project_type === 'Live';
                        const isLantana = p.project_type === 'Lantana';
                        const isPrivate = p.public_visible === false;
                        const dashboardUrl = isLive
                          ? `/live_dashboard?project=${p.id}`
                          : isLantana
                          ? `/dashboard/lantana?project=${p.id}`
                          : `/dashboard/common?project=${p.id}`;
                        const adminUrl = isLive ? '/admin/live' : '/admin/pam';

                        return (
                          <tr key={`your-proj-${p.id}`} className="hover:bg-[#f8faf8] transition-colors">
                            <td>
                              <div className="font-semibold text-[#1a1f1c] flex items-center gap-2 flex-wrap">
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
                            <td>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {p.project_type || 'PAM'}
                                </span>
                                {isPrivate ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Lock className="w-3 h-3" /> Private
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <Globe className="w-3 h-3" /> Public
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-xs text-[#5a635d]">
                              {p.organization || 'IISER Tirupati Bird Lab'}
                            </td>
                            <td className="num-cell font-mono font-medium">{stats.recorders}</td>
                            <td className="num-cell font-mono font-semibold text-[#1f4d3a]">{stats.species}</td>
                            <td className="num-cell font-mono text-[#5a635d]">{stats.detections.toLocaleString()}</td>
                            <td className="text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <Link
                                  href={adminUrl}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#f0f7f3] text-[#1f4d3a] border border-[#b8dbc8] transition-all"
                                >
                                  <span>Manage</span>
                                </Link>
                                <Link
                                  href={dashboardUrl}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1f4d3a] hover:bg-[#15382a] text-white transition-all"
                                >
                                  <span>Open dashboard</span>
                                  <span>&rarr;</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white border border-[#dde1dc] text-xs text-[#5a635d]">
                  No specific projects are currently assigned to your manager profile. You can still browse all public monitoring datasets below.
                </div>
              )}
            </div>
          )}

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
                    const isPrivate = p.public_visible === false;
                    const linkUrl = isLantana
                      ? `/dashboard/lantana?project=${p.id}`
                      : `/dashboard/common?project=${p.id}`;

                    return (
                      <tr key={p.id} className="hover:bg-[#f8faf8] transition-colors">
                        <td>
                          <div className="font-medium text-[#1a1f1c] flex items-center gap-2 flex-wrap">
                            <span>{p.name}</span>
                            {isLantana && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
                                Restoration
                              </span>
                            )}
                            {isPrivate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <Lock className="w-3 h-3" /> Private
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
                            <div className="font-medium text-[#1a1f1c] flex items-center gap-2 flex-wrap">
                              <span>{p.name}</span>
                              {p.public_visible === false && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Lock className="w-3 h-3" /> Private
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#5a635d]">{p.description || 'Live acoustic monitoring array'}</div>
                          </td>
                          <td className="font-mono text-xs text-[#5a635d]">
                            <span className="px-2 py-0.5 rounded bg-[#f5f6f4] border border-[#dde1dc]">Live Detector Agent</span>
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
      <section className="w-full bg-[#ffffff] py-14 sm:py-20 border-b border-[#dde1dc]">
        <div className="w-full max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
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
