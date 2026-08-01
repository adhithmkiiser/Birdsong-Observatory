'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Bird, 
  ChevronRight, 
  Clock, 
  Cpu, 
  Database, 
  FileText, 
  Globe, 
  Layers, 
  Radio, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Users,
  CheckCircle2,
  HardDrive,
  Volume2,
  Zap,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [detectionsList, setDetectionsList] = useState<any[]>([]);

  const [projectStatsMap, setProjectStatsMap] = useState<Record<string, { recorders: number; species: number; detections: number }>>({});

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);

    async function loadStats() {
      try {
        const [projRes, sitesRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('sites').select('id, project_id, name')
        ]);
        
        const projData = projRes.data || [];
        const sitesData = sitesRes.data || [];
        
        if (projRes.data) setProjects(projData);
        if (sitesRes.data) setSitesList(sitesData);

        const statsMap: Record<string, { recorders: number; species: number; detections: number }> = {};
        for (const p of projData) {
          if (p.project_type === 'Lantana') {
            // Lantana projects keep their data in the dedicated lantana_* tables
            const [{ data: lantanaSites }, { data: lantanaDets }] = await Promise.all([
              supabase.from('lantana_sites').select('id').eq('project_id', p.id),
              supabase.from('lantana_detections').select('common_name').eq('project_id', p.id)
            ]);
            statsMap[p.id] = {
              recorders: (lantanaSites || []).length,
              species: new Set((lantanaDets || []).map((d: any) => d.common_name)).size,
              detections: (lantanaDets || []).length
            };
            continue;
          }
          const siteCount = sitesData.filter((s: any) => s.project_id === p.id).length;
          const siteNames = sitesData
            .filter((s: any) => s.project_id === p.id)
            .map((s: any) => s.name)
            .filter(Boolean);
          const { data: detData, count: detCount } = p.project_type === 'PAM' && siteNames.length > 0
            ? await supabase.from('pam_detections').select('common_name', { count: 'exact' }).in('project_name', siteNames)
            : await supabase.from('live_detections').select('common_name', { count: 'exact' }).eq('project_name', p.name);
          statsMap[p.id] = {
            recorders: siteCount,
            species: new Set((detData || []).map((d: any) => d.common_name).filter((n: string) => n && n.toLowerCase() !== 'nocall')).size,
            detections: detCount || 0
          };
        }
        setProjectStatsMap(statsMap);
      } catch (err) {
        console.error('Failed to load dynamic landing page counters:', err);
      }
    }
    
    loadStats();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const pamProjects = projects.filter(p => p.project_type === 'PAM' || p.project_type === 'Lantana');
  const liveProjects = projects.filter(p => p.project_type === 'Live');
  
  // Helper to compute live project stats dynamically
  const getProjectStats = (projectId: string) => {
    if (projectStatsMap[projectId]) {
      return projectStatsMap[projectId];
    }
    const projSites = sitesList.filter(s => s.project_id === projectId);
    return {
      recorders: projSites.length,
      species: 0,
      detections: 0
    };
  };

  const otherPamProjects = pamProjects;

  const workflowSteps = [
    {
      title: '1. Field Recorders',
      icon: Cpu,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50 text-emerald-600',
      short: 'Autonomous Recording Nodes Deployed in Forest Canopies',
      desc: 'Smart acoustic recorders (like Raspberry Pi 4 nodes running BirdNET-Pi) are installed directly in forest canopies and remote Shola forest transects. They record high-quality soundscapes 24/7 without disturbing local wildlife.'
    },
    {
      title: '2. Real-Time Detection',
      icon: Volume2,
      color: 'from-teal-500 to-cyan-500',
      bgColor: 'bg-teal-50 text-teal-600',
      short: 'On-device Bioacoustic Artificial Intelligence Analysis',
      desc: 'Using the integrated artificial intelligence models, audio clips are analyzed on-device in real-time. Bird species vocalizations are classified instantly with confidence scoring thresholds exceeding 85% accuracy.'
    },
    {
      title: '3. Cloud Database Sync',
      icon: Database,
      color: 'from-cyan-500 to-indigo-500',
      bgColor: 'bg-cyan-50 text-cyan-600',
      short: 'Secure Supabase Real-Time Delta Transmission',
      desc: 'Automatic sync daemons transfer delta SQLite rows, audio recordings, and telemetry metrics from local recorders up to our centralized cloud database (Supabase) via secure REST API channels.'
    },
    {
      title: '4. Research Insights',
      icon: Activity,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50 text-indigo-600',
      short: 'Interactive Visualizations & Environmental Indicators',
      desc: 'Ecologists, stakeholders, and CSR partners access interactive dashboards. They explore Shannon diversity index mappings, species abundance charts, diurnal vocal patterns, and indicator group statistics.'
    }
  ];

  return (
    <div className="space-y-16 pb-20 font-sans overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center rounded-[40px] overflow-hidden bg-gradient-to-br from-[#022c22] via-[#091e17] to-[#0f172a] text-white p-8 md:p-16 border border-slate-800 shadow-2xl group">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all duration-1000"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/15 transition-all duration-1000"></div>

        <div className="relative z-10 max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-xs uppercase tracking-wider shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Platform Core Active</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] text-white">
              Birdsong <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">Observatory</span>
            </h1>
            <p className="text-lg md:text-xl font-bold text-emerald-400 tracking-wide">
              IISER Tirupati Bird Ecology &amp; Bioacoustics Lab
            </p>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed font-medium">
              A unified cloud analytics platform for landscape-scale avian acoustics. Integrating automated Raspberry Pi field recording nodes with offline passive monitoring (PAM) survey pipelines.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link 
              href="#projects"
              className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 transition duration-300 flex items-center gap-2 group/btn"
            >
              <span>1. Projects</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
            </Link>
          </div>
        </div>
      </section>

      {/* platform overview grid */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Platform Framework Features</h3>
          <p className="text-xs text-slate-500 font-medium">Realtime continuous bioacoustic telemetry &amp; parsed spreadsheet metadata ingest.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Raspberry Pi Ingestion</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Sync daemon scripts pull detections directly from BirdNET-Pi hardware nodes deployed in high-canopy corridors.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Passive Acoustic Ingest</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              CSV parser automatically ingests batch detections, registers new site coordinate profiles, and calculates Shannon diversity.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Bird className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Species Master Curation</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Cross-reference metadata against the IISER Tirupati avian master list to flag rare, endemic, and indicator taxa.
            </p>
          </div>
        </div>
      </section>

      {/* Projects directory split layout */}
      <section id="projects" className="space-y-12 pt-6 scroll-margin-top-24">
        
        {/* --- CATEGORY 1: PAM BIOACOUSTICS PROJECTS --- */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">1. Passive Acoustic Monitoring (PAM) Projects</h3>
              <p className="text-xs text-slate-500 font-medium">Batch processed offline surveys with spatial metadata and species accumulation metrics.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Custom PAM Projects dynamically created */}
            {otherPamProjects.map(p => (
              <div 
                key={p.id}
                className="p-8 rounded-[30px] bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 font-extrabold text-[10px] uppercase border border-indigo-200">
                      {p.organization || 'Research PAM Project'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">Common Format</span>
                  </div>

                  {p.image_url && (
                    <div className="w-full h-40 rounded-2xl overflow-hidden my-3 border border-slate-100 shadow-inner">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <h4 className="text-2xl font-black text-slate-900 leading-tight">
                    {p.name}
                  </h4>


                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {p.description}
                  </p>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Recorders</span>
                      <strong className="text-slate-900 font-black text-sm">{getProjectStats(p.id).recorders} Sites</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Species</span>
                      <strong className="text-indigo-600 font-black text-sm">{getProjectStats(p.id).species} Species</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Detections</span>
                      <strong className="text-slate-900 font-black text-sm">{getProjectStats(p.id).detections}</strong>
                    </div>
                  </div>
                </div>

                <Link
                  href={p.project_type === 'Lantana' ? `/dashboard/lantana?project=${p.id}` : `/dashboard/common?project=${p.id}`}
                  className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs text-center transition flex items-center justify-center gap-2 group/btn"
                >
                  <span>{p.project_type === 'Lantana' ? 'Open Lantana Project Dashboard' : 'Open Common Format Dashboard'}</span>
                  <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
                </Link>
              </div>
            ))}

          </div>
        </div>

        {/* --- CATEGORY 2: LIVE RECORDER PROJECTS --- */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">2. Live Recorder Projects</h3>
              <p className="text-xs text-slate-500 font-medium">Real-time continuous streaming field nodes with live AI classification.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Dynamic Live Projects */}
            {liveProjects.map(p => (
              <div key={p.id} className="p-8 rounded-[30px] bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-extrabold text-[10px] uppercase border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Audio Stream
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">{p.stations_count || 0} Nodes Active</span>
                  </div>

                  {p.image_url && (
                    <div className="w-full h-40 rounded-2xl overflow-hidden my-3 border border-slate-100 shadow-inner">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <h4 className="text-2xl font-black text-slate-900 leading-tight">
                    {p.name}
                  </h4>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {p.description || 'Continuous audio streaming field node telemetry.'}
                  </p>
                </div>

                <Link
                  href={`/live_dashboard?project=${p.id}`}
                  className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs text-center transition flex items-center justify-center gap-2 group/btn"
                >
                  <span>Open Live Streaming Dashboard</span>
                  <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
                </Link>
              </div>
            ))}

            {liveProjects.length === 0 && (
              <div className="col-span-2 p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2.5">
                <Radio className="w-8 h-8 text-slate-400" />
                <div className="font-black text-slate-800 text-sm">No Live Streaming Projects Registered Yet</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Navigate to the Admin Console to register a new real-time project entry and start ingestion telemetry.
                </p>
              </div>
            )}

          </div>
        </div>

      </section>

      {/* --- WORKFLOW FLOWCHART SECTION --- */}
      <section className="space-y-8 pt-8 border-t border-slate-200">
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Ecoacoustics Workflow Pipeline</h3>
          <p className="text-xs text-slate-500 font-medium">Click on any pipeline stage to inspect detailed operations.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-6 md:p-10 shadow-sm space-y-8">
          
          {/* Interactive Steps Tracker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {workflowSteps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = activeStep === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`p-5 rounded-2xl border text-left transition duration-300 relative overflow-hidden group outline-none ${
                    isActive 
                      ? 'border-slate-900 bg-slate-50 shadow-md ring-2 ring-indigo-500/10' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className={`absolute top-0 left-0 h-1 bg-gradient-to-r ${step.color} transition-all duration-300 ${
                    isActive ? 'w-full' : 'w-0 group-hover:w-1/2'
                  }`}></div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-transform duration-300 ${step.bgColor} ${
                      isActive ? 'scale-110' : 'group-hover:scale-105'
                    }`}>
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 font-black">STAGE {idx + 1}</span>
                  </div>
                  
                  <h4 className="text-sm font-black text-slate-900 mt-4 leading-tight">{step.title}</h4>
                  <p className="text-[11px] text-slate-400 font-bold mt-1 line-clamp-1">{step.short}</p>
                </button>
              );
            })}
          </div>

          {/* Interactive detail card */}
          <div className="p-6 md:p-8 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 md:grid-cols-12 gap-6 items-center min-h-[160px] transition-all duration-500">
            <div className="md:col-span-2 flex justify-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${workflowSteps[activeStep].bgColor} shadow-md`}>
                {React.createElement(workflowSteps[activeStep].icon, { className: 'w-8 h-8' })}
              </div>
            </div>
            <div className="md:col-span-10 space-y-2">
              <span className="font-mono text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Active Stage Details</span>
              <h4 className="text-lg font-black text-slate-900 leading-tight">{workflowSteps[activeStep].title}</h4>
              <p className="text-xs text-slate-600 font-semibold leading-relaxed max-w-3xl">
                {workflowSteps[activeStep].desc}
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
