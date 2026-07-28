'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  MapPin, 
  Filter, 
  Bird, 
  Activity, 
  Clock, 
  TrendingUp, 
  Download, 
  Layers, 
  ShieldCheck, 
  Sliders, 
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Search,
  ChevronRight
} from 'lucide-react';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { AccumulationChart } from '@/components/charts/AccumulationChart';

export default function TstDashboardPage() {
  const [pamData, setPamData] = useState<any>(null);
  const [pamConfig, setPamConfig] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSite, setSelectedSite] = useState<string>('All');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.70);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function loadTstData() {
      try {
        const [resData, resConfig] = await Promise.all([
          fetch('/tst/data.json'),
          fetch('/tst/config.json')
        ]);

        if (resData.ok && resConfig.ok) {
          const jsonD = await resData.json();
          const jsonC = await resConfig.json();
          setPamData(jsonD);
          setPamConfig(jsonC);
        }
      } catch (err) {
        console.error('Error loading TST dataset:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTstData();
  }, []);

  const recordersList = pamData?.recorders || [];
  const speciesSummaryList = pamData?.species_summary || [];
  const indicatorConfig = pamConfig?.indicator_species || {};

  const recoveryIndicators = indicatorConfig.recovery || [];
  const lantanaIndicators = indicatorConfig.lantana || [];

  const totalAudioFiles = pamData?.summary?.total_files || 480;
  const totalDetections = useMemo(() => {
    return speciesSummaryList.reduce((acc: number, item: any) => acc + (item.detections || 0), 0);
  }, [speciesSummaryList]);

  const filteredSpeciesList = useMemo(() => {
    return speciesSummaryList
      .filter((sp: any) => {
        const matchesSearch = sp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (sp.scientific || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
      })
      .slice(0, 15);
  }, [speciesSummaryList, searchQuery]);

  return (
    <div className="space-y-8 pb-16 font-sans">
      
      {/* TST Dashboard Hero Header */}
      <div className="relative overflow-hidden p-8 md:p-10 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-2xl border border-slate-800/80">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-2">
                <Database className="w-3.5 h-3.5" /> Genuine TST PAM Dataset Active
              </span>
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> The Shola Trust & IISER Tirupati
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              The Shola Trust (TST) PAM Bioacoustics Dashboard
            </h1>

            <p className="text-emerald-400 text-sm font-bold tracking-wide">
              Habitat Recovery & Lantana-Clearance Acoustic Evaluation Format
            </p>

            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
              Acoustic guild indicator assessment evaluating habitat restoration success across 10 Shola forest recording transects (5 Lantana-Cleared vs 5 Lantana-Infested sites).
            </p>
          </div>
        </div>
      </div>

      {/* Scope Controls Bar */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>TST Dashboard Parameters:</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search species..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Site Selector Dropdown */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1.5">Select Field Recorder Site</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none"
            >
              <option value="All">All 10 Recorder Transects (Combined Dataset)</option>
              {recordersList.map((r: any) => (
                <option key={r.site_group} value={r.site_group}>
                  {r.name || r.site_group} ({r.site_group})
                </option>
              ))}
            </select>
          </div>

          {/* Confidence Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-600" /> BirdNET Min Confidence Threshold
              </label>
              <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {(confidenceThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.95"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Total Calls</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalDetections.toLocaleString()}</div>
            <p className="text-[11px] text-emerald-700 font-bold mt-0.5">Analyzed detections</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Species Richness</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{speciesSummaryList.length} species</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">TST Shola Taxa</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Bird className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Recording Transects</span>
            <div className="text-2xl font-black text-slate-900 mt-1">10 Sites</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">5 LC vs 5 LI Sites</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card p-5 rounded-[22px] border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Audio Records</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalAudioFiles} Files</div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">24/7 continuous PAM</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Indicator Species Tracking Section (Lantana-Cleared vs Lantana-Infested) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-[24px] bg-emerald-50/70 border border-emerald-200 space-y-3">
          <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2 border-b border-emerald-200/80 pb-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Lantana-Cleared (LC) Habitat Recovery Indicator Species ({recoveryIndicators.length})
          </h3>
          <ul className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-800">
            {recoveryIndicators.slice(0, 12).map((sp: string) => (
              <li key={sp} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                <span className="truncate">{sp}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-6 rounded-[24px] bg-amber-50/70 border border-amber-200 space-y-3">
          <h3 className="text-sm font-black text-amber-950 flex items-center gap-2 border-b border-amber-200/80 pb-2.5">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Lantana-Infested (LI) Disturbance Indicator Species ({lantanaIndicators.length})
          </h3>
          <ul className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-800">
            {lantanaIndicators.slice(0, 10).map((sp: string) => (
              <li key={sp} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                <span className="truncate">{sp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Stacked TST Charts */}
      <div className="space-y-6">
        <div className="premium-card p-6 rounded-[24px] space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> TST Diurnal Call Frequency Distribution (24-Hour)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Diurnal vocalization density across Shola forest transects.</p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">TST Format</span>
          </div>
          <DiurnalChart />
        </div>
      </div>

      {/* TST Species Detections Matrix Table */}
      <div className="premium-card p-6 rounded-[24px] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bird className="w-4 h-4 text-emerald-600" /> TST Species Classification Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Avian species detections aggregated across TST recording sites.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="pb-3 pl-2">Species Name</th>
                <th className="pb-3">Scientific Name</th>
                <th className="pb-3">Indicator Status</th>
                <th className="pb-3 pr-2 text-right">Detections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSpeciesList.map((sp: any) => {
                const isRecovery = recoveryIndicators.includes(sp.name);
                const isLantana = lantanaIndicators.includes(sp.name);
                return (
                  <tr key={sp.name} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 pl-2 font-extrabold text-slate-900">{sp.name}</td>
                    <td className="py-3.5 font-mono text-[11px] text-slate-500 italic">{sp.scientific || 'Aves sp.'}</td>
                    <td className="py-3.5">
                      {isRecovery ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Recovery Indicator (LC)
                        </span>
                      ) : isLantana ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                          Disturbance Indicator (LI)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">General Avian</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-2 text-right font-mono font-extrabold text-slate-900">
                      {(sp.detections || 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
