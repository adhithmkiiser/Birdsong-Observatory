'use client';

import React, { useEffect, useState } from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';
import DashboardLoader from '@/components/ui/DashboardLoader';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { DashboardStats, DashboardStatsData } from '@/components/dashboard/DashboardStats';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import CommonSpeciesHourMatrix from '@/components/charts/CommonSpeciesHourMatrix';
import { useDashboardStore } from '@/lib/store/useDashboardStore';

export default function CommonDashboardPage() {
  const { currentRole, currentUser } = useRole();
  
  const { 
    selectedProjectId, 
    selectedStationId, 
    selectedRecorderId, 
    confidenceThreshold,
    setProject
  } = useDashboardStore();

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [stationsList, setStationsList] = useState<any[]>([]);
  const [recordersRegistryList, setRecordersRegistryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState<DashboardStatsData | null>(null);

  // Initial load of reference data (Projects, Sites, Recorders)
  useEffect(() => {
    async function initData() {
      try {
        const [projectsRes, sitesRes, recordersRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('sites').select('*').order('name'),
          supabase.from('recorders_registry').select('*').order('recorder_id')
        ]);

        let allProjects = (projectsRes.data || []).filter((p: any) => !p.project_type || p.project_type === 'PAM');
        let allSites = sitesRes.data || [];

        // Apply RBAC filtering
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

        const pamProjects = allProjects;
        const pamProjectIds = new Set(pamProjects.map((p: any) => p.id));
        setProjectsList(pamProjects);

        // Pre-select project from query param
        const queryProject = new URLSearchParams(window.location.search).get('project');
        if (queryProject && pamProjectIds.has(queryProject)) {
          setProject(queryProject);
        }

        // Include ONLY PAM sites
        const pamSites: any[] = allSites
          .filter((s: any) => pamProjectIds.has(s.project_id))
          .map(s => ({
            id: s.id,
            station_name: s.name,
            project_id: s.project_id,
            latitude: s.latitude,
            longitude: s.longitude
          }));

        setStationsList(pamSites);

        const pamSiteNames = Array.from(new Set(pamSites.map((s: any) => s.station_name)));
        
        // Filter actual registered recorders
        const actualRecorders = (recordersRes.data || []).filter(
            (r: any) => r.project_type === 'PAM' && pamSiteNames.some(name => name.includes(r.site_name))
        );

        // Dynamically inject a standard 'Rec_01' for all PAM sites to fallback for missing registries or BirdNET defaults
        const syntheticRecorders = pamSites.map((s: any) => ({
            id: `synth_${s.id}_Rec_01`,
            project_type: 'PAM',
            project_name: s.project_id,
            site_name: s.station_name,
            recorder_id: 'Rec_01'
        }));

        setRecordersRegistryList([...actualRecorders, ...syntheticRecorders]);

      } catch (err) {
        console.error('Error loading projects/sites:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [currentRole, currentUser, setProject]);

  // Fetch server-side aggregations whenever filters change
  useEffect(() => {
    async function fetchStats() {
      if (projectsList.length === 0) return;
      
      let p_project_names = null;
      if (selectedProjectId !== 'ALL_PROJECTS') {
         const projectSites = stationsList.filter(s => s.project_id === selectedProjectId);
         const allowedSiteNames = projectSites.map(s => s.station_name);
         p_project_names = allowedSiteNames.length > 0 ? allowedSiteNames : ['NONE'];
      }

      let p_site_name = 'ALL_SITES';
      if (selectedStationId !== 'ALL_SITES') {
         const s = stationsList.find(s => s.id === selectedStationId);
         if (s) p_site_name = s.station_name;
      }

      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_project_names,
        p_site_name: p_site_name,
        p_recorder_name: selectedRecorderId,
        p_confidence: confidenceThreshold
      });

      if (error) {
        console.error("Error fetching stats:", error);
      } else if (data) {
        setStats(data as DashboardStatsData);
      }
    }
    
    if (!loading) {
      fetchStats();
    }
  }, [selectedProjectId, selectedStationId, selectedRecorderId, confidenceThreshold, loading, projectsList]);

  if (loading) return <DashboardLoader message="Loading PAM dashboard..." />;

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Hero Banner */}
      <div className="relative overflow-hidden p-8 md:p-10 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-2xl border border-slate-800/80">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Common Platform Dashboard Format
              </span>
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Standard Research Project Dashboard
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Standard Bioacoustics Monitoring Dashboard
            </h1>
            <p className="text-emerald-400 text-sm font-bold tracking-wide">
              Modular Format for All Newly Created Projects & Deployed Stations
            </p>
            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed font-medium">
              Unified bioacoustics dashboard template providing species richness counts, 24-hour diurnal patterns, and field station telemetry.
            </p>
          </div>
        </div>
      </div>

      <DashboardFilters 
        totalDetections={stats?.total_detections || 0}
        projectsList={projectsList}
        stationsList={stationsList}
        recordersRegistryList={recordersRegistryList}
      />

      <DashboardStats stats={stats} />

      <DashboardCharts 
        p_project_names={selectedProjectId !== 'ALL_PROJECTS' ? (stationsList.filter(s => s.project_id === selectedProjectId).length > 0 ? stationsList.filter(s => s.project_id === selectedProjectId).map(s => s.station_name) : ['NONE']) : null}
        p_site_name={selectedStationId !== 'ALL_SITES' ? stationsList.find(s => s.id === selectedStationId)?.station_name || 'ALL_SITES' : 'ALL_SITES'}
        p_recorder_name={selectedRecorderId}
      />

      <CommonSpeciesHourMatrix 
        p_project_names={selectedProjectId !== 'ALL_PROJECTS' ? (stationsList.filter(s => s.project_id === selectedProjectId).length > 0 ? stationsList.filter(s => s.project_id === selectedProjectId).map(s => s.station_name) : ['NONE']) : null}
        p_site_name={selectedStationId !== 'ALL_SITES' ? stationsList.find(s => s.id === selectedStationId)?.station_name || 'ALL_SITES' : 'ALL_SITES'}
        p_recorder_name={selectedRecorderId}
      />
    </div>
  );
}
