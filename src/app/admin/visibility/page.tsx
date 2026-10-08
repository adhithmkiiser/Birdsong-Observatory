'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Lock, 
  Globe, 
  Layers, 
  Database, 
  Radio, 
  MapPin, 
  LineChart, 
  Clock, 
  Grid, 
  BarChart3, 
  Leaf, 
  Cpu, 
  Bird, 
  CheckSquare, 
  FileText, 
  Check, 
  AlertCircle,
  Sparkles,
  Sliders
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';
import { AdminNavTabs } from '@/components/admin/AdminNavTabs';

type DashboardType = 'commonPam' | 'lantanaPam' | 'liveRecorder';

interface MenuTabDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  defaultPublic: boolean;
}

const COMMON_PAM_TABS: MenuTabDefinition[] = [
  { id: 'summary', name: '1. Summary Overview', description: 'High-level avian metrics, bird of the year, and KPI statistics.', icon: Layers, defaultPublic: true },
  { id: 'map', name: '2. Survey Site Map', description: 'Interactive spatial node locations and species richness overlays.', icon: MapPin, defaultPublic: true },
  { id: 'heatmap', name: '3. Species Detection (Heatmap)', description: 'Hour-by-hour bioacoustic call matrix across all detected taxa.', icon: Grid, defaultPublic: true },
  { id: 'trends', name: '4. Species Activity & Trend Analysis', description: 'Multi-species longitudinal activity trajectories and volume graphs.', icon: LineChart, defaultPublic: true },
  { id: 'diurnal', name: '5. Diurnal Activity Patterns', description: '24-hour daily vocalization rhythms and dawn/dusk peaks.', icon: Clock, defaultPublic: true },
  { id: 'diversity', name: '6. Avian Diversity & Richness Over Time', description: 'Temporal unique species count and richness progression.', icon: BarChart3, defaultPublic: true },
];

const LANTANA_PAM_TABS: MenuTabDefinition[] = [
  { id: 'summary', name: '1. Summary Overview', description: 'Restoration summary, habitat comparison (LC vs LI), and totals.', icon: Layers, defaultPublic: true },
  { id: 'map', name: '2. Survey Site Map', description: 'Lantana experimental plots and control transect mapping.', icon: MapPin, defaultPublic: true },
  { id: 'heatmap', name: '3. Species Detection (Heatmap)', description: 'Species occurrence frequencies across restoration treatments.', icon: Grid, defaultPublic: true },
  { id: 'richness', name: '4. Avian Species Richness', description: 'Comparative species richness between cleared and invaded plots.', icon: BarChart3, defaultPublic: true },
  { id: 'explorer', name: '5. Species Explorer', description: 'Individual taxon call profiles, ecological factors, and audio clips.', icon: Bird, defaultPublic: true },
  { id: 'indicators', name: '6. Restoration Indicators', description: 'Specialist indicator species tracking forest recovery.', icon: Leaf, defaultPublic: true },
  { id: 'performance', name: '7. System Diagnostics & Hardware', description: 'Recorder file processing logs, expected vs actual files.', icon: Cpu, defaultPublic: false },
];

const LIVE_RECORDER_TABS: MenuTabDefinition[] = [
  { id: 'summary', name: '1. Summary', description: 'Live audio detection count, active streaming nodes, and top species.', icon: Layers, defaultPublic: true },
  { id: 'map', name: '2. Survey Site Map', description: 'Realtime active GPS coordinates and node status map.', icon: MapPin, defaultPublic: true },
  { id: 'accumulation', name: '3. Species Accumulation Curve', description: 'Cumulative taxa discovery curve with daily/weekly/monthly filters.', icon: LineChart, defaultPublic: true },
  { id: 'diurnal', name: '4. Diurnal Activity Pattern', description: '24-hour bar chart and 24-hour radial Nightingale polar clock.', icon: Clock, defaultPublic: true },
  { id: 'live', name: '5. Live Stream Feed', description: 'Realtime incoming classification feed with audio spectrogram player.', icon: Radio, defaultPublic: true },
  { id: 'stations', name: '6. Stations & Nodes', description: 'Field recorder hardware telemetry, battery, and heartbeat pings.', icon: Cpu, defaultPublic: true },
  { id: 'species', name: '7. Species Catalog', description: 'Avian photo library, IUCN status, and ecological trait metrics.', icon: Bird, defaultPublic: true },
  { id: 'review', name: '8. Review Queue', description: 'Auditory verification and expert validation workflow.', icon: CheckSquare, defaultPublic: false },
  { id: 'reports', name: '9. Reports & Export', description: 'Formatted CSV detection exports and research summaries.', icon: FileText, defaultPublic: false },
];

