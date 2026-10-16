'use client';

import React, { useState } from 'react';
import { 
  Compass, 
  Radio, 
  Cpu, 
  BarChart3, 
  FileText, 
  CheckCircle2, 
  MapPin, 
  Download,
  Layers,
  ChevronRight,
  Check
} from 'lucide-react';

interface MethodStage {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  summary: string;
  details: string[];
}

const METHOD_STAGES: MethodStage[] = [
  {
    id: 'stage-1',
    number: '01',
    title: 'Study Design',
    subtitle: 'Statistically robust acoustic monitoring plans',
    summary: 'We work with conservation teams to design statistically robust acoustic monitoring plans: site selection, recorder spacing, temporal sampling, and target species.',
    details: [
      'Site selection and habitat stratification along elevation and disturbance gradients.',
      'Recorder spacing with standardized radial acoustic buffers to ensure statistical independence.',
      'Temporal sampling scheduling targeting dawn chorus, dusk, and nocturnal survey windows.'
    ]
  },
  {
    id: 'stage-2',
    number: '02',
    title: 'Data Collection',
    subtitle: 'Autonomous PAM & BirdNET-Pi live nodes',
    summary: 'Field teams deploy autonomous PAM recorders or BirdNET-Pi live nodes. Audio, metadata, and telemetry stream or batch into centralized repositories.',
    details: [
      'Deployment of autonomous passive acoustic monitoring (PAM) units and solar IoT nodes.',
      'High-resolution lossless 48 kHz / 24-bit audio capture preserving full avian acoustic bandwidth.',
      'Automated batch ingestion and telemetry streaming into centralized cloud repositories.'
    ]
  },
  {
    id: 'stage-3',
    number: '03',
    title: 'Analysis',
    subtitle: 'Bioacoustic vocalization classification',
    summary: 'Bioacoustic models classify vocalizations, filter environmental noise, and link detections to species, sites, and habitat covariates with full spectrogram verification.',
    details: [
      'Neural network classification calibrated for Western Ghats avian vocal repertoires.',
      'Calibrated confidence thresholding to filter wind, rain, and ambient acoustic artifacts.',
      'Full time-frequency spectrogram verification with harmonic syllable matching.'
    ]
  },
  {
    id: 'stage-4',
    number: '04',
    title: 'Graphical Insights',
    subtitle: 'Ecological diversity & temporal activity patterns',
    summary: 'Acoustic occurrence records translate into species accumulation curves, diversity indices, and diurnal activity profiles across habitats.',
    details: [
      'Rarefaction-standardized species accumulation curves evaluating survey completeness.',
      'Diurnal vocal activity profiles showing dawn chorus and dusk acoustic peaks.',
      'Comparative diversity analytics between restored corridors and control habitats.'
    ]
  },
  {
    id: 'stage-5',
    number: '05',
    title: 'Reporting',
    subtitle: 'Technical dossiers & conservation recommendations',
    summary: 'We deliver comprehensive technical dossiers with verified spectrograms, distribution maps, and actionable management recommendations for forest managers.',
    details: [
      'Publication-grade research dossiers with timestamped bioacoustic spectrogram figures.',
      'Georeferenced species occurrence maps and baseline ecological audits for protected areas.',
      'Verifiable bioacoustic evidence and management recommendations for state forest departments.'
    ]
  }
];

