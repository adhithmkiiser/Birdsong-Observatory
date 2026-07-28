'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  FileSpreadsheet, 
  Filter, 
  Building, 
  CheckCircle2, 
  Bird, 
  ShieldCheck, 
  Activity, 
  Clock, 
  Globe 
} from 'lucide-react';
import { PROJECTS_DATA, STATIONS_DATA } from '@/lib/mockData';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';

export default function ReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('prj-01');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL_SITES');
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-28');
  const [reportTemplate, setReportTemplate] = useState<string>('comprehensive');

  const selectedProject = PROJECTS_DATA.find(p => p.id === selectedProjectId) || {
    id: 'none',
    name: 'All Projects Summary',
    description: 'Acoustic monitoring across all active research transects.',
    organization: 'IISER Tirupati Bird Lab',
    manager_name: 'Dr. Robin Vijayan',
    species_count: 0,
    total_detections: 0,
    stations_count: 0,
    public_visible: true,
    created_at: ''
  };

  const availableStations = selectedProjectId === 'ALL_PROJECTS'
    ? STATIONS_DATA
    : STATIONS_DATA.filter(s => s.project_id === selectedProjectId);

  const selectedStation = STATIONS_DATA.find(s => s.id === selectedStationId);

  const handlePrint = () => {
    window.print();
  };

  const REPORT_SPECIES_PRESET = [
    {
      id: 'spc-1',
      common_name: 'Malabar Whistling Thrush',
      scientific_name: 'Myiophonus horsfieldii',
      guild: 'Frugivore / Insectivore',
      iucn: 'LEAST CONCERN',
      calls: 0,
      photo: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=200&auto=format&fit=crop'
    },
    {
      id: 'spc-2',
      common_name: 'Asian Emerald Dove',
      scientific_name: 'Chalcophaps indica',
      guild: 'Granivore Canopy',
      iucn: 'LEAST CONCERN',
      calls: 0,
      photo: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=200&auto=format&fit=crop'
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner - Screen Only */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Automated Ecological Report Generator</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure project, site, and date parameters to generate publication-ready bioacoustic audit reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Export / Print Formal PDF Report
          </button>
        </div>
      </div>

      {/* Report Selection Controls Bar - Screen Only */}
      <div className="print:hidden p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-3">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Report Configuration Parameters:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Project Dropdown */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Project Scope</label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedStationId('ALL_SITES');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_PROJECTS">All Projects ({PROJECTS_DATA.length})</option>
              {PROJECTS_DATA.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Site / Station Dropdown */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Site / Station Scope</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL_SITES">All Sites in Project</option>
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>{s.station_name}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Preset Publication Report Format Document */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-5xl mx-auto space-y-6 text-slate-900 font-sans print:border-none print:shadow-none print:p-0">
        
        {/* Official Institution Header / Letterhead */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 via-indigo-800 to-slate-900 text-white font-black text-lg flex items-center justify-center shadow-lg">
              IISER
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">IISER Tirupati Bioacoustics Research Laboratory</h2>
              <p className="text-xs font-bold text-indigo-700">Wildlife Acoustic Monitoring Platform & Ecosystem Science</p>
              <p className="text-[10px] text-slate-500 font-medium">Sheshachalam Biosphere Reserve & Western Ghats Biodiversity Study</p>
            </div>
          </div>

          <div className="text-right font-mono text-xs text-slate-600">
            <div className="font-extrabold text-slate-900">REF: REP-2026-0728-IISER</div>
            <div>Generated: {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</div>
            <div className="text-emerald-700 font-bold">Verification Seal: APPROVED</div>
          </div>
        </div>

        {/* Report Scope & Parameters Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Selected Project</span>
            <strong className="text-slate-900 font-black truncate block">{selectedProject.name}</strong>
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Site Location</span>
            <strong className="text-indigo-700 font-black truncate block">
              {selectedStation ? selectedStation.station_name : 'All Sites Combined'}
            </strong>
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Monitoring Interval</span>
            <strong className="text-slate-900 font-black block">{startDate} to {endDate}</strong>
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Lead Investigator</span>
            <strong className="text-slate-900 font-black block">{selectedProject.manager_name}</strong>
          </div>
        </div>

        {/* Executive Summary & Key Metric Cards */}
        <div className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-l-4 border-indigo-600 pl-3">
            1. Executive Bioacoustic Summary
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Continuous 24/7 passive acoustic monitoring across <strong className="text-slate-900">{selectedProject.name}</strong>. Identified calls are classified using BirdNET V2.4 CNN model and cross-verified against IISER bioacoustic reference libraries.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
              <div className="text-[10px] font-extrabold text-emerald-800 uppercase">Total Detections</div>
              <div className="text-xl font-black text-emerald-950">{selectedProject.total_detections.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-700 font-bold">Audio call events</div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-center">
              <div className="text-[10px] font-extrabold text-amber-800 uppercase">Species Richness</div>
              <div className="text-xl font-black text-amber-950">{selectedProject.species_count} species</div>
              <div className="text-[10px] text-amber-700 font-bold">Unique verified taxa</div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-center">
              <div className="text-[10px] font-extrabold text-indigo-800 uppercase">Confidence Rate</div>
              <div className="text-xl font-black text-indigo-950">--</div>
              <div className="text-[10px] text-indigo-700 font-bold">Avg classification score</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-center">
              <div className="text-[10px] font-extrabold text-slate-600 uppercase">Shannon Index H&apos;</div>
              <div className="text-xl font-black text-slate-900">--</div>
              <div className="text-[10px] text-slate-500 font-bold">Diversity index</div>
            </div>
          </div>
        </div>

        {/* Diurnal Visual Chart */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-l-4 border-indigo-600 pl-3">
            2. Diurnal Vocalization Activity Distribution (24-Hour)
          </h3>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <DiurnalChart />
          </div>
        </div>

        {/* Hardware Station Telemetry Audit */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 border-l-4 border-indigo-600 pl-3">
            3. Deployed Acoustic Hardware Node Telemetry Audit
          </h3>

          {availableStations.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 font-medium">
              No deployed hardware nodes associated with this project.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {availableStations.map((stn) => (
                <div key={stn.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900">{stn.station_name}</div>
                    <div className="text-[10px] text-slate-500">{stn.description}</div>
                  </div>
                  <div className="text-right text-[10px] font-mono">
                    <div className="text-emerald-700 font-bold">Batt: {stn.battery_level}%</div>
                    <div className="text-slate-500">Temp: {stn.cpu_temperature}°C</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Official Signature Footer */}
        <div className="pt-8 border-t-2 border-slate-900 flex justify-between items-end text-xs">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Report Authored & Signed By</div>
            <div className="font-black text-slate-900 text-sm">{selectedProject.manager_name}</div>
            <div className="text-[11px] text-slate-500">Lead Bioacoustics Research Fellow · IISER Tirupati</div>
          </div>

          <div className="text-right">
            <div className="w-24 h-12 border-2 border-emerald-600 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black text-[10px] uppercase tracking-wider rotate-[-3deg] shadow-sm">
              SEAL: VERIFIED
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
