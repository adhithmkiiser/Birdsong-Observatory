'use client';

import React from 'react';
import { Filter } from 'lucide-react';
import { useDashboardStore } from '@/lib/store/useDashboardStore';

interface DashboardFiltersProps {
  totalDetections: number;
  projectsList: any[];
  stationsList: any[];
  recordersRegistryList: any[];
}

export function DashboardFilters({
  totalDetections,
  projectsList,
  stationsList,
  recordersRegistryList
}: DashboardFiltersProps) {
  const {
    selectedProjectId,
    selectedStationId,
    selectedRecorderId,
    confidenceThreshold,
    setProject,
    setStation,
    setRecorder,
    setConfidence
  } = useDashboardStore();

  const availableStations = selectedProjectId === 'ALL_PROJECTS'
    ? stationsList
    : stationsList.filter(s => s.project_id === selectedProjectId);
    
  const selectedProject = selectedProjectId !== 'ALL_PROJECTS' ? projectsList.find(p => p.id === selectedProjectId) : null;
  const selectedStation = selectedStationId !== 'ALL_SITES' ? stationsList.find(s => s.id === selectedStationId) : null;

  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-900">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Dashboard Scope & Real-Time Filter Toolbar</span>
        </div>
        <div className="text-[11px] font-bold text-slate-500">
          Showing <strong className="text-indigo-600 font-extrabold">{totalDetections.toLocaleString()}</strong> detections at <strong className="text-emerald-600 font-extrabold">{(confidenceThreshold * 100).toFixed(0)}%</strong> confidence threshold
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="font-extrabold text-slate-700 block mb-1.5">1. Select Research Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setProject(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL_PROJECTS">All Projects ({projectsList.length})</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-extrabold text-slate-700 block mb-1.5">2. Select Site Node</label>
          <select
            value={selectedStationId}
            onChange={(e) => setStation(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL_SITES">All Sites in Chosen Project ({availableStations.length})</option>
            {availableStations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.station_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-extrabold text-slate-700 block mb-1.5">3. Select Recorder Hardware</label>
          <select
            value={selectedRecorderId}
            onChange={(e) => setRecorder(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL_RECORDERS">All Recorders in Site</option>
            {recordersRegistryList
              .filter(r => {
                if (selectedProjectId !== 'ALL_PROJECTS') {
                  const isRecorderInProjectSites = availableStations.some(s => s.station_name.includes(r.site_name));
                  if (!isRecorderInProjectSites) return false;
                }
                if (selectedStation && !selectedStation.station_name.includes(r.site_name)) return false;
                return true;
              })
              .map(r => (
                <option key={r.id || r.recorder_id} value={r.recorder_id}>
                  {r.recorder_id} ({r.site_name})
                </option>
              ))
            }
          </select>
        </div>

        <div>
          <label className="font-extrabold text-slate-700 flex items-center justify-between mb-1.5">
            <span>4. Min Confidence Filter</span>
            <span className="font-mono text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md border border-indigo-200 font-bold">
              {(confidenceThreshold * 100).toFixed(0)}%
            </span>
          </label>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 h-[42px] flex items-center">
            <input
              type="range"
              min="0.2"
              max="0.99"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
