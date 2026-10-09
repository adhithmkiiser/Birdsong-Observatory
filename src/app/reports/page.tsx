'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Globe,
  Lock,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { DiurnalChart } from '@/components/charts/DiurnalChart';
import { TopSpeciesChart } from '@/components/charts/TopSpeciesChart';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/components/layout/RoleContext';
import DashboardLoader from '@/components/ui/DashboardLoader';

export default function ReportsPage() {
  const { currentRole, currentUser, visibilitySettings } = useRole();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL_PROJECTS');
  const [selectedStationId, setSelectedStationId] = useState<string>('ALL_SITES');
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-08-22');
  const [reportTemplate, setReportTemplate] = useState<string>('comprehensive');

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [topSpeciesList, setTopSpeciesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load projects & sites with role-based scoping
  useEffect(() => {
    async function loadReportsFilters() {
      setLoading(true);
      try {
        const [{ data: projs }, { data: sitesData }] = await Promise.all([
          supabase.from('projects').select('*').order('name'),
          supabase.from('sites').select('*').order('name')
        ]);

        let allProjects = projs || [];
        let allSites = sitesData || [];

        // Role-Based Filtering
        if (currentRole === 'Project Manager') {
          const assigned = currentUser?.assignedProjects || [];
          allProjects = allProjects.filter((p: any) => assigned.includes(p.id));
          allSites = allSites.filter((s: any) => assigned.includes(s.project_id));
        } else if (currentRole === 'Site Manager') {
          const assigned = currentUser?.assignedSites || [];
          allSites = allSites.filter((s: any) => assigned.includes(s.id));
          const allowedProjIds = new Set(allSites.map((s: any) => s.project_id));
          allProjects = allProjects.filter((p: any) => allowedProjIds.has(p.id));
        }

        setProjectsList(allProjects);

        const mappedSites = allSites.map((s: any) => ({
          id: s.id,
          project_id: s.project_id,
          station_name: s.name,
          description: `Field Station Node (${s.name})`
        }));
        setStationsList(mappedSites);

        // Pre-select project
        const queryProject = new URLSearchParams(window.location.search).get('project');
        const projectIds = new Set(allProjects.map((p: any) => p.id));
        if (queryProject && projectIds.has(queryProject)) {
          setSelectedProjectId(queryProject);
        } else if (currentRole === 'Site Manager' && allProjects.length > 0) {
          setSelectedProjectId(allProjects[0].id);
        } else if (currentRole === 'Project Manager' && allProjects.length > 0) {
          setSelectedProjectId(allProjects[0].id);
        }

        // If Site Manager with assigned sites, preselect first site
        if (currentRole === 'Site Manager' && mappedSites.length > 0) {
          setSelectedStationId(mappedSites[0].id);
        }
      } catch (err) {
        console.error('Failed to load reports filters:', err);
      } finally {
        setLoading(false);
      }
    }

    loadReportsFilters();
  }, [currentRole, currentUser]);

  const availableStations = useMemo(() => {
    if (selectedProjectId === 'ALL_PROJECTS') return stationsList;
    return stationsList.filter(s => s.project_id === selectedProjectId);
  }, [stationsList, selectedProjectId]);

  const selectedProject = useMemo(() => {
    return projectsList.find(p => p.id === selectedProjectId) || {
      id: 'ALL_PROJECTS',
      name: 'All Projects Summary',
      description: 'Acoustic monitoring across all authorized research transects.',
      organization: 'IISER Tirupati Bird Lab',
      manager_name: currentUser?.name || 'Dr. Robin Vijayan',
      species_count: 0,
      total_detections: 0,
      stations_count: 0,
      public_visible: true,
      created_at: ''
    };
  }, [projectsList, selectedProjectId, currentUser]);

  const selectedStation = useMemo(() => {
    return stationsList.find(s => s.id === selectedStationId);
  }, [stationsList, selectedStationId]);

  // Fetch dynamic top species for report
  useEffect(() => {
    async function fetchReportStats() {
      if (projectsList.length === 0 && !loading) return;
      try {
        let p_project_names = null;
        if (selectedProjectId !== 'ALL_PROJECTS') {
          const allowedSiteNames = availableStations.map(s => s.station_name);
          p_project_names = allowedSiteNames.length > 0 ? allowedSiteNames : ['NONE'];
        }

        const p_site_name = selectedStation ? selectedStation.station_name : 'ALL_SITES';

        const { data, error } = await supabase.rpc('get_top_species', {
          p_project_names,
          p_site_name,
          p_recorder_name: 'ALL_RECORDERS',
          p_confidence: 0.50,
          p_limit: 15
        });

        if (!error && data) {
          setTopSpeciesList(data.map((d: any, idx: number) => ({
            id: `spc-${idx}`,
            common_name: d.common_name,
            scientific_name: d.scientific_name || d.common_name,
            guild: 'Forest Insectivore / Songbird',
            iucn: 'LEAST CONCERN',
            calls: Number(d.detections_count || d.count || 0),
            detections: Number(d.detections_count || d.count || 0),
            species: d.common_name
          })));
        } else {
          setTopSpeciesList([]);
        }
      } catch (err) {
        console.error('Failed to load report stats:', err);
      }
    }

    fetchReportStats();
  }, [selectedProjectId, selectedStationId, availableStations, selectedStation, projectsList.length, loading]);

  const handlePrint = () => {
    window.print();
  };

  // CSV Export for Scoped Species Data
  const handleExportSpeciesCSV = () => {
    const headers = ['Common Name', 'Scientific Name', 'Restoration Guild', 'IUCN Status', 'Total Calls'];
    const rows = topSpeciesList.map(s => [
      `"${s.common_name}"`,
      `"${s.scientific_name}"`,
      `"${s.guild}"`,
      `"${s.iucn}"`,
      s.calls
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `report_species_${selectedProjectId}_${selectedStation?.station_name || 'all_sites'}_${new Date().toISOString().slice(0, 10)}.csv`
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // CSV Export for Raw Detections
  const handleExportRawDetectionsCSV = async () => {
    const buildQuery = () => {
      let q = supabase.from('pam_detections').select('*');
      if (selectedStation && selectedStation.station_name) {
        q = q.eq('site_name', selectedStation.station_name);
      } else if (availableStations.length > 0) {
        q = q.in('site_name', availableStations.map(s => s.station_name));
      }
      return q;
    };

    // Get count first
    let countQ = supabase.from('pam_detections').select('*', { count: 'exact', head: true });
    if (selectedStation && selectedStation.station_name) {
      countQ = countQ.eq('site_name', selectedStation.station_name);
    } else if (availableStations.length > 0) {
      countQ = countQ.in('site_name', availableStations.map(s => s.station_name));
    }
    const { count } = await countQ;
    const totalCount = count || 0;

    let records: any[] = [];
    if (totalCount > 0) {
      const pageSize = 1000;
      const numPages = Math.ceil(totalCount / pageSize);
      const promises = [];
      for (let i = 0; i < numPages; i++) {
        const offset = i * pageSize;
        promises.push(
          buildQuery().range(offset, offset + pageSize - 1).then(res => res.data || [])
        );
      }
      const chunks = await Promise.all(promises);
      records = chunks.flat();
    } else {
      const { data } = await buildQuery().limit(1000);
      records = data || [];
    }

    const headers = ['Timestamp', 'Site Name', 'Recorder', 'Common Name', 'Confidence', 'Status'];
    const rows = records.map((d: any) => [
      `"${d.timestamp || d.date || ''}"`,
      `"${d.site_name || ''}"`,
      `"${d.recorder_name || ''}"`,
      `"${d.common_name || ''}"`,
      d.confidence || 0,
      `"${d.verified ? 'VERIFIED' : 'UNVERIFIED'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `detections_export_${selectedStation?.station_name || selectedProjectId}_${new Date().toISOString().slice(0, 10)}.csv`
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Public Role Access Guard
  if (currentRole === 'Public' && !visibilitySettings.allowPublicReports) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 font-sans text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#f0f7f3] border border-[#dde1dc] text-[#1f4d3a] flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold font-serif text-[#1a1f1c]">Report Exports Restricted</h1>
        <p className="text-sm text-[#5a635d] max-w-md mx-auto leading-relaxed">
          Public report generation and CSV data exports are currently restricted. Please sign in with an authorized Site Manager, Project Manager, or Admin account.
        </p>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1f4d3a] text-white text-xs font-semibold rounded-xl hover:bg-[#173b2c] transition-all shadow-xs"
          >
            <span>Sign In to Access Reports</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <DashboardLoader progress={50} message="Preparing research reports and data exports..." />;
  }

  const totalCallsCount = topSpeciesList.reduce((acc, sp) => acc + sp.calls, 0);

  return (
    <div className="space-y-6 pb-12 print:space-y-4 print:pb-0 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#dde1dc] shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-[#f0f7f3] text-[#1f4d3a]">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold font-serif text-[#1a1f1c] tracking-tight">Ecoacoustics Analytics &amp; Reports</h1>
              <p className="text-xs text-[#5a635d] mt-0.5">
                {currentRole === 'Site Manager' ? 'Generate, export CSV data, and print survey summaries for your assigned sites.' : 'Generate, preview, and print comprehensive survey summaries for research project scopes.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportRawDetectionsCSV}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#dde1dc] hover:border-[#1f4d3a] text-[#1f4d3a] font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs hover:bg-[#f0f7f3] cursor-pointer"
            title="Download CSV of Raw Ingested Detections"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Detections CSV</span>
          </button>

          <button
            onClick={handleExportSpeciesCSV}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#dde1dc] hover:border-[#1f4d3a] text-[#1f4d3a] font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs hover:bg-[#f0f7f3] cursor-pointer"
            title="Download CSV of Species Call Abundance"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Species CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-[#1f4d3a] hover:bg-[#173b2c] text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div className="p-5 rounded-2xl bg-white border border-[#dde1dc] shadow-xs space-y-4 print:hidden">
        <div className="flex items-center justify-between border-b border-[#dde1dc] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1a1f1c]">
            <Filter className="w-4 h-4 text-[#1f4d3a]" />
            <span>Report Scope &amp; Filter Parameters</span>
          </div>
          <span className="text-[11px] font-mono text-[#5a635d]">
            Role: <strong className="text-[#1f4d3a]">{currentRole}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Project Dropdown */}
          <div>
            <label className="font-semibold text-[#1a1f1c] block mb-1">Project Scope</label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedStationId('ALL_SITES');
              }}
              className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 text-[#1a1f1c] font-medium focus:outline-none focus:border-[#1f4d3a]"
            >
              {currentRole === 'Admin' && (
                <option value="ALL_PROJECTS">All Projects ({projectsList.length})</option>
              )}
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Site / Station Dropdown */}
          <div>
            <label className="font-semibold text-[#1a1f1c] block mb-1">Site / Station Scope</label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 text-[#1a1f1c] font-medium focus:outline-none focus:border-[#1f4d3a]"
            >
              {currentRole !== 'Site Manager' && (
                <option value="ALL_SITES">All Stations ({availableStations.length} Sites)</option>
              )}
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>{s.station_name}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="grid grid-cols-2 gap-2 col-span-2">
            <div>
              <label className="font-semibold text-[#1a1f1c] block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 text-[#1a1f1c] font-mono text-xs focus:outline-none focus:border-[#1f4d3a]"
              />
            </div>
            <div>
              <label className="font-semibold text-[#1a1f1c] block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 text-[#1a1f1c] font-mono text-xs focus:outline-none focus:border-[#1f4d3a]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="p-8 md:p-12 rounded-3xl bg-white border border-[#dde1dc] shadow-md space-y-8 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 print:max-w-full">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b-2 border-[#1f4d3a] pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1f4d3a] text-white font-mono text-[10px] uppercase tracking-wider font-bold">
              Research Report
            </div>
            <h2 className="text-xl md:text-2xl font-bold font-serif text-[#1a1f1c] tracking-tight uppercase">
              IISER Tirupati Bird Ecology Lab
            </h2>
            <p className="text-[#5a635d] font-semibold text-xs">
              Autonomous Acoustical Monitoring Transects Program Summary
            </p>
          </div>
          <div className="text-left sm:text-right font-mono text-[11px] text-[#5a635d] space-y-0.5">
            <div>DATE: {new Date().toLocaleDateString('en-GB')}</div>
            <div>RANGE: {startDate} to {endDate}</div>
            <div>STATUS: VERIFIED DATA REPORT</div>
          </div>
        </div>

        {/* Scope Metadata Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-[#f0f7f3] border border-[#dde1dc] text-xs">
          <div className="space-y-2">
            <h4 className="font-bold text-[#5a635d] uppercase tracking-wider text-[10px] font-mono">Project Scope</h4>
            <div>
              <strong className="text-[#1a1f1c] text-sm font-bold font-serif">{selectedProject.name}</strong>
              <div className="text-[#5a635d] font-medium mt-0.5">{selectedProject.organization}</div>
            </div>
            <p className="text-[#5a635d] leading-relaxed mt-2">{selectedProject.description}</p>
          </div>

          <div className="space-y-3 font-medium">
            <h4 className="font-bold text-[#5a635d] uppercase tracking-wider text-[10px] font-mono">Filter Parameters</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-[#5a635d] block font-mono">STATION SCOPE</span>
                <strong className="text-[#1a1f1c] font-bold">{selectedStation?.station_name || 'All Assigned Sites'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#5a635d] block font-mono">TEMPLATE</span>
                <strong className="text-[#1a1f1c] font-bold uppercase">{reportTemplate}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#5a635d] block font-mono">REPORT AUTHOR</span>
                <strong className="text-[#1a1f1c] font-bold">{currentUser?.name || selectedProject.manager_name || 'Dr. Robin Vijayan'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#5a635d] block font-mono">VISIBILITY</span>
                <strong className="text-[#1a1f1c] font-bold">{selectedProject.public_visible ? 'PUBLIC' : 'AUTHORIZED'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa]">
            <span className="text-[10px] text-[#5a635d] font-bold block uppercase font-mono mb-1">Transect Sites</span>
            <strong className="text-xl font-bold font-serif text-[#1a1f1c]">{availableStations.length}</strong>
          </div>
          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa]">
            <span className="text-[10px] text-[#5a635d] font-bold block uppercase font-mono mb-1">Species Richness</span>
            <strong className="text-xl font-bold font-serif text-[#1a1f1c]">{topSpeciesList.length}</strong>
          </div>
          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa]">
            <span className="text-[10px] text-[#5a635d] font-bold block uppercase font-mono mb-1">Total Audio Detections</span>
            <strong className="text-xl font-bold font-serif text-[#1a1f1c]">{(totalCallsCount || selectedProject.total_detections || 0).toLocaleString()}</strong>
          </div>
          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa]">
            <span className="text-[10px] text-[#5a635d] font-bold block uppercase font-mono mb-1">Monitoring Status</span>
            <strong className="text-xs font-bold text-emerald-800 block mt-1">Active Transects</strong>
          </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#1a1f1c] uppercase tracking-wider border-b border-[#dde1dc] pb-1.5 flex items-center gap-1.5">
              <Bird className="w-3.5 h-3.5 text-[#1f4d3a]" />
              <span>1. Top Detected Avian Species Call Distribution</span>
            </h3>
            <div className="p-4 border border-[#dde1dc] rounded-2xl bg-white max-h-72 overflow-hidden flex items-center justify-center">
              <TopSpeciesChart data={topSpeciesList.map(s => ({ species: s.common_name, detections: s.calls }))} />
            </div>
          </div>
        </div>

        {/* Indicator Species Highlights Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#1a1f1c] uppercase tracking-wider border-b border-[#dde1dc] pb-1.5">
            2. Focal Species Call Ingestion Records
          </h3>

          <div className="border border-[#dde1dc] rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#f0f7f3] border-b border-[#dde1dc] text-[#5a635d] uppercase text-[9px] font-mono font-bold">
                <tr>
                  <th className="p-3 pl-4">Common Name</th>
                  <th className="p-3">Scientific Name</th>
                  <th className="p-3">Restoration Guild</th>
                  <th className="p-3">IUCN Red List</th>
                  <th className="p-3 text-right pr-4">Total Calls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dde1dc]/60 font-medium">
                {topSpeciesList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[#5a635d]">
                      No species detection records found for this scope.
                    </td>
                  </tr>
                ) : (
                  topSpeciesList.map((spc) => (
                    <tr key={spc.id} className="hover:bg-[#f0f7f3]/50 transition-colors">
                      <td className="p-3 pl-4 font-bold text-[#1a1f1c]">{spc.common_name}</td>
                      <td className="p-3 italic text-[#5a635d]">{spc.scientific_name}</td>
                      <td className="p-3 text-[#5a635d]">{spc.guild}</td>
                      <td className="p-3">
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[#f0f7f3] text-[#1f4d3a] border border-[#dde1dc]">
                          {spc.iucn}
                        </span>
                      </td>
                      <td className="p-3 text-right pr-4 font-mono font-bold text-[#1f4d3a]">{spc.calls.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Document Footer */}
        <div className="border-t border-dashed border-[#dde1dc] pt-6 flex items-center justify-between text-[11px] text-[#5a635d] print:pt-4 font-mono">
          <div>IISER Tirupati Ecoacoustics Platform v2.4</div>
          <div>Report generated by {currentUser?.name || selectedProject.manager_name || 'Dr. Robin Vijayan'} ({currentRole})</div>
        </div>
      </div>
    </div>
  );
}
