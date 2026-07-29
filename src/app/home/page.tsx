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
  ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);

    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setProjects(data || []);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const pamProjects = projects.filter(p => p.id !== 'tst' && p.project_type === 'PAM');
  const liveProjects = projects.filter(p => p.project_type === 'Live');

  return (
    <div className="space-y-16 pb-20 font-sans overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center rounded-[40px] overflow-hidden bg-gradient-to-br from-[#022c22] via-[#091e17] to-[#0f172a] text-white p-8 md:p-16 border border-slate-800 shadow-2xl group">
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
              href="/dashboard/tst"
              className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 transition duration-300 flex items-center gap-2 group/btn"
            >
              <span>Explore TST Dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
            </Link>
            <Link 
              href="/projects"
              className="px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-extrabold text-sm backdrop-blur-md transition duration-300 flex items-center gap-2"
            >
              <span>Manage Research Transects</span>
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
          {/* Card 1 */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Raspberry Pi Ingestion</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Sync daemon scripts pull detections directly from BirdNET-Pi hardware nodes deployed in high-canopy corridors.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Passive Acoustic Ingest</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              CSV parser automatically ingests batch detections, registers new site coordinate profiles, and calculates Shannon diversity.
            </p>
          </div>

          {/* Card 3 */}
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
      <section className="space-y-12 pt-6">
        
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
            {/* Hardcoded Primary TST Project Card */}
            <div 
              className="p-8 rounded-[30px] bg-slate-900 text-white border border-slate-800 shadow-xl space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all"></div>
              
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 font-extrabold text-[10px] uppercase border border-emerald-500/30">
                    The Shola Trust &amp; IISER Tirupati
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">Standard Theme</span>
                </div>

                <h4 className="text-2xl font-black tracking-tight text-white leading-tight">
                  The Shola Trust PAM Bioacoustics Project (TST)
                </h4>

                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  Landscape-scale passive acoustic monitoring evaluating ecological restoration &amp; habitat recovery across Shola forest transects (Lantana-cleared vs infested sites).
                </p>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs font-mono text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Recorders</span>
                    <strong className="text-white font-black text-sm">10 Sites</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Species</span>
                    <strong className="text-emerald-400 font-black text-sm">186 Taxa</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Detections</span>
                    <strong className="text-white font-black text-sm">110,384</strong>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard/tst"
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs text-center transition flex items-center justify-center gap-2 group/btn relative z-10 shadow-lg shadow-emerald-500/10"
              >
                <span>Open TST Research Dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
              </Link>
            </div>

            {/* Custom PAM Projects dynamically created */}
            {pamProjects.map(p => (
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

                  <h4 className="text-2xl font-black text-slate-900 leading-tight">
                    {p.name}
                  </h4>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {p.description || 'Long-term acoustic soundscape monitoring assessing avian community shifts.'}
                  </p>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Recorders</span>
                      <strong className="text-slate-900 font-black text-sm">{p.stations_count || 0} Sites</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Species</span>
                      <strong className="text-indigo-600 font-black text-sm">{p.species_count || 0} Taxa</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Detections</span>
                      <strong className="text-slate-900 font-black text-sm">{p.total_detections || 0}</strong>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/dashboard/common?project=${p.id}`}
                  className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs text-center transition flex items-center justify-center gap-2 group/btn"
                >
                  <span>Open Common Format Dashboard</span>
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

                  <h4 className="text-2xl font-black text-slate-900 leading-tight">
                    {p.name}
                  </h4>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {p.description || 'Continuous audio streaming field node telemetry.'}
                  </p>
                </div>

                <Link
                  href="/dashboard"
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
    </div>
  );
}
