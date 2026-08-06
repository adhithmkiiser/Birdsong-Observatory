'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  BarChart3, 
  Cpu, 
  Database, 
  FileText, 
  Map, 
  Mic, 
  Radio, 
  Layers, 
  ChevronRight, 
  Volume2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lora } from 'next/font/google';
import { supabase } from '@/lib/supabase';
import Hero from './Hero';
import WhatWeProvide from './WhatWeProvide';
import './animations.css';

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-lora',
});

const stats = [
  { label: 'Sites Monitored', value: '24' },
  { label: 'Audio Hours Processed', value: '12,000+' },
  { label: 'Ecosystems Covered', value: '6' },
];

const pamSteps = [
  { title: 'Field Deployment', desc: 'Autonomous recorders placed in forest transects', icon: Map, detail: 'Recorders are scheduled to capture specific morning/evening chorus windows, storing files locally on high-capacity SD cards.' },
  { title: 'Batch Ingest', desc: 'Audio + CSV metadata uploaded to the cloud', icon: Database, detail: 'Field data is batch-uploaded via the web console. Metadata sheets and raw recordings are processed in parallel queues.' },
  { title: 'CSV Parser', desc: 'Parses detections, registers coordinates, classifies species', icon: FileText, detail: 'The ingestion engine extracts species lists, cross-references coordinates, and populates spatial detection records.' },
  { title: 'Database Registry', desc: 'Stored in pam_detections / lantana_detections', icon: Database, detail: 'Detections are systematically structured, indexing species names, coordinates, and timestamp statistics.' },
  { title: 'Dashboards', desc: 'Species accumulation, Shannon diversity, indicator taxa', icon: BarChart3, detail: 'Automated analytics generate species richness projections, Shannon-Wiener indices, and comparative diurnal charts.' },
];

const liveSteps = [
  { title: 'Field Nodes', desc: 'Raspberry Pi nodes running BirdNET-Pi', icon: Cpu, detail: 'Edge devices run continuous audio sampling in canopy corridors, powered by solar grids or field batteries.' },
  { title: 'On-Device AI', desc: 'Real-time vocalization classification', icon: Mic, detail: 'Local AI models analyze the active soundscape, registering bird calls with confidence scores (>85%).' },
  { title: 'Cloud Sync', desc: 'Pushes detections/telemetry to Supabase live_detections', icon: Database, detail: 'A lightweight sync daemon pushes detections, audio snippets, and system diagnostics to the cloud database.' },
  { title: 'Live Dashboard', desc: 'Streaming telemetry, recent detections, station health', icon: Radio, detail: 'Instantly visualizes active audio streams, live detections, and real-time station diagnostics/telemetry.' },
];

