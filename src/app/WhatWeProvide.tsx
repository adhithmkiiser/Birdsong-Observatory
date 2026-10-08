'use client';

import React, { useState } from 'react';
import { 
  Compass, 
  Radio, 
  Cpu, 
  BarChart3, 
  FileText, 
  CheckCircle2, 
  Volume2, 
  MapPin, 
  Download,
  Calendar,
  Layers
} from 'lucide-react';

interface MethodStage {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  summary: string;
  details: string[];
  metrics: { label: string; value: string }[];
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
    ],
    metrics: [
      { label: 'Spatial Buffer', value: '250 m Radial' },
      { label: 'Elevation Range', value: '400 – 2,200 m' },
      { label: 'Survey Windows', value: 'Dawn & Nocturnal' }
    ]
  },
  {
    id: 'stage-2',
    number: '02',
    title: 'Data Collection',
    subtitle: 'Autonomous PAM & BirdNET-Pi live nodes',
    summary: 'Field teams deploy autonomous PAM recorders or BirdNET-Pi live nodes. Audio, metadata, and telemetry stream or batch into the cloud.',
    details: [
      'Deployment of autonomous passive acoustic monitoring (PAM) units and solar IoT nodes.',
      'High-resolution lossless 48 kHz / 24-bit audio capture preserving full avian acoustic bandwidth.',
      'Automated batch ingestion and telemetry streaming into centralized cloud repositories.'
    ],
    metrics: [
      { label: 'Hardware Types', value: 'PAM & Live Nodes' },
      { label: 'Audio Standard', value: '48 kHz / 24-bit' },
      { label: 'Ingest Pipeline', value: 'Batch & Stream' }
    ]
  },
  {
    id: 'stage-3',
    number: '03',
    title: 'Analysis',
    subtitle: 'Bioacoustic AI vocalization classification',
    summary: 'Bioacoustic AI classifies vocalizations, filters false positives, and links detections to species, sites, and environmental covariates.',
    details: [
      'Neural network classification using calibrated regional acoustic model weights.',
      'Automated confidence thresholding to filter wind, rain, and ambient acoustic artifacts.',
      'Harmonic feature matching and linking detections to species, sites, and habitat metadata.'
    ],
    metrics: [
      { label: 'AI Engine', value: 'BirdNET Bioacoustic' },
      { label: 'Filter Precision', value: 'Dynamic Threshold' },
      { label: 'Feature Window', value: '3.0s Segmented' }
    ]
  },
  {
    id: 'stage-4',
    number: '04',
    title: 'Graphical Insights',
    subtitle: 'Interactive dashboards & diversity patterns',
    summary: 'Interactive dashboards translate thousands of detections into species accumulation curves, diversity indices, and temporal activity patterns.',
    details: [
      'Dynamic species accumulation curves and observed richness across survey sites.',
      'Diurnal vocal activity profiles and hourly detection frequency distributions.',
      'Comparative habitat analytics between restored ecological corridors and control sites.'
    ],
    metrics: [
      { label: 'Visualizations', value: 'Accumulation Curves' },
      { label: 'Temporal Resolution', value: 'Hourly Diurnal' },
      { label: 'Habitat Indices', value: 'Site-by-Species' }
    ]
  },
  {
    id: 'stage-5',
    number: '05',
    title: 'Reporting',
    subtitle: 'Technical reports & conservation recommendations',
    summary: 'We deliver technical reports with annotated spectrograms, photos, maps, and conservation recommendations for funders and regulators.',
    details: [
      'Comprehensive research dossiers with timestamped Raven Pro spectrogram figures.',
      'Georeferenced species occurrence maps and baseline ecological audits for protected areas.',
      'Verifiable bioacoustic evidence and management recommendations for state forest departments.'
    ],
    metrics: [
      { label: 'Deliverables', value: 'PDF & CSV Reports' },
      { label: 'Evidence Base', value: 'Annotated Figures' },
      { label: 'Stakeholders', value: 'Funders & Regulators' }
    ]
  }
];

