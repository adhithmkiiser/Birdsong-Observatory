'use client';

import React, { useState, useEffect } from 'react';
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
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { supabase } from '@/lib/supabase';

export default function ReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL_PROJECTS');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL_SITES');
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-28');
  const [reportTemplate, setReportTemplate] = useState<string>('comprehensive');

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('projects').select('*').order('created_at').then(({ data }) => {
      setProjectsList(data || []);
    });
    supabase.from('stations').select('*').order('station_name').then(({ data }) => {
      setStationsList(data || []);
    });
  }, []);

  const selectedProject = projectsList.find(p => p.id === selectedProjectId) || {
    id: 'none',
    name: 'All Projects Summary',
    description: 'Acoustic monitoring across all active research transects.',
    organization: 'IISER Tirupati Bird Lab',
    manager_name: '',
    species_count: 0,
    total_detections: 0,
    stations_count: 0,
    public_visible: true,
    created_at: ''
  };

  const availableStations = selectedProjectId === 'ALL_PROJECTS'
    ? stationsList
    : stationsList.filter(s => s.project_id === selectedProjectId);

  const selectedStation = stationsList.find(s => s.id === selectedStationId);

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
      confidence: '--'
    },
    {
      id: 'spc-2',
      common_name: 'Crimson-backed Sunbird',
      scientific_name: 'Leptocoma minima',
      guild: 'Nectarivore / Insectivore',
      iucn: 'LEAST CONCERN',
      calls: 0,
      confidence: '--'
    }
  ];

  return (
    <div className="space-y-6 pb-12 print:space-y-4 print:pb-0">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Ecoacoustics Analytics &amp; Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Generate, preview, and print comprehensive survey summaries for research project scopes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 print:hidden">
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
              <option value="ALL_PROJECTS">All Projects ({projectsList.length})</option>
              {projectsList.map((p) => (
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
              <option value="ALL_SITES">All Stations ({availableStations.length} Sites)</option>
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>{s.station_name}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="grid grid-cols-2 gap-2 col-span-2">
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="p-8 md:p-12 rounded-[32px] bg-white border border-slate-200 shadow-xl space-y-8 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 print:max-w-full">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b-2 border-slate-900 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider">
              Research Report
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight uppercase">
              IISER Tirupati Bird Ecology Lab
            </h2>
            <p className="text-slate-500 font-bold text-xs">
              Autonomous Acoustical Monitoring Transects Program Summary
            </p>
          </div>
          <div className="text-left sm:text-right font-mono text-[11px] text-slate-500 space-y-0.5">
            <div>DATE: {new Date().toLocaleDateString('en-GB')}</div>
            <div>RANGE: {startDate} to {endDate}</div>
            <div>STATUS: DRAFT SUMMARY</div>
          </div>
        </div>

        {/* Scope Metadata Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div className="space-y-2">
            <h4 className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Project Scope</h4>
            <div>
              <strong className="text-slate-900 text-sm font-black">{selectedProject.name}</strong>
              <div className="text-slate-500 font-semibold mt-0.5">{selectedProject.organization}</div>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed mt-2">{selectedProject.description}</p>
          </div>

          <div className="space-y-3 font-medium">
            <h4 className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Filter Parameters</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">STATION SCOPE</span>
                <strong className="text-slate-900 font-black">{selectedStation?.station_name || 'All Sites'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">TEMPLATE</span>
                <strong className="text-slate-900 font-black uppercase">{reportTemplate}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">LEAD PI</span>
                <strong className="text-slate-900 font-black">{selectedProject.manager_name || 'Dr. Robin Vijayan'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">VISIBILITY</span>
                <strong className="text-slate-900 font-black">{selectedProject.public_visible ? 'PUBLIC' : 'RESTRICTED'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Transect Sites</span>
            <strong className="text-xl font-black text-slate-900">{selectedProject.stations_count ?? 0}</strong>
          </div>
          <div className="p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Species Richness</span>
            <strong className="text-xl font-black text-slate-900">{selectedProject.species_count ?? 0}</strong>
          </div>
          <div className="p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Total Audio Detections</span>
            <strong className="text-xl font-black text-slate-900">{(selectedProject.total_detections ?? 0).toLocaleString()}</strong>
          </div>
          <div className="p-4 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Survey Period</span>
            <strong className="text-sm font-black text-slate-900 block mt-1">28 Days</strong>
          </div>
        </div>

        {/* Charts Sections */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b pb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 1. Diurnal Vocalization Activity Profile
            </h3>
            <div className="p-4 border rounded-2xl bg-white max-h-72 overflow-hidden flex items-center justify-center">
              <DiurnalChart />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b pb-1 flex items-center gap-1">
              <Bird className="w-3.5 h-3.5" /> 2. Identified Species Call Accumulation
            </h3>
            <div className="p-4 border rounded-2xl bg-white max-h-72 overflow-hidden flex items-center justify-center">
              <TopSpeciesChart />
            </div>
          </div>
        </div>

        {/* Indicator Species Highlights Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b pb-1">
            3. Focal / Restoration Indicator Species Call Ingestion Logs
          </h3>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[9px] font-black">
                <tr>
                  <th className="p-3 pl-4">Common Name</th>
                  <th className="p-3">Scientific Name</th>
                  <th className="p-3">Restoration Guild</th>
                  <th className="p-3">IUCN Red List</th>
                  <th className="p-3 text-right pr-4">Total Calls Ingested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {REPORT_SPECIES_PRESET.map((spc) => (
                  <tr key={spc.id}>
                    <td className="p-3 pl-4 font-bold text-slate-900">{spc.common_name}</td>
                    <td className="p-3 italic text-slate-600">{spc.scientific_name}</td>
                    <td className="p-3 font-semibold text-slate-500">{spc.guild}</td>
                    <td className="p-3">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {spc.iucn}
                      </span>
                    </td>
                    <td className="p-3 text-right pr-4 font-mono font-bold text-slate-900">{spc.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Document Footer Signature */}
        <div className="border-t border-dashed border-slate-300 pt-8 flex items-center justify-between text-[11px] text-slate-400 font-medium print:pt-6">
          <div>IISER Tirupati Ecoacoustics Platform Version 1.0</div>
          <div>Report generated automatically by {selectedProject.manager_name || 'Dr. Robin Vijayan'}</div>
        </div>
      </div>
    </div>
  );
}