export default function HomePage() {
  // Dynamic stats & projects state copied from main page.tsx
  const [projects, setProjects] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [projectStatsMap, setProjectStatsMap] = useState<Record<string, { recorders: number; species: number; detections: number }>>({});
  
  // Interactive Pipeline Switcher state
  const [selectedPipeline, setSelectedPipeline] = useState<'pam' | 'live'>('pam');
  const [hoveredStep, setHoveredStep] = useState<number>(0);

  useEffect(() => {
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
            const [{ data: lantanaSites }, { data: lantanaDets, count: lantanaDetCount }] = await Promise.all([
              supabase.from('lantana_sites').select('id').eq('project_id', p.id),
              supabase.from('lantana_detections').select('common_name', { count: 'exact' }).eq('project_id', p.id)
            ]);
            statsMap[p.id] = {
              recorders: (lantanaSites || []).length,
              species: new Set((lantanaDets || []).map((d: any) => d.common_name)).size,
              detections: lantanaDetCount || 0
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
        console.error('Failed to load dynamic projects:', err);
      }
    }
    
    loadStats();
  }, []);

  const getProjectStats = (projectId: string) => {
    if (projectStatsMap[projectId]) {
      return projectStatsMap[projectId];
    }
    const projSites = sitesList.filter(s => s.project_id === projectId);
    return { recorders: projSites.length, species: 0, detections: 0 };
  };

  const pamProjects = projects.filter(p => p.project_type === 'PAM' || p.project_type === 'Lantana');
  const liveProjects = projects.filter(p => p.project_type === 'Live');

  // Animation reveal hook
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal, .reveal-scale');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px 100px 0px' }
    );
    revealEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [projects]);

  const activeSteps = selectedPipeline === 'pam' ? pamSteps : liveSteps;

  return (
    <main className="home-new min-h-screen bg-slate-50">
      <Hero />

      {/* Summary with Lora Google Font */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div className={`space-y-5 ${lora.variable}`}>
            <h2 className="reveal font-sans text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Ecological Field Studies, Powered by AI
            </h2>
            <p className="font-serif text-base md:text-lg text-slate-600 leading-relaxed">
              Birdsong Observatory combines long-term acoustic monitoring, bioacoustic machine learning, and conservation science to deliver verifiable evidence for forest restoration, biodiversity assessments, and environmental impact studies.
            </p>
            <p className="font-serif text-sm md:text-base text-slate-500 leading-relaxed">
              We handle deployment, data ingestion, AI classification, statistical analysis, and reporting — so your team can focus on action.
            </p>
          </div>
        </div>
      </section>

      {/* Dynamic Projects section matching main homepage */}
      <section id="projects" className="py-20 px-6 md:px-12 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto space-y-16">
          
          {/* --- CATEGORY 1: PAM BIOACOUSTICS PROJECTS --- */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">1. Passive Acoustic Monitoring (PAM) Projects</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Batch processed offline surveys with spatial metadata and species accumulation metrics.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {pamProjects.map(p => (
                <div 
                  key={p.id}
                  className="p-8 rounded-[30px] bg-white border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-md"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 font-extrabold text-[10px] uppercase border border-indigo-200">
                        {p.organization || 'Research PAM Project'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">Common Format</span>
                    </div>

                    {p.image_url && (
                      <div className="w-full h-44 rounded-2xl overflow-hidden my-3 border border-slate-100">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <h4 className="text-xl font-black text-slate-900 leading-tight">
                      {p.name}
                    </h4>

                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      {p.description}
                    </p>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-3 gap-2 text-center text-xs font-mono">
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
          <div className="space-y-8 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">2. Live Recorder Projects</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time continuous streaming field nodes with live AI classification.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {liveProjects.map(p => (
                <div key={p.id} className="p-8 rounded-[30px] bg-white border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-md">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-extrabold text-[10px] uppercase border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Audio Stream
                      </span>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">{p.stations_count || 0} Nodes Active</span>
                    </div>

                    {p.image_url && (
                      <div className="w-full h-44 rounded-2xl overflow-hidden my-3 border border-slate-100">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <h4 className="text-xl font-black text-slate-900 leading-tight">
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
                <div className="col-span-2 p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3">
                  <Radio className="w-10 h-10 text-slate-400" />
                  <div className="font-black text-slate-800 text-sm">No Live Streaming Projects Registered Yet</div>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Navigate to the Admin Console to register a new real-time project entry and start ingestion telemetry.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      <WhatWeProvide />

      {/* Unified Interactive Pipeline Switcher */}
      <section id="pipeline" className="py-24 px-6 md:px-12 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <h2 className="font-sans text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Ecoacoustics Pipelines</h2>
            <p className="text-sm text-slate-500 font-medium max-w-xl mx-auto">
              Compare the mechanics of offline survey analysis and real-time streaming telemetry.
            </p>
          </div>

          {/* Toggle Switches */}
          <div className="flex justify-center">
            <div className="bg-slate-100 p-1.5 rounded-[22px] inline-flex gap-1 border border-slate-200 shadow-inner">
              <button
                onClick={() => { setSelectedPipeline('pam'); setHoveredStep(0); }}
                className={`px-8 py-3 rounded-[18px] text-xs font-black transition-all duration-300 flex items-center gap-2 ${
                  selectedPipeline === 'pam'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                <Layers className="w-4 h-4" />
                PAM (Offline Surveys)
              </button>
              <button
                onClick={() => { setSelectedPipeline('live'); setHoveredStep(0); }}
                className={`px-8 py-3 rounded-[18px] text-xs font-black transition-all duration-300 flex items-center gap-2 ${
                  selectedPipeline === 'live'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                <Radio className="w-4 h-4" />
                Live Recorder (Real-time AI)
              </button>
            </div>
          </div>

          {/* Interactive Flowchart split view */}
          <div className="grid md:grid-cols-12 gap-8 items-start pt-6">
            
            {/* Step list (Left col) */}
            <div className="md:col-span-5 space-y-4">
              <div className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-2 pl-2">Pipeline Steps</div>
              {activeSteps.map((step, idx) => {
                const Icon = step.icon;
                const isHovered = hoveredStep === idx;
                
                return (
                  <button
                    key={step.title}
                    onMouseEnter={() => setHoveredStep(idx)}
                    onClick={() => setHoveredStep(idx)}
                    className={`w-full p-5 rounded-2xl border text-left transition-all duration-300 flex items-center gap-4 relative overflow-hidden group outline-none ${
                      isHovered
                        ? selectedPipeline === 'pam'
                          ? 'border-indigo-500 bg-indigo-50/20 shadow-xs translate-x-1.5'
                          : 'border-emerald-500 bg-emerald-50/20 shadow-xs translate-x-1.5'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
                      isHovered
                        ? selectedPipeline === 'pam'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-slate-400 font-extrabold uppercase">Step {idx + 1}</span>
                        {isHovered && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </div>
                      <h4 className="text-sm font-black text-slate-950 leading-tight mt-0.5">{step.title}</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">{step.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Step Detail Card (Right col) */}
            <div className="md:col-span-7 h-full min-h-[380px]">
              <div className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-2 pl-2">Step Deep-Dive</div>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${selectedPipeline}-${hoveredStep}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`p-8 md:p-10 rounded-[32px] bg-slate-900 text-white h-full flex flex-col justify-between border shadow-2xl relative overflow-hidden ${
                    selectedPipeline === 'pam' ? 'border-indigo-500/20' : 'border-emerald-500/20'
                  }`}
                >
                  {/* Decorative background glow */}
                  <div className={`absolute -right-24 -top-24 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${
                    selectedPipeline === 'pam' ? 'bg-indigo-500' : 'bg-emerald-400'
                  }`} />
                  
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        selectedPipeline === 'pam' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-400/10 text-emerald-400'
                      }`}>
                        {React.createElement(activeSteps[hoveredStep].icon, { className: 'w-6 h-6' })}
                      </div>
                      <div>
                        <span className="font-mono text-[10px] text-slate-400 font-extrabold uppercase">
                          Stage {hoveredStep + 1} &bull; {selectedPipeline === 'pam' ? 'Offline' : 'Real-time'}
                        </span>
                        <h3 className="text-xl font-black tracking-tight text-white">{activeSteps[hoveredStep].title}</h3>
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                        {activeSteps[hoveredStep].desc}
                      </p>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        {activeSteps[hoveredStep].detail}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-slate-500 font-medium relative z-10">
                    <span>Pipeline: {selectedPipeline === 'pam' ? 'Passive Acoustic' : 'Raspberry Pi Sync'}</span>
                    <span className="flex items-center gap-1">
                      Status: <span className="text-emerald-400 font-bold">Active &amp; Tested</span>
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

          </div>

        </div>
      </section>
    </main>
  );
}
