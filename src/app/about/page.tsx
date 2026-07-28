'use client';

import React from 'react';
import { 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  Bird, 
  Cpu, 
  Layers, 
  Activity, 
  Sparkles,
  FileText
} from 'lucide-react';

export default function AboutPage() {
  const BULLETS = [
    {
      title: 'Standardized Sampling',
      desc: 'Recorders capture the entire soundscape, eliminating subjective variations in observer detection and identification.'
    },
    {
      title: '24/7 Presence',
      desc: 'Automated schedules record dawn choruses, nocturnal species, and rare vocalizations that manual surveyors might miss.'
    },
    {
      title: 'Verifiable Evidence',
      desc: 'Sound recordings act as a permanent, auditable ecological record that can be re-analyzed as classifiers improve.'
    },
    {
      title: 'Minimal Disturbance',
      desc: 'Unlike physical capture methods, passive recording does not alter wildlife behavior or disrupt ecological patterns.'
    }
  ];

  return (
    <div className="space-y-12 pb-16 font-sans">
      {/* 1. Page Header Banner */}
      <section className="p-8 md:p-12 rounded-[32px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-xl border border-slate-800/80">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>IISER Tirupati Initiative</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            About the Birdsong Observatory
          </h1>
          <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
            Bridging the gap between computational ecology, automated machine learning acoustics, and evidence-based conservation.
          </p>
        </div>
      </section>

      {/* 2. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Mission & Science */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Mission Box */}
          <div className="p-8 rounded-[28px] bg-white border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-slate-900 border-l-4 border-emerald-600 pl-3">
              Our Mission
            </h2>
            <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium">
              The Birdsong Observatory is a specialized bioacoustics biodiversity monitoring service based at the Bird Ecology Lab, IISER Tirupati. We bridge the gap between advanced computational ecology and practical, on-the-ground conservation action.
            </p>
            <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium">
              Rather than treating bioacoustics as a purely academic endeavor, the Observatory operates as an active ecological service. We partner with forest departments, conservation trusts, non-governmental organisations, and land managers to design, deploy, and analyze robust acoustic monitoring networks. Our mission is to provide science-based, quantitative ecological evidence that directly informs forest restoration strategies, habitat management, and policy decisions.
            </p>
          </div>

          {/* Why Bioacoustics Box */}
          <div className="p-8 rounded-[28px] bg-white border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-xl font-black text-slate-900 border-l-4 border-indigo-600 pl-3">
              Why Bioacoustics?
            </h2>
            <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium">
              Traditional biodiversity surveys—such as manual point counts, transects, or mist netting—are labor-intensive, seasonal, and often subject to observer bias. They struggle to scale across large landscapes or capture long-term environmental trends.
            </p>
            <p className="text-xs md:text-sm text-slate-900 font-extrabold">
              Bioacoustics offers a non-invasive, continuous, and highly scalable alternative:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {BULLETS.map((b) => (
                <div key={b.title} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{b.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Technology & Conservation Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600" /> Acoustic Monitoring at Scale
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Passive Acoustic Monitoring (PAM) records the acoustic environment continuously over weeks or months, creating massive audio libraries. We handle the computational complexity of indexing and analyzing these datasets, moving from gigabytes of audio files to precise, actionable species maps.
            </p>
          </div>

          <div className="p-6 rounded-[24px] bg-emerald-950 text-white shadow-md space-y-3">
            <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Supporting Conservation Workflows
            </h3>
            <p className="text-xs text-emerald-100/90 font-medium leading-relaxed">
              Our services are engineered to fit directly into reporting workflows for environmental stakeholders: Baseline Assessments, Restoration Audits, Guild Indicator Tracking, and Climate Elevation mapping.
            </p>
          </div>

          <div className="rounded-[24px] overflow-hidden border border-slate-200 shadow-sm bg-white">
            <img
              src="https://images.unsplash.com/photo-1480044965905-02098d419e96?auto=format&fit=crop&w=800&q=80"
              alt="Songbird perched in forest habitat"
              className="w-full h-48 object-cover"
            />
            <div className="p-3 text-[11px] text-slate-500 font-extrabold text-center border-t border-slate-100">
              Vocal songbird perched in forest habitat canopy
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