export default function WhatWeProvide() {
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const activeStage = METHOD_STAGES[activeStageIdx];

  const stageIcons = [Compass, Radio, Cpu, BarChart3, FileText];

  return (
    <section id="method" className="w-full bg-[#fbfcfb] py-16 sm:py-20 border-b border-[#e2e8f0]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Section Heading - Academic & Understated */}
        <div className="space-y-2 border-b border-[#e2e8f0] pb-5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#edf3ef] border border-[#cbdcd0] text-[11px] font-mono text-[#1f4d3a] font-semibold tracking-wide">
            <Layers className="w-3.5 h-3.5 text-[#1f4d3a]" />
            <span>RESEARCH METHODOLOGY PIPELINE</span>
          </div>
          <h2 className="text-[#1a1f1c] font-serif text-3xl sm:text-4xl font-bold tracking-tight">
            The bioacoustics research workflow
          </h2>
          <p className="text-[#525f57] text-sm sm:text-base leading-relaxed max-w-[740px]">
            A standardized scientific protocol progressing from autonomous acoustic sensor deployment to verifiable, audit-grade biodiversity intelligence.
          </p>
        </div>

        {/* 5-Step Connected Progress Pipeline Stepper - Clean & Less Colourful */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-2.5 sm:p-3 shadow-2xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 relative">
            {METHOD_STAGES.map((s, idx) => {
              const Icon = stageIcons[idx];
              const isSelected = idx === activeStageIdx;
              const isPast = idx < activeStageIdx;

              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStageIdx(idx)}
                  className={`group relative text-left p-2.5 sm:p-3 rounded-lg transition-all duration-150 border cursor-pointer ${
                    isSelected
                      ? 'bg-[#1f4d3a] text-white border-[#1f4d3a] shadow-xs'
                      : isPast
                      ? 'bg-[#f4f7f5] text-[#1a1f1c] border-[#d2e0d7] hover:bg-[#eaf1ec]'
                      : 'bg-white text-[#525f57] border-[#e2e8f0] hover:border-[#1f4d3a] hover:bg-[#fafbfa]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
                      isSelected ? 'text-[#a7f3d0]' : isPast ? 'text-[#1f4d3a]' : 'text-[#829288]'
                    }`}>
                      Stage {s.number}
                    </span>
                    <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] ${
                      isSelected
                        ? 'bg-white/20 text-white font-bold'
                        : isPast
                        ? 'bg-[#1f4d3a] text-white'
                        : 'bg-[#f1f5f3] text-[#829288]'
                    }`}>
                      {isPast ? <Check className="w-2.5 h-2.5 stroke-[2.5]" /> : <Icon className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#1a1f1c]'}`}>
                    {s.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Stage Detailed Breakdown (2 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-start">
          
          {/* Left Column (5 cols): Stage Protocol & Scientific Standards */}
          <div className="lg:col-span-5 space-y-5">
            
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#edf3ef] text-[#1f4d3a] font-mono text-[11px] font-semibold uppercase tracking-wider border border-[#cbdcd0]">
                STAGE {activeStage.number} &bull; {activeStage.subtitle}
              </div>
              <h3 className="font-serif font-bold text-2xl sm:text-3xl text-[#1a1f1c] leading-snug">
                {activeStage.title}
              </h3>
            </div>

            <p className="text-[#3b433e] text-sm leading-relaxed">
              {activeStage.summary}
            </p>

            {/* Protocol checklist - Understated */}
            <div className="p-4 rounded-xl bg-[#f8faf9] border border-[#e2e8f0] space-y-2.5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#1f4d3a] font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f4d3a]" />
                <span>Field Protocol Controls &amp; Standards</span>
              </div>
              <ul className="space-y-2 text-xs text-[#2b352f] list-none p-0">
                {activeStage.details.map((detail, dIdx) => (
                  <li key={dIdx} className="flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1f4d3a] mt-1.5 shrink-0" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>



            {/* Next / Prev Stage Navigation */}
            <div className="flex items-center justify-between pt-1">
              <button
                disabled={activeStageIdx === 0}
                onClick={() => setActiveStageIdx(prev => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-md border border-[#e2e8f0] text-xs font-semibold text-[#525f57] hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                &larr; Previous Stage
              </button>
              <button
                disabled={activeStageIdx === METHOD_STAGES.length - 1}
                onClick={() => setActiveStageIdx(prev => Math.min(METHOD_STAGES.length - 1, prev + 1))}
                className="px-3.5 py-1.5 rounded-md bg-[#1f4d3a] hover:bg-[#163a2b] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer"
              >
                <span>Next Stage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

          {/* Right Column (7 cols): Publication-Grade Scientific Visualizer */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs overflow-hidden">
              <StageVisualPublication stageIndex={activeStageIdx} />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACADEMIC PUBLICATION-GRADE SCIENTIFIC VISUALIZERS (MUTED, ACCURATE, NOT AI)
// ─────────────────────────────────────────────────────────────────────────────

function StageVisualPublication({ stageIndex }: { stageIndex: number }) {
  // ─── STAGE 0: STUDY DESIGN (Elevation Transect & Acoustic Buffers Illustration)
  if (stageIndex === 0) {
    return (
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden shadow-2xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/images/study_design_transect.jpg" 
          alt="Bioacoustic Study Design: Elevation Transect and Radial Sensor Buffers Illustration" 
          className="w-full h-auto object-cover block"
        />
      </div>
    );
  }

  // ─── STAGE 1: DATA COLLECTION (PAM Field Hardware Deployment Illustration) ──
  if (stageIndex === 1) {
    return (
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden shadow-2xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/images/pam_field_recorder.jpg" 
          alt="Passive Acoustic Monitoring Field Hardware Deployment" 
          className="w-full h-auto object-cover block"
        />
      </div>
    );
  }

  // ─── STAGE 2: ANALYSIS (AUTHENTIC PUBLICATION-GRADE SPECTROGRAM PNG) ───────
  if (stageIndex === 2) {
    return (
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden shadow-2xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/images/bioacoustic_spectrogram_academic.png" 
          alt="Bioacoustic Spectrogram & Oscillogram from IISER Bioacoustics Lab" 
          className="w-full h-auto object-cover block"
        />
      </div>
    );
  }

  // ─── STAGE 3: GRAPHICAL INSIGHTS (Species Accumulation & Diurnal Chorus Plot)
  if (stageIndex === 3) {
    return (
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden shadow-2xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="/images/species_accumulation_curve.png" 
          alt="Species Accumulation (Rarefaction) and Diurnal Vocal Activity Profile" 
          className="w-full h-auto object-cover block"
        />
      </div>
    );
  }

  // ─── STAGE 4: REPORTING (Conservation Audit & Research Dossier Illustration) 
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden shadow-2xs">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src="/images/conservation_report_dossier.jpg" 
        alt="Ecological Restoration and Bioacoustics Conservation Audit Dossier" 
        className="w-full h-auto object-cover block"
      />
    </div>
  );
}