export default function PublicVisibilityAdminPage() {
  const { 
    currentRole, 
    currentUser, 
    visibilitySettings, 
    updateVisibilitySetting, 
    updateMenuVisibility,
    isTabVisibleForPublic 
  } = useRole();

  const [selectedDashboardType, setSelectedDashboardType] = useState<DashboardType>('commonPam');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('ALL');

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [saveToast, setSaveToast] = useState(false);

  // Load projects and sites from DB
  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: projs }, { data: sitesData }, { data: lantanaSites }] = await Promise.all([
          supabase.from('projects').select('*').order('name'),
          supabase.from('sites').select('*').order('name'),
          supabase.from('lantana_sites').select('*').order('site_name')
        ]);

        let pList = projs || [];
        let sList = sitesData || [];
        let lList = (lantanaSites || []).map((ls: any) => ({
          id: ls.id,
          name: ls.site_name,
          project_id: ls.project_id || 'lantana_project',
          source: 'Lantana'
        }));

        // Role-based filtering
        if (currentRole === 'Project Manager') {
          const assigned = currentUser?.assignedProjects || [];
          pList = pList.filter((p: any) => assigned.includes(p.id));
          sList = sList.filter((s: any) => assigned.includes(s.project_id));
        }

        setProjectsList(pList);
        setSitesList([...sList, ...lList]);
      } catch (e) {
        console.error('Failed to load projects/sites for visibility manager:', e);
      }
    }
    loadData();
  }, [currentRole, currentUser]);

  // Filter projects by active dashboard type
  const availableProjects = useMemo(() => {
    if (selectedDashboardType === 'commonPam') {
      return projectsList.filter((p: any) => !p.project_type || p.project_type === 'PAM');
    } else if (selectedDashboardType === 'lantanaPam') {
      return projectsList.filter((p: any) => p.project_type === 'Lantana');
    } else {
      return projectsList.filter((p: any) => p.project_type === 'Live');
    }
  }, [projectsList, selectedDashboardType]);

  // Filter sites by selected project
  const availableSites = useMemo(() => {
    if (selectedProjectId === 'ALL') {
      const allowedProjIds = new Set(availableProjects.map((p: any) => p.id));
      return sitesList.filter((s: any) => allowedProjIds.has(s.project_id));
    }
    return sitesList.filter((s: any) => s.project_id === selectedProjectId);
  }, [sitesList, selectedProjectId, availableProjects]);

  // Reset project selection when dashboard type changes
  useEffect(() => {
    setSelectedProjectId('ALL');
    setSelectedSiteId('ALL');
  }, [selectedDashboardType]);

  const scopeKey = useMemo(() => {
    if (selectedProjectId === 'ALL' && selectedSiteId === 'ALL') return 'ALL';
    if (selectedSiteId !== 'ALL') return `${selectedProjectId}:${selectedSiteId}`;
    return selectedProjectId;
  }, [selectedProjectId, selectedSiteId]);

  const activeTabsList = useMemo(() => {
    if (selectedDashboardType === 'commonPam') return COMMON_PAM_TABS;
    if (selectedDashboardType === 'lantanaPam') return LANTANA_PAM_TABS;
    return LIVE_RECORDER_TABS;
  }, [selectedDashboardType]);

  const handleToggleTab = (tabId: string, currentVal: boolean) => {
    updateMenuVisibility(selectedDashboardType, tabId, !currentVal, scopeKey);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleEnableAll = () => {
    activeTabsList.forEach(tab => {
      updateMenuVisibility(selectedDashboardType, tab.id, true, scopeKey);
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleDisableNonEssential = () => {
    activeTabsList.forEach(tab => {
      const isEssential = ['summary', 'map', 'species', 'diurnal'].includes(tab.id);
      updateMenuVisibility(selectedDashboardType, tab.id, isEssential, scopeKey);
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  if (currentRole !== 'Admin' && currentRole !== 'Project Manager') {
    return (
      <div className="space-y-6 pb-16 font-sans">
        <AdminNavTabs />
        <div className="p-10 rounded-2xl bg-white border border-[#dde1dc] text-center space-y-4 max-w-lg mx-auto shadow-xs mt-8">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-serif text-[#1a1f1c]">Access Restricted</h2>
          <p className="text-xs text-[#5a635d] leading-relaxed">
            Public visibility and access controls are restricted to Administrators and Project Managers. You are currently logged in as <strong className="text-[#1f4d3a]">{currentRole}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Central Admin Console Nav Tabs */}
      <AdminNavTabs />

      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-white border border-[#dde1dc] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f0f7f3] border border-[#dde1dc] text-[#1f4d3a] font-mono font-bold text-xs">
            <Globe className="w-3.5 h-3.5" />
            <span>PUBLIC ACCESS GOVERNANCE</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-tight text-[#1a1f1c]">
            Public Visibility &amp; Permissions Console
          </h1>
          <p className="text-[#5a635d] text-xs sm:text-sm max-w-2xl leading-relaxed">
            Choose what public visitors and guests are allowed to see. Select the dashboard type, project, and site to customize individual dashboard menu visibility and privacy switches.
          </p>
        </div>

        {saveToast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Permissions Saved &amp; Applied!</span>
          </div>
        )}
      </div>

      {/* ─── 1. DASHBOARD TYPE SELECTOR PILLS ────────────────────────────────── */}
      <div className="p-4 bg-white border border-[#dde1dc] rounded-2xl shadow-xs space-y-3">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#5a635d]">
          1. Select Dashboard Type:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedDashboardType('commonPam')}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              selectedDashboardType === 'commonPam'
                ? 'bg-[#1f4d3a] text-white border-[#1f4d3a] shadow-xs'
                : 'bg-[#fafbfa] text-[#1a1f1c] border-[#dde1dc] hover:bg-[#f0f7f3]'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              selectedDashboardType === 'commonPam' ? 'bg-white/20 text-white' : 'bg-[#eaf2ed] text-[#1f4d3a]'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs">Common PAM Dashboard</div>
              <div className={`text-[11px] ${selectedDashboardType === 'commonPam' ? 'text-white/80' : 'text-[#5a635d]'}`}>
                Standard bioacoustic transects
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedDashboardType('lantanaPam')}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              selectedDashboardType === 'lantanaPam'
                ? 'bg-[#1f4d3a] text-white border-[#1f4d3a] shadow-xs'
                : 'bg-[#fafbfa] text-[#1a1f1c] border-[#dde1dc] hover:bg-[#f0f7f3]'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              selectedDashboardType === 'lantanaPam' ? 'bg-white/20 text-white' : 'bg-[#eaf2ed] text-[#1f4d3a]'
            }`}>
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs">Lantana PAM Dashboard</div>
              <div className={`text-[11px] ${selectedDashboardType === 'lantanaPam' ? 'text-white/80' : 'text-[#5a635d]'}`}>
                Restoration &amp; indicator metrics
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedDashboardType('liveRecorder')}
            className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              selectedDashboardType === 'liveRecorder'
                ? 'bg-[#1f4d3a] text-white border-[#1f4d3a] shadow-xs'
                : 'bg-[#fafbfa] text-[#1a1f1c] border-[#dde1dc] hover:bg-[#f0f7f3]'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              selectedDashboardType === 'liveRecorder' ? 'bg-white/20 text-white' : 'bg-[#eaf2ed] text-[#1f4d3a]'
            }`}>
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs">Live Recorder Dashboard</div>
              <div className={`text-[11px] ${selectedDashboardType === 'liveRecorder' ? 'text-white/80' : 'text-[#5a635d]'}`}>
                Realtime streaming field nodes
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ─── 2. SCOPE FILTERS (PROJECT & SITE) ────────────────────────────────── */}
      <div className="p-5 bg-white border border-[#dde1dc] rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#dde1dc] pb-3">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#5a635d]">
            2. Scope Settings:
          </div>
          <span className="text-[11px] font-mono text-[#5a635d]">
            Targeting: <strong className="text-[#1f4d3a]">{scopeKey === 'ALL' ? 'Global Default' : scopeKey}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-xs text-[#1a1f1c] block mb-1.5">Project Scope</label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedSiteId('ALL');
              }}
              className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3.5 py-2.5 text-xs text-[#1a1f1c] font-medium focus:outline-none focus:border-[#1f4d3a]"
            >
              <option value="ALL">All {selectedDashboardType === 'commonPam' ? 'Common PAM' : selectedDashboardType === 'lantanaPam' ? 'Lantana' : 'Live'} Projects (Default)</option>
              {availableProjects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-xs text-[#1a1f1c] block mb-1.5">Site / Station Scope</label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3.5 py-2.5 text-xs text-[#1a1f1c] font-medium focus:outline-none focus:border-[#1f4d3a]"
            >
              <option value="ALL">All Sites in Project (Default)</option>
              {availableSites.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name || s.site_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── 3. DEDICATED DASHBOARD MENU TOGGLE SWITCH LIST ───────────────────── */}
      <div className="p-6 bg-white border border-[#dde1dc] rounded-2xl shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dde1dc] pb-4">
          <div>
            <h2 className="text-base font-bold font-serif text-[#1a1f1c] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1f4d3a]" />
              <span>
                {selectedDashboardType === 'commonPam' ? 'Common PAM Dashboard Menu' : selectedDashboardType === 'lantanaPam' ? 'Lantana PAM Dashboard Menu' : 'Live Recorder Dashboard Menu'}
              </span>
            </h2>
            <p className="text-xs text-[#5a635d] mt-0.5">
              Toggle items ON or OFF to show or hide them from the public dashboard sidebar and views.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnableAll}
              className="px-3 py-1.5 rounded-lg border border-[#dde1dc] text-[#1f4d3a] hover:bg-[#f0f7f3] text-xs font-semibold cursor-pointer transition-colors"
            >
              Enable All Tabs
            </button>
            <button
              type="button"
              onClick={handleDisableNonEssential}
              className="px-3 py-1.5 rounded-lg border border-[#dde1dc] text-[#5a635d] hover:bg-[#fafbfa] text-xs font-semibold cursor-pointer transition-colors"
            >
              Essential Only
            </button>
          </div>
        </div>

        {/* The Toggle Switch List */}
        <div className="divide-y divide-[#dde1dc]/60">
          {activeTabsList.map((tab, idx) => {
            const Icon = tab.icon;
            const isVisible = isTabVisibleForPublic(selectedDashboardType, tab.id, scopeKey);

            return (
              <div
                key={tab.id}
                className="py-4 flex items-center justify-between gap-4 hover:bg-[#f0f7f3]/40 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isVisible ? 'bg-[#eaf2ed] text-[#1f4d3a]' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1a1f1c]">{tab.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.2 rounded-md font-bold uppercase ${
                        isVisible
                          ? 'bg-[#eaf2ed] text-[#1f4d3a] border border-[#dde1dc]'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {isVisible ? 'Publicly Visible' : 'Hidden from Public'}
                      </span>
                    </div>
                    <p className="text-xs text-[#5a635d] leading-relaxed">{tab.description}</p>
                  </div>
                </div>

                {/* Interactive Toggle Switch */}
                <div className="shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleToggleTab(tab.id, isVisible)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1f4d3a]"></div>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 4. ADDITIONAL GLOBAL TELEMETRY & PRIVACY SAFEGUARDS ───────────────── */}
      <div className="p-6 bg-white border border-[#dde1dc] rounded-2xl shadow-xs space-y-4">
        <div className="border-b border-[#dde1dc] pb-3">
          <h2 className="text-base font-bold font-serif text-[#1a1f1c] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1f4d3a]" />
            <span>Sensitive Telemetry &amp; Data Safeguards (Global)</span>
          </h2>
          <p className="text-xs text-[#5a635d] mt-0.5">
            Fine-grained access controls for exact GPS coordinates, raw audio downloads, and report generation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa] flex items-center justify-between gap-3">
            <div>
              <strong className="text-[#1a1f1c] text-xs block">Allow Public CSV &amp; PDF Report Exports</strong>
              <p className="text-[#5a635d] text-[11px] mt-0.5">Allow unauthenticated guests to download full species CSV reports.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={visibilitySettings.allowPublicReports}
                onChange={(e) => updateVisibilitySetting('allowPublicReports', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1f4d3a]"></div>
            </label>
          </div>

          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa] flex items-center justify-between gap-3">
            <div>
              <strong className="text-[#1a1f1c] text-xs block">Show Exact GPS Coordinates on Public Maps</strong>
              <p className="text-[#5a635d] text-[11px] mt-0.5">Disable to protect sensitive endangered nesting sites.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={visibilitySettings.showExactGPSCoordinates}
                onChange={(e) => updateVisibilitySetting('showExactGPSCoordinates', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1f4d3a]"></div>
            </label>
          </div>

          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa] flex items-center justify-between gap-3">
            <div>
              <strong className="text-[#1a1f1c] text-xs block">Allow Bioacoustic Audio Playback &amp; WAV Downloads</strong>
              <p className="text-[#5a635d] text-[11px] mt-0.5">Permit public playback of recorded bird vocalizations.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={visibilitySettings.allowAudioDownloads}
                onChange={(e) => updateVisibilitySetting('allowAudioDownloads', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1f4d3a]"></div>
            </label>
          </div>

          <div className="p-4 rounded-xl border border-[#dde1dc] bg-[#fafbfa] flex items-center justify-between gap-3">
            <div>
              <strong className="text-[#1a1f1c] text-xs block">Display Raw Hardware Telemetry &amp; Node Battery</strong>
              <p className="text-[#5a635d] text-[11px] mt-0.5">Show station battery voltage and disk storage on public node cards.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={visibilitySettings.showTelemetryMetrics}
                onChange={(e) => updateVisibilitySetting('showTelemetryMetrics', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1f4d3a]"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
