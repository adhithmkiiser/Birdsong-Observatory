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
import { PROJECTS_DATA } from '@/lib/mockData';

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const WORKFLOW_STEPS = [
    {
      step: '01',
      title: 'Data Collection',
      desc: 'Standardized spaced sampling protocol with a minimum distance of 600m to 700m between recording stations to reduce acoustic overlap.'
    },
    {
      step: '02',
      title: 'Automated CNN Processing',
      desc: 'Raw audio recordings are analyzed using BirdNET CNN models and customized acoustic classifiers to identify species detections.'
    },
    {
      step: '03',
      title: 'Ecological Dashboards',
      desc: 'Detections are aggregated to evaluate species richness, indicator presence, and community structure in interactive dashboards.'
    },
    {
      step: '04',
      title: 'Stakeholder Collaboration',
      desc: 'Ecological insights and reporting utilities are shared directly with forest departments, NGOs, and research teams.'
    }
  ];

  return (
    <div className="space-y-16 pb-16 font-sans">
      
      {/* 1. Hero Section with Interactive Parallax Depth */}
      <section className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white p-8 md:p-16 shadow-2xl border border-slate-800/80 group">
        {/* Dynamic Glowing Particle Orbs */}
        <div 
          className="absolute -top-24 -right-24 w-[550px] h-[550px] bg-emerald-500/20 rounded-full blur-3xl pointer-events-none transition-transform duration-500 ease-out group-hover:scale-110"
          style={{ transform: `translate3d(0, ${scrollY * 0.12}px, 0)` }}
        />
        <div 
          className="absolute -bottom-24 -left-24 w-[550px] h-[550px] bg-indigo-500/20 rounded-full blur-3xl pointer-events-none transition-transform duration-500 ease-out group-hover:scale-110"
          style={{ transform: `translate3d(0, ${-scrollY * 0.08}px, 0)` }}
        />

        <div className="relative z-10 max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-xs uppercase tracking-wider shadow-lg backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>IISER Tirupati Bird Ecology Lab</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none text-white">
            <span className="text-emerald-400 drop-shadow-sm">birdsong</span>observatory
          </h1>

          <p className="text-lg md:text-xl text-slate-200 font-medium max-w-2xl leading-relaxed">
            Bioacoustic monitoring for biodiversity, conservation, and ecological insight. Continuous 24/7 landscape-scale avian acoustics & PAM datasets.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <a
              href="#projects"
              className="px-7 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-500/25 transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-2 group/btn"
            >
              <Database className="w-4 h-4" />
              <span>Explore Projects Portfolio</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
            </a>

            <Link
              href="/about"
              className="px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs backdrop-blur-md transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-2"
            >
              <span>Learn Our Science</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Observatory Mission & Science Intro Box */}
      <section className="p-8 md:p-10 rounded-[30px] bg-white border border-slate-200 shadow-sm space-y-4 relative overflow-hidden group hover:shadow-md transition duration-300">
        <div className="flex items-center gap-2 text-xs font-black text-emerald-700 uppercase tracking-wider">
          <Globe className="w-4 h-4" />
          <span>Landscape Scale Conservation</span>
        </div>
        
        <p className="text-base md:text-lg text-slate-800 leading-relaxed font-medium">
          We use bioacoustics to measure and monitor biodiversity at landscape scales. By combining rigorous field protocols, automated acoustic identification, and statistical modeling, we assess species richness and avian community dynamics. Our service transforms raw acoustic data into interactive dashboards and reports, providing forest departments, conservation NGOs, and research collaborators with the evidence-based insights required to guide ecological restoration and habitat conservation.
        </p>
      </section>

      {/* 3. Projects Section (#projects) */}
      <section id="projects" className="space-y-12 scroll-mt-24">
        
        {/* Category Header */}
        <div className="border-b border-slate-200 pb-4">
          <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">Monitoring Portfolio</span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Observatory Projects</h2>
        </div>

        {/* --- CATEGORY 1: PAM PROJECTS (PASSIVE ACOUSTIC MONITORING) --- */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">1. Passive Acoustic Monitoring (PAM) Projects</h3>
              <p className="text-xs text-slate-500 font-medium">Multi-site historical soundscape recording datasets evaluating habitat restoration.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PAM Card 1: Featured TST PAM Project */}
            <div 
              onMouseEnter={() => setHoveredCard('tst')}
              onMouseLeave={() => setHoveredCard(null)}
              className="p-8 rounded-[30px] bg-gradient-to-br from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-xl space-y-6 flex flex-col justify-between border border-emerald-500/40 relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1.5"
            >
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 font-black text-[10px] uppercase border border-emerald-400/40 inline-flex items-center gap-1.5 shadow-sm">
                    <Database className="w-3.5 h-3.5 text-emerald-400" /> Genuine TST PAM Dataset
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">TST Format Dashboard</span>
                </div>

                <h4 className="text-2xl font-black text-white leading-tight">
                  The Shola Trust PAM Bioacoustics Project (TST)
                </h4>

                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  Landscape-scale 24/7 passive acoustic monitoring evaluating habitat restoration & Lantana-clearance impacts across Shola forest transects (5 Lantana-Cleared vs 5 Lantana-Infested sites).
                </p>

                <div className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Recorders</span>
                    <strong className="text-white font-black text-sm">10 Sites</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Species</span>
                    <strong className="text-emerald-400 font-black text-sm">186 Taxa</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Detections</span>
                    <strong className="text-white font-black text-sm">110,384</strong>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard/tst"
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs text-center transition-all duration-300 shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 group/btn relative z-10"
              >
                <span>Open TST Format PAM Dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
              </Link>
            </div>

            {/* PAM Card 2: Nilgiris Biodiversity PAM Project */}
            <div 
              onMouseEnter={() => setHoveredCard('nilgiri')}
              onMouseLeave={() => setHoveredCard(null)}
              className="p-8 rounded-[30px] bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-lg"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 font-extrabold text-[10px] uppercase border border-indigo-200">
                    High Elevation PAM
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">Common Format</span>
                </div>

                <h4 className="text-2xl font-black text-slate-900 leading-tight">
                  Nilgiris Biodiversity PAM Project
                </h4>

                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Long-term acoustic soundscape monitoring assessing avian community shifts across elevational gradients in Shola grassland mosaics.
                </p>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Recorders</span>
                    <strong className="text-slate-900 font-black text-sm">8 Sites</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Species</span>
                    <strong className="text-indigo-600 font-black text-sm">124 Taxa</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Detections</span>
                    <strong className="text-slate-900 font-black text-sm">64,200</strong>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard/common?project=nilgiri"
                className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs text-center transition flex items-center justify-center gap-2 group/btn"
              >
                <span>Open Common Format Dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
              </Link>
            </div>

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
            
            {/* Live Project Card 1 */}
            <div className="p-8 rounded-[30px] bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-extrabold text-[10px] uppercase border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Audio Stream
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">5 Nodes Active</span>
                </div>

                <h4 className="text-2xl font-black text-slate-900 leading-tight">
                  Western Ghats Live Canopy Stream Observatory
                </h4>

                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Real-time audio streaming from 5 canopy station nodes deployed across rainforest transects, feeding BirdNET CNN classifiers continuously.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs text-center transition flex items-center justify-center gap-2 group/btn"
              >
                <span>Launch Live Bioacoustics Dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
              </Link>
            </div>

            {/* Live Project Card 2 */}
            <div className="p-8 rounded-[30px] bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-800 font-extrabold text-[10px] uppercase border border-amber-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> Live Audio Stream
                  </span>
                  <span className="text-[10px] font-mono text-amber-600 font-bold">4 Nodes Active</span>
                </div>

                <h4 className="text-2xl font-black text-slate-900 leading-tight">
                  Tirupati Bioacoustics Sanctuary Observatory
                </h4>

                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Continuous live soundscape monitoring network detecting endemic bird calls across Sheshachalam Biosphere Reserve.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs text-center transition flex items-center justify-center gap-2 group/btn"
              >
                <span>Launch Live Bioacoustics Dashboard</span>
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
              </Link>
            </div>

          </div>
        </div>

      </section>

      {/* 4. Scientific Workflow Section (How We Work) */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <span className="text-xs font-black text-indigo-600 uppercase tracking-widest block">Scientific Protocols</span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">How We Work</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {WORKFLOW_STEPS.map((w) => (
            <div key={w.step} className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition">
              <span className="text-3xl font-black text-emerald-600">{w.step}</span>
              <h3 className="text-sm font-black text-slate-900">{w.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Institutional Partners & Collaborators Banner */}
      <section className="p-8 rounded-[28px] bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <h3 className="text-xl font-black tracking-tight text-white">Partnering for Evidence-Based Conservation</h3>
          <p className="text-xs text-slate-300 font-medium max-w-xl">
            We collaborate with The Shola Trust, Forest Departments, Wildlife Trusts, and Academic Research Institutes to support bioacoustic monitoring across South Asia.
          </p>
        </div>

        <Link
          href="/about"
          className="px-6 py-3 rounded-2xl bg-white text-slate-950 font-black text-xs hover:bg-slate-100 transition self-start md:self-auto"
        >
          Contact IISER Tirupati Bird Lab
        </Link>
      </section>

    </div>
  );
}
