'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Sparkles, 
  X, 
  Calendar, 
  Building, 
  MapPin, 
  Radio, 
  CheckCircle2, 
  ArrowRight,
  Layers,
  Trees,
  Cpu
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/components/layout/RoleContext';

export type ReportFormat = 'pam' | 'lantana' | 'live';

interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: ReportFormat;
  defaultProjectId?: string;
  defaultSiteId?: string;
}

export function ReportGeneratorModal({
  isOpen,
  onClose,
  defaultFormat = 'pam',
  defaultProjectId,
  defaultSiteId
}: ReportGeneratorModalProps) {
  const router = useRouter();
  const { currentRole, currentUser } = useRole();

  const [format, setFormat] = useState<ReportFormat>(defaultFormat);
  const [projectId, setProjectId] = useState<string>(defaultProjectId || 'ALL_PROJECTS');
  const [siteId, setSiteId] = useState<string>(defaultSiteId || 'ALL_SITES');
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [partnerAgency, setPartnerAgency] = useState<string>('Tamil Nadu Forest Dept & The Shola Trust');
  const [authorName, setAuthorName] = useState<string>(currentUser?.name || 'Dr. Robin Vijayan');

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  // Sync format if defaultFormat changes
  useEffect(() => {
    if (defaultFormat) {
      setFormat(defaultFormat);
    }
  }, [defaultFormat]);

  // Load projects and sites based on selected format
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoadingFilters(true);
      try {
        const [{ data: projs }, { data: sites }] = await Promise.all([
          supabase.from('projects').select('*').order('name'),
          supabase.from('sites').select('*').order('name')
        ]);

        const allProjs = projs || [];
        const allSites = sites || [];

        setProjectsList(allProjs);
        setSitesList(allSites);

        // Auto-select sensible project default based on format
        if (format === 'lantana') {
          const lantanaProj = allProjs.find(p => p.id === 'tst_lantana' || p.project_type === 'Lantana');
          if (lantanaProj && (!defaultProjectId || projectId === 'ALL_PROJECTS')) {
            setProjectId(lantanaProj.id);
          }
        } else if (format === 'pam') {
          const pamProj = allProjs.find(p => p.id === 'nilgiri' || p.project_type === 'PAM');
          if (pamProj && (!defaultProjectId || projectId === 'ALL_PROJECTS')) {
            setProjectId(pamProj.id);
          }
        } else if (format === 'live') {
          const liveProj = allProjs.find(p => p.id === 'test_custom' || p.project_type === 'Live');
          if (liveProj && (!defaultProjectId || projectId === 'ALL_PROJECTS')) {
            setProjectId(liveProj.id);
          }
        }
      } catch (err) {
        console.error('Error loading report filters:', err);
      } finally {
        setLoadingFilters(false);
      }
    }

    loadData();
  }, [isOpen, format]);

  if (!isOpen) return null;

  // Filter available sites based on project
  const availableSites = projectId === 'ALL_PROJECTS'
    ? sitesList
    : sitesList.filter(s => s.project_id === projectId);

  const handleApplyPreset = (days: number | 'season') => {
    const end = new Date();
    setEndDate(end.toISOString().slice(0, 10));

    if (days === 'season') {
      setStartDate('2026-07-01');
    } else {
      const start = new Date();
      start.setDate(end.getDate() - days);
      setStartDate(start.toISOString().slice(0, 10));
    }
  };

  const handleGenerate = () => {
    const params = new URLSearchParams({
      format,
      project: projectId,
      site: siteId,
      start: startDate,
      end: endDate,
      agency: partnerAgency,
      author: authorName
    });
    router.push(`/reports?${params.toString()}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-[#f0f7f3] via-white to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1f4d3a] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-bold text-slate-900">Create Bioacoustic Report</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                  Automated Dossier
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Synthesize species richness, accumulation curves, diurnal patterns, and habitat metrics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#1a1f1c]">
          {/* 1. Format Selection */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1f4d3a]" />
              <span>Step 1: Select Report Format</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Format 1 */}
              <button
                type="button"
                onClick={() => setFormat('pam')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === 'pam'
                    ? 'border-[#1f4d3a] bg-[#f0f7f3] ring-2 ring-[#1f4d3a]/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-[#1f4d3a] uppercase">Format 1</span>
                    {format === 'pam' && <CheckCircle2 className="w-4 h-4 text-[#1f4d3a]" />}
                  </div>
                  <h4 className="font-serif font-bold text-slate-900 text-xs">Passive Acoustic Monitoring</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Standard multi-site PAM survey: species richness, accumulation curves, diurnal profile, and elevation gradient.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-[#1f4d3a] font-semibold">
                  10 Full Sections • Chao Richness
                </div>
              </button>

              {/* Format 2 */}
              <button
                type="button"
                onClick={() => setFormat('lantana')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === 'lantana'
                    ? 'border-[#1f4d3a] bg-[#f0f7f3] ring-2 ring-[#1f4d3a]/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-amber-700 uppercase">Format 2</span>
                    {format === 'lantana' && <CheckCircle2 className="w-4 h-4 text-[#1f4d3a]" />}
                  </div>
                  <h4 className="font-serif font-bold text-slate-900 text-xs">Lantana Restoration</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Restoration impact monitoring comparing Invaded (LI), Restored (LC), and Reference (CS) treatments.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-amber-800 font-semibold">
                  BACI / Space-for-time • Guilds
                </div>
              </button>

              {/* Format 3 */}
              <button
                type="button"
                onClick={() => setFormat('live')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === 'live'
                    ? 'border-[#1f4d3a] bg-[#f0f7f3] ring-2 ring-[#1f4d3a]/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">Format 3</span>
                    {format === 'live' && <CheckCircle2 className="w-4 h-4 text-[#1f4d3a]" />}
                  </div>
                  <h4 className="font-serif font-bold text-slate-900 text-xs">Live Streaming Array</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Raspberry Pi edge telemetry, solar battery uptime, realtime watchdog alerts, and audio validation.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-emerald-800 font-semibold">
                  Pi Telemetry • Realtime Watchdog
                </div>
              </button>
            </div>
          </div>

          {/* 2. Scope Controls */}
          <div className="space-y-3">
            <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1f4d3a]" />
              <span>Step 2: Project &amp; Survey Site Scope</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Project Scope</label>
                <select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setSiteId('ALL_SITES');
                  }}
                  className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:border-[#1f4d3a]"
                >
                  <option value="ALL_PROJECTS">All Projects ({projectsList.length})</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Site / Station Scope</label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:border-[#1f4d3a]"
                >
                  <option value="ALL_SITES">All Survey Sites ({availableSites.length})</option>
                  {availableSites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name || s.station_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Time Range Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1f4d3a]" />
                <span>Step 3: Survey Time Range</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(7)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-[10px] cursor-pointer"
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(30)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-[10px] cursor-pointer"
                >
                  30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('season')}
                  className="px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-mono text-[10px] font-semibold cursor-pointer"
                >
                  Full Season
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none focus:border-[#1f4d3a]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none focus:border-[#1f4d3a]"
                />
              </div>
            </div>
          </div>

          {/* 4. Metadata Customization */}
          <div className="space-y-3">
            <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#1f4d3a]" />
              <span>Step 4: Report Attribution &amp; Partners</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Lead Investigator / Author</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="e.g. Dr. Robin Vijayan"
                  className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1f4d3a]"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Partner Agencies / Forest Dept</label>
                <input
                  type="text"
                  value={partnerAgency}
                  onChange={(e) => setPartnerAgency(e.target.value)}
                  placeholder="e.g. Tamil Nadu Forest Dept & The Shola Trust"
                  className="w-full bg-[#fafbfa] border border-[#dde1dc] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#1f4d3a]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            className="px-5 py-2.5 rounded-xl bg-[#1f4d3a] hover:bg-[#173b2c] text-white font-semibold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Generate &amp; View Report</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