export default function WhatWeProvide() {
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const activeStage = METHOD_STAGES[activeStageIdx];

  return (
    <section id="method" className="w-full bg-gradient-to-b from-[#ffffff] via-[#f9faf9] to-[#ffffff] py-16 sm:py-24 border-b border-[#dde1dc]">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Heading */}
        <div className="space-y-2 border-b border-[#dde1dc] pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eaf3ee] border border-[#b8dbc8] text-[11px] font-mono text-[#1f4d3a] font-semibold mb-1">
            <Layers className="w-3 h-3 text-[#1f4d3a]" />
            <span>RESEARCH METHODOLOGY</span>
          </div>
          <h2 className="text-[#1a1f1c] font-serif text-3xl sm:text-4xl font-semibold tracking-tight">
            The bioacoustics research workflow
          </h2>
          <p className="text-[#5a635d] text-base leading-relaxed max-w-[680px]">
            A systematic scientific protocol moving from acoustic sensor array deployment to verifiable empirical biodiversity records.
          </p>
        </div>

        {/* Stage Selector Tabs */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 border-b border-[#dde1dc]">
          {METHOD_STAGES.map((s, idx) => {
            const isSelected = idx === activeStageIdx;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStageIdx(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#1f4d3a] text-white font-semibold shadow-sm scale-[1.02]'
                    : 'bg-white text-[#5a635d] hover:text-[#1a1f1c] hover:bg-[#eaf3ee] border border-[#dde1dc]'
                }`}
              >
                <span className={`font-mono text-[11px] ${isSelected ? 'text-emerald-300' : 'text-[#5a635d]'}`}>{s.number}</span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Detailed Breakdown (2 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column (6 cols): Stage Narrative & Protocol Checklist */}
          <div className="lg:col-span-6 space-y-6">
            
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#eaf3ee] text-[#1f4d3a] font-mono text-xs font-semibold uppercase tracking-wider border border-[#b8dbc8]">
                STAGE {activeStage.number} &bull; {activeStage.subtitle}
              </div>
              <h3 className="font-serif font-semibold text-2xl text-[#1a1f1c] leading-snug pt-1">
                {activeStage.title}
              </h3>
            </div>

            <p className="text-[#1a1f1c] text-base leading-[1.611]">
              {activeStage.summary}
            </p>

            {/* Protocol checklist */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#f0f7f3] to-[#ffffff] border border-[#b8dbc8] space-y-3 shadow-2xs">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#1f4d3a] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                <span>Protocol Standards &amp; Controls</span>
              </div>
              <ul className="space-y-2 text-xs text-[#1a1f1c] list-none p-0">
                {activeStage.details.map((detail, dIdx) => (
                  <li key={dIdx} className="flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] mt-1.5 flex-shrink-0" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Stage Quantitative Metrics Matrix */}
            <div className="grid grid-cols-3 gap-3">
              {activeStage.metrics.map((m, mIdx) => (
                <div key={mIdx} className="p-3.5 rounded-xl bg-white border border-[#dde1dc] hover:border-[#1f4d3a] transition-all space-y-1 shadow-2xs">
                  <span className="text-[10px] text-[#5a635d] font-mono block">{m.label}</span>
                  <span className="font-semibold text-xs text-[#1a1f1c] block">{m.value}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Right Column (6 cols): Dedicated Interactive Stage Visual Component */}
          <div className="lg:col-span-6 space-y-3">
            <div className="rounded-2xl border border-[#dde1dc] bg-[#ffffff] p-5 shadow-sm">
              <StageVisualInteractive stageIndex={activeStageIdx} />
            </div>
            <figcaption className="caption-text text-xs text-[#5a635d]">
              {activeStage.subtitle} protocol specification and diagnostic schematic.
            </figcaption>
          </div>

        </div>

      </div>
    </section>
  );
}

function StageVisualInteractive({ stageIndex }: { stageIndex: number }) {
  if (stageIndex === 0) {
    // Stage 1: Spatial Transect Deployment Map
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-[#5a635d] border-b border-[#dde1dc] pb-2">
          <span className="flex items-center gap-1.5 text-[#1a1f1c] font-semibold">
            <MapPin className="w-3.5 h-3.5 text-[#1f4d3a]" />
            ELEVATION TRANSECT MAPPING
          </span>
          <span>CRS: EPSG:4326</span>
        </div>

        <div className="relative h-48 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] overflow-hidden p-4">
          <svg viewBox="0 0 320 160" className="w-full h-full" fill="none">
            {/* Topo contour lines */}
            <path d="M 0 130 C 80 90 160 140 240 90 C 280 65 300 80 320 50" stroke="#dde1dc" strokeWidth="1.5" />
            <path d="M 0 85 C 80 55 160 95 240 55 C 280 35 300 45 320 20" stroke="#dde1dc" strokeWidth="1.5" />
            
            {/* Transect line */}
            <line x1="40" y1="120" x2="280" y2="35" stroke="#1f4d3a" strokeWidth="2" strokeDasharray="4 4" />

            {/* Recorders with 250m Buffer Radii */}
            {[
              { cx: 40, cy: 120, label: 'NL-01 (620m)' },
              { cx: 120, cy: 90, label: 'NL-02 (1,150m)' },
              { cx: 200, cy: 60, label: 'NL-03 (1,840m)' },
              { cx: 280, cy: 35, label: 'NL-04 (2,120m)' },
            ].map((node, i) => (
              <g key={i}>
                <circle cx={node.cx} cy={node.cy} r="22" fill="rgba(31, 77, 58, 0.08)" stroke="#1f4d3a" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx={node.cx} cy={node.cy} r="4" fill="#1f4d3a" />
                <text x={node.cx - 20} y={node.cy + 16} fill="#1a1f1c" fontSize="8" fontFamily="IBM Plex Mono" fontWeight="600">{node.label}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#5a635d]">
          <div className="p-2 rounded bg-[#f5f6f4]">Grid spacing: 250m acoustic radius</div>
          <div className="p-2 rounded bg-[#f5f6f4]">Elevation: 620m – 2,120m Shola</div>
        </div>
      </div>
    );
  }

  if (stageIndex === 1) {
    // Stage 2: Lossless WAV Ingest & Audio Buffer Schematic
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-[#5a635d] border-b border-[#dde1dc] pb-2">
          <span className="flex items-center gap-1.5 text-[#1a1f1c] font-semibold">
            <Radio className="w-3.5 h-3.5 text-[#1f4d3a]" />
            LOSSLESS WAV INGESTION ENGINE
          </span>
          <span>48 kHz / 24-bit</span>
        </div>

        <div className="p-4 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] space-y-3">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-[#5a635d]">Audio Stream Amplitude</span>
            <span className="font-semibold text-[#1f4d3a]">2.3 GB / Day / Site</span>
          </div>

          <div className="flex items-end gap-1 h-20 bg-white p-2 rounded-lg border border-[#dde1dc]">
            {[25, 40, 80, 55, 95, 30, 60, 90, 45, 75, 100, 35, 65, 85, 40, 70, 90, 50, 80, 30].map((h, i) => (
              <div key={i} className="flex-1 bg-[#1f4d3a] rounded-t-sm" style={{ height: `${h}%` }} />
            ))}
          </div>

          <div className="flex justify-between text-[11px] font-mono text-[#5a635d]">
            <span>Dawn: 05:30–08:30 IST</span>
            <span>Dusk: 18:00–20:00 IST</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#5a635d]">
          <div className="p-2 rounded bg-[#f5f6f4]">Checksum: SHA-256 Verified</div>
          <div className="p-2 rounded bg-[#f5f6f4]">Archival: Dual Cloud Storage</div>
        </div>
      </div>
    );
  }

  if (stageIndex === 2) {
    // Stage 3: Neural Bioacoustic AI Identification
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-[#5a635d] border-b border-[#dde1dc] pb-2">
          <span className="flex items-center gap-1.5 text-[#1a1f1c] font-semibold">
            <Cpu className="w-3.5 h-3.5 text-[#1f4d3a]" />
            NEURAL CLASSIFIER INFERENCE
          </span>
          <span className="text-[#1f4d3a] font-semibold">BirdNET v2.4</span>
        </div>

        <div className="p-4 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] space-y-3">
          <div className="flex justify-between text-xs font-mono">
            <span>Harmonic Detection Matrix</span>
            <span>Sliding Window: 3.0s</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#dde1dc] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-[#1a1f1c]">Nilgiri Laughingthrush</div>
                <div className="font-serif italic text-[11px] text-[#5a635d]">Trochalopteron cachinnans</div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#eaf2ed] text-[#1f4d3a] border border-[#b7d6c3]">
                Score: 0.942
              </span>
            </div>
            <div className="w-full bg-[#f5f6f4] h-2 rounded-full overflow-hidden">
              <div className="bg-[#1f4d3a] h-full rounded-full" style={{ width: '94.2%' }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#5a635d]">
          <div className="p-2 rounded bg-[#f5f6f4]">Threshold: Score ≥ 0.80</div>
          <div className="p-2 rounded bg-[#f5f6f4]">Verification: Expert Queue</div>
        </div>
      </div>
    );
  }

  if (stageIndex === 3) {
    // Stage 4: Empirical Biodiversity Metrics
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-[#5a635d] border-b border-[#dde1dc] pb-2">
          <span className="flex items-center gap-1.5 text-[#1a1f1c] font-semibold">
            <BarChart3 className="w-3.5 h-3.5 text-[#1f4d3a]" />
            EMPIRICAL BIODIVERSITY INVENTORY
          </span>
          <span>Observed Metrics</span>
        </div>

        <div className="p-4 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] space-y-3">
          <div className="flex justify-between text-xs font-mono text-[#5a635d]">
            <span>Observed Species Richness</span>
            <span className="font-semibold text-[#1a1f1c]">64 Verified Taxa</span>
          </div>

          {/* Clean Diurnal Activity Bars */}
          <div className="space-y-1.5 bg-white p-3 rounded-lg border border-[#dde1dc] font-mono text-xs">
            <div className="flex justify-between text-[11px] text-[#5a635d]">
              <span>Dawn Chorus (05:00–09:00)</span>
              <span className="font-semibold text-[#1f4d3a]">3,420 Detections</span>
            </div>
            <div className="w-full bg-[#f5f6f4] h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#1f4d3a] h-full rounded-full" style={{ width: '85%' }} />
            </div>

            <div className="flex justify-between text-[11px] text-[#5a635d] pt-1">
              <span>Mid-Day (10:00–16:00)</span>
              <span className="font-semibold text-[#1a1f1c]">840 Detections</span>
            </div>
            <div className="w-full bg-[#f5f6f4] h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#5a635d] h-full rounded-full" style={{ width: '25%' }} />
            </div>

            <div className="flex justify-between text-[11px] text-[#5a635d] pt-1">
              <span>Dusk (17:00–20:00)</span>
              <span className="font-semibold text-[#1f4d3a]">1,890 Detections</span>
            </div>
            <div className="w-full bg-[#f5f6f4] h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#1f4d3a] h-full rounded-full" style={{ width: '52%' }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#5a635d]">
          <div className="p-2 rounded bg-[#f5f6f4]">Indices: Observed Richness</div>
          <div className="p-2 rounded bg-[#f5f6f4]">Temporal: Hourly Resolution</div>
        </div>
      </div>
    );
  }

  // Stage 5: Auditable Reporting
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-mono text-[#5a635d] border-b border-[#dde1dc] pb-2">
        <span className="flex items-center gap-1.5 text-[#1a1f1c] font-semibold">
          <FileText className="w-3.5 h-3.5 text-[#1f4d3a]" />
          CONSERVATION AUDIT DOSSIER
        </span>
        <span className="text-[#1f4d3a] font-semibold">AUDITED</span>
      </div>

      <div className="p-4 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] space-y-3 font-sans">
        <div className="p-3 bg-white rounded-lg border border-[#dde1dc] space-y-2">
          <div className="flex items-center justify-between border-b border-[#dde1dc] pb-2">
            <div>
              <div className="font-semibold text-xs text-[#1a1f1c]">Lantana Removal Ecological Audit</div>
              <div className="font-mono text-[10px] text-[#5a635d]">Report ID: BIO-2026-TN04</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#eaf2ed] text-[#1f4d3a]">
              Validated
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#5a635d] block">Cleared Sites:</span>
              <strong className="text-[#1f4d3a]">48 Species Recorded</strong>
            </div>
            <div>
              <span className="text-[10px] text-[#5a635d] block">Infested Sites:</span>
              <strong className="text-[#1a1f1c]">22 Species Recorded</strong>
            </div>
          </div>
        </div>

        <div className="text-xs text-[#5a635d] leading-relaxed">
          &ldquo;Significant increase in understory insectivorous and ground-foraging bird vocal activity across restored native forest corridors.&rdquo;
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#5a635d]">
        <div className="p-2 rounded bg-[#f5f6f4]">Delivery: Forest Department</div>
        <div className="p-2 rounded bg-[#f5f6f4]">Archival: Open Research DOI</div>
      </div>
    </div>
  );
}
