'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/components/layout/RoleContext';

// ─── Client-only imports to avoid SSR issues ────────────────────────────────
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
const LantanaMap = dynamic(() => import('@/components/map/LantanaMap'), { ssr: false });
import AnalysisCharts from './AnalysisCharts';
import DashboardLoader from '@/components/ui/DashboardLoader';

// ─── Exact Audio Player replication from BirdSearch.tsx ──────────────────────
const AudioPlayer: React.FC<{ src: string; speciesName: string }> = ({ src, speciesName }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) audioRef.current.load();
  }, [src]);

  const resolvedAudioSrc = src && (src.startsWith('http') || src.startsWith('/')) ? src : '';

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(err => console.error('Audio error:', err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const sliderBg = `linear-gradient(to right, #4f46e5 ${pct}%, #e2e8f0 ${pct}%)`;

  return (
    <div className={`audio-player-card${!src ? ' disabled' : ''}`}>
      <audio
        ref={audioRef}
        src={resolvedAudioSrc}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
      />

      <div className="player-controls-row">
        <button onClick={togglePlay} disabled={!src} className={`play-btn${isPlaying ? ' playing' : ''}`}>
          {isPlaying ? (
            <svg fill="currentColor" viewBox="0 0 24 24" width="16" height="16">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg fill="currentColor" viewBox="0 0 24 24" width="16" height="16" style={{ marginLeft: '2px' }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="player-details">
          <span className="player-subtitle">{src ? speciesName : 'From Xenocanto'}</span>
          {isPlaying && (
            <div className="soundwave-anim">
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
            </div>
          )}
        </div>
      </div>

      <div className="timeline-row">
        <span className="time-lbl">{fmt(currentTime)}</span>
        <input
          type="range"
          className="player-slider"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          disabled={!src}
          style={{ background: sliderBg }}
        />
        <span className="time-lbl">{fmt(duration)}</span>
      </div>
    </div>
  );
};


// ─── Main Lantana Dashboard Page ──────────────────────────────────────────────
export default function LantanaDashboardPage() {
  const { currentRole, currentUser } = useRole();
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL_LANTANA');

  // Raw Supabase data
  const [rawRecorders, setRawRecorders] = useState<any[]>([]);
  const [rawDetections, setRawDetections] = useState<any[]>([]);
  const [rawSpeciesList, setRawSpeciesList] = useState<string[]>([]);
  const [rawSpeciesMetadata, setRawSpeciesMetadata] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number | undefined>(undefined);

  // Filter state – exact same as App.tsx
  const [selectedSiteGroup, setSelectedSiteGroup] = useState('All');
  const [selectedRecorder, setSelectedRecorder] = useState('All');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.70);

  // BirdSearch state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Heatmap controls – exact same as HeatmapPanel.tsx
  const [matrixSearch, setMatrixSearch] = useState('');
  const [topN, setTopN] = useState('25');
  const [sortBy, setSortBy] = useState('detections');
  const [useLogScale, setUseLogScale] = useState(true);

  // Indicator panel state – exact same as IndicatorPanel.tsx
  const [indicatorClass, setIndicatorClass] = useState<'recovery' | 'lantana' | 'all'>('recovery');
  const [indicatorLogScale, setIndicatorLogScale] = useState(true);

  // Load Lantana projects and metadata on mount
  useEffect(() => {
    async function loadMeta() {
      try {
        const [projs, species] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          supabase.from('lantana_species_ecology').select('*').order('common_name')
        ]);

        let lantanaProjects = (projs.data || []).filter((p: any) => p.project_type === 'Lantana');
        
        // Apply RBAC filtering
        if (currentRole === 'Project Manager') {
          const assigned = currentUser?.assignedProjects || [];
          lantanaProjects = lantanaProjects.filter((p: any) => assigned.includes(p.id));
        } else if (currentRole === 'Site Manager') {
          // Site Managers might not have assignedProjects directly if derived from assignedSites, 
          // but if they do, we'll filter on assignedProjects just like PAM.
          const assigned = currentUser?.assignedProjects || [];
          if (assigned.length > 0) {
              lantanaProjects = lantanaProjects.filter((p: any) => assigned.includes(p.id));
          } else {
              // fallback to assignedSites
              const siteIds = currentUser?.assignedSites || [];
              const { data: sData } = await supabase.from('lantana_sites').select('project_id').in('id', siteIds);
              const allowedProjIds = new Set((sData || []).map((s: any) => s.project_id));
              lantanaProjects = lantanaProjects.filter((p: any) => allowedProjIds.has(p.id));
          }
        }
        
        setProjectsList(lantanaProjects);

        // Pre-select project from query param, otherwise first project
        const queryProject = new URLSearchParams(window.location.search).get('project');
        const queryMatch = lantanaProjects.find((p: any) => p.id === queryProject);
        if (queryMatch) setSelectedProjectId(queryMatch.id);
        else if (lantanaProjects.length > 0) setSelectedProjectId(lantanaProjects[0].id);

        const speciesList: string[] = [];
        const speciesMetadata: Record<string, any> = {};
        let firstEndemic: string | null = null;
        
        (species.data || []).forEach((s: any) => {
          const name = s.common_name;
          if (!name) return;
          speciesList.push(name);
          speciesMetadata[name] = {
            scientific: s.scientific_name,
            endemic: s.endemic_status,
            preferred_habitat: s.habitat,
            guild: s.guild,
            vocal_activity: s.vocal_activity,
            iucn: s.iucn_status,
            foraging_stratum: s.foraging_stratum,
            indicator_group: s.indicator_group || 'Nil',
            image: s.image_link || s.image_url,
            audio: s.audio_link || s.audio_url
          };
          
          if (!firstEndemic && s.endemic_status && String(s.endemic_status).trim().toLowerCase() === 'yes') {
            firstEndemic = name;
          }
        });
        setRawSpeciesList(speciesList);
        setRawSpeciesMetadata(speciesMetadata);
        setSelectedSpecies(prev => prev ? prev : firstEndemic);
      } catch (e) { console.error(e); }
    }
    loadMeta();
  }, [currentRole, currentUser]);

  // Load Lantana sites/detections when selected project changes
  useEffect(() => {
    async function loadProject() {
      setLoading(true);
      setLoadingProgress(0);
      try {
        let siteQuery = supabase.from('lantana_sites').select('*').order('site_name');
        
        if (selectedProjectId !== 'ALL_LANTANA') {
          siteQuery = siteQuery.eq('project_id', selectedProjectId);
        } else {
           if (currentRole === 'Project Manager' || currentRole === 'Site Manager') {
             const allowedProjIds = projectsList.map(p => p.id);
             if (allowedProjIds.length > 0) {
               siteQuery = siteQuery.in('project_id', allowedProjIds);
             } else {
               siteQuery = siteQuery.eq('id', 'NONE');
             }
           }
        }
        
        // Further filter sites for Site Managers
        if (currentRole === 'Site Manager') {
            const allowedSites = currentUser?.assignedSites || [];
            if (allowedSites.length > 0) {
                siteQuery = siteQuery.in('id', allowedSites);
            }
        }

        const buildDetQuery = () => {
          let q = supabase.from('lantana_detections').select('*').order('id');
          if (selectedProjectId !== 'ALL_LANTANA') {
            q = q.eq('project_id', selectedProjectId);
          } else {
            if (currentRole === 'Project Manager' || currentRole === 'Site Manager') {
              const allowedProjIds = projectsList.map(p => p.id);
              if (allowedProjIds.length > 0) q = q.in('project_id', allowedProjIds);
              else q = q.eq('id', 'NONE');
            }
          }
          if (currentRole === 'Site Manager') {
            const allowedSites = currentUser?.assignedSites || [];
            if (allowedSites.length > 0) q = q.in('site_name', allowedSites);
          }
          return q;
        };

        const { data: sbSites } = await siteQuery;
        const sbDets = await (async () => {
          // Get the total count first
          const { count, error } = await supabase.from('lantana_detections')
            .select('*', { count: 'exact', head: true })
            .eq(selectedProjectId !== 'ALL_LANTANA' ? 'project_id' : 'id', selectedProjectId !== 'ALL_LANTANA' ? selectedProjectId : 'NONE'); // simplification for count
            
          // Better logic: reuse detQuery to get count
          const countQuery = supabase.from('lantana_detections').select('*', { count: 'exact', head: true });
          if (selectedProjectId !== 'ALL_LANTANA') countQuery.eq('project_id', selectedProjectId);
          else if (currentRole === 'Project Manager' || currentRole === 'Site Manager') {
            const allowedProjIds = projectsList.map(p => p.id);
            if (allowedProjIds.length > 0) countQuery.in('project_id', allowedProjIds);
            else countQuery.eq('id', 'NONE');
          }
          if (currentRole === 'Site Manager') {
            const allowedSites = currentUser?.assignedSites || [];
            if (allowedSites.length > 0) countQuery.in('site_name', allowedSites);
          }
          
          const { count: totalCount } = await countQuery;
          
          if (!totalCount || totalCount === 0) return [];

          const pageSize = 1000;
          const numPages = Math.ceil(totalCount / pageSize);
          
          // Fire all requests in parallel
          const promises = [];
          for (let i = 0; i < numPages; i++) {
            const offset = i * pageSize;
            promises.push(
               buildDetQuery().range(offset, offset + pageSize - 1).then(res => res.data || [])
            );
          }
          
          let completed = 0; const results = await Promise.all(promises.map(async p => { const res = await p; completed++; setLoadingProgress((completed / numPages) * 100); return res; }));
          return results.flat();
        })();

        const recorders = (sbSites || []).map((s: any) => {
          const combined = `${s.habitat_type || ''} ${s.site_name || ''} ${s.recorder_id || ''}`.toLowerCase();
          const isLC = /(^|[\s_-])(lc|lantana-cleared|cleared)([\s_-]|$)/i.test(combined);
          const isCS = /(^|[\s_-])(cs|control-site|control)([\s_-]|$)/i.test(combined);
          const isLI = /(^|[\s_-])(li|lantana-infested|infested)([\s_-]|$)/i.test(combined);
          return {
            site_group: s.site_name || s.id,
            recorder_id: s.recorder_id || s.id,
            habitat: isLC ? 'LC' : isCS ? 'CS' : isLI ? 'LI' : 'LI',
            latitude: s.lat != null ? Number(s.lat) : null,
            longitude: s.long != null ? Number(s.long) : null,
            size_gb: s.total_size_bytes ? Number(s.total_size_bytes) / 1e9 : 0,
            expected_files: s.expected_files || 0,
            actual_files: s.number_of_files || 0
          };
        });

        setRawRecorders(recorders);
        setRawDetections(sbDets || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    loadProject();
  }, [selectedProjectId, projectsList, currentRole, currentUser]);

  // Click outside dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const recorderKeyToIdx = useMemo(() => {
    const m = new Map<string, number>();
    rawRecorders.forEach((r: any, i: number) => m.set(`${r.site_group}/${r.recorder_id}`.toLowerCase(), i));
    return m;
  }, [rawRecorders]);

  const speciesIdxMap = useMemo(() => {
    const m = new Map<string, number>();
    rawSpeciesList.forEach((sp: string, i: number) => m.set(sp.toLowerCase(), i));
    return m;
  }, [rawSpeciesList]);

  const dataRaw = useMemo(() => {
    const spIdxMap = speciesIdxMap;
    const detections = (rawDetections || []).map((d: any) => {
      const recKey = `${d.site_name || d.site_group || d.recorder_id}/${d.recorder_id}`;
      const recIdx = recorderKeyToIdx.get(recKey.toLowerCase());
      const spIdx = spIdxMap.get((d.common_name || '').toLowerCase());
      if (recIdx === undefined || spIdx === undefined) return null;
      const t = d.time ? new Date(`1970-01-01T${d.time}`) : null;
      const hour = t ? t.getHours() : (d.start_time ? Math.floor(Number(d.start_time) / 3600) % 24 : 0);
      const conf = Math.round(((d.confidence || d.threshold || 0) * 100));
      return [recIdx, spIdx, 0, hour, Math.max(0, Math.min(100, conf))];
    }).filter(Boolean);

    return {
      recorders: rawRecorders,
      species_list: rawSpeciesList,
      species_metadata: rawSpeciesMetadata,
      detections
    };
  }, [rawRecorders, rawDetections, rawSpeciesList, rawSpeciesMetadata, recorderKeyToIdx, speciesIdxMap]);

  const configRaw = useMemo(() => ({
    indicator_species: {
      recovery: rawSpeciesList.filter(sp => rawSpeciesMetadata[sp]?.indicator_group?.toLowerCase().includes('recovery')),
      lantana: rawSpeciesList.filter(sp => rawSpeciesMetadata[sp]?.indicator_group?.toLowerCase().includes('lantana') || rawSpeciesMetadata[sp]?.indicator_group?.toLowerCase().includes('disturbance'))
    },
    confidence_threshold_default: 0.70,
    display_labels: { LC: 'Lantana-Cleared (LC)', LI: 'Lantana-Infested (LI)' }
  }), [rawSpeciesList, rawSpeciesMetadata]);

  const recorders: any[] = useMemo(() => dataRaw?.recorders || [], [dataRaw]);
  const speciesList: string[] = useMemo(() => dataRaw?.species_list || [], [dataRaw]);
  const speciesMetadata: any = useMemo(() => dataRaw?.species_metadata || {}, [dataRaw]);
  const detectionsRaw: any[] = useMemo(() => dataRaw?.detections || [], [dataRaw]);

  const siteGroups: string[] = useMemo(() => {
    const g = new Set<string>();
    recorders.forEach((r: any) => g.add(r.site_group));
    return Array.from(g).sort().filter((g) => g && g !== 'ad');
  }, [recorders]);

  const recordersList: string[] = useMemo(() => {
    let list = recorders;
    if (selectedSiteGroup !== 'All') list = list.filter((r: any) => r.site_group === selectedSiteGroup);
    return Array.from(new Set(list.map((r: any) => String(r.recorder_id)))).sort().filter((r) => r && r !== 'ad');
  }, [recorders, selectedSiteGroup]);

  useEffect(() => {
    if (selectedRecorder !== 'All' && !recordersList.includes(selectedRecorder)) setSelectedRecorder('All');
  }, [selectedSiteGroup, recordersList, selectedRecorder]);

  const filteredRecorders: any[] = useMemo(() => {
    let list = recorders;
    if (selectedSiteGroup !== 'All') list = list.filter((r: any) => r.site_group === selectedSiteGroup);
    if (selectedRecorder !== 'All') list = list.filter((r: any) => r.recorder_id === selectedRecorder);
    return list.filter((r: any) => r.site_group !== 'ad' && r.recorder_id !== 'ad');
  }, [recorders, selectedSiteGroup, selectedRecorder]);

  const landscapeRecorders: any[] = useMemo(() => {
    let list = recorders;
    if (selectedSiteGroup !== 'All') list = list.filter((r: any) => r.site_group === selectedSiteGroup);
    return list.filter((r: any) => r.site_group !== 'ad' && r.recorder_id !== 'ad');
  }, [recorders, selectedSiteGroup]);

  const validIndices = useMemo(() => {
    const s = new Set<number>();
    filteredRecorders.forEach((r: any) => {
      const i = recorderKeyToIdx.get(`${r.site_group}/${r.recorder_id}`.toLowerCase());
      if (i !== undefined) s.add(i);
    });
    return s;
  }, [filteredRecorders, recorderKeyToIdx]);

  const landscapeIndices = useMemo(() => {
    const s = new Set<number>();
    landscapeRecorders.forEach((r: any) => {
      const i = recorderKeyToIdx.get(`${r.site_group}/${r.recorder_id}`.toLowerCase());
      if (i !== undefined) s.add(i);
    });
    return s;
  }, [landscapeRecorders, recorderKeyToIdx]);

  const filteredDetections: any[] = useMemo(() => {
    const thr = Math.round(confidenceThreshold * 100);
    return detectionsRaw.filter((d: any) => d[4] >= thr && validIndices.has(d[0]));
  }, [detectionsRaw, confidenceThreshold, validIndices]);

  // Build aggregated stats
  const stats = useMemo(() => {
    const detectedSp = new Set<number>();
    const activeRecs = new Set<number>();
    const richnessMap: Record<string, Set<number>> = {};
    const detectionsMap: Record<string, number> = {};
    const spSiteMatrix: Record<string, Record<string, number>> = {};
    const hourlyMap: Record<string, Record<number, number>> = {};

    filteredDetections.forEach((d: any) => {
      const [recIdx, spIdx, , hour] = d;
      detectedSp.add(spIdx);
      activeRecs.add(recIdx);
      const rec = recorders[recIdx];
      if (!rec) return;
      const key = `${rec.site_group}/${rec.recorder_id}`;
      const spName = speciesList[spIdx];
      if (!richnessMap[key]) richnessMap[key] = new Set<number>();
      richnessMap[key].add(spIdx);
      detectionsMap[key] = (detectionsMap[key] || 0) + 1;
      if (spName) {
        if (!spSiteMatrix[spName]) spSiteMatrix[spName] = {};
        spSiteMatrix[spName][key] = (spSiteMatrix[spName][key] || 0) + 1;
        if (!hourlyMap[spName]) hourlyMap[spName] = {};
        hourlyMap[spName][hour] = (hourlyMap[spName][hour] || 0) + 1;
      }
    });

    const siteRichness: Record<string, number> = {};
    Object.keys(richnessMap).forEach(k => siteRichness[k] = richnessMap[k].size);

    const filesProcessed = filteredRecorders.reduce((s: number, r: any) => s + (r.actual_files || 0), 0);
    const filesExpected = filteredRecorders.reduce((s: number, r: any) => s + (r.expected_files || 0), 0);

    return {
      uniqueSpecies: detectedSp.size,
      totalDetections: filteredDetections.length,
      activeRecorders: activeRecs.size,
      filesProcessed,
      filesExpected,
      siteRichness,
      siteDetections: detectionsMap,
      spSiteMatrix,
      hourlyMap,
    };
  }, [filteredDetections, recorders, filteredRecorders, speciesList]);

  const mapSites = useMemo(() => {
    return filteredRecorders
      .filter((r: any) => r.latitude != null && r.longitude != null && Number(r.latitude) !== 0 && Number(r.longitude) !== 0 && r.recorder_id !== 'ad' && r.site_group !== 'ad')
      .map((r: any) => {
        const key = `${r.site_group}/${r.recorder_id}`;
        return {
          id: key,
          name: `${r.site_group} — ${r.recorder_id}`,
          site_group: r.site_group,
          recorder_id: r.recorder_id,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          detectionsCount: stats.siteDetections[key] || 0,
          speciesCount: stats.siteRichness[key] || 0
        };
      });
  }, [filteredRecorders, stats.siteDetections, stats.siteRichness]);

  const recoveryIndicators: string[] = configRaw?.indicator_species?.recovery || [];
  const lantanaIndicators: string[] = configRaw?.indicator_species?.lantana || [];

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return speciesList.filter(sp => {
      const m = speciesMetadata[sp];
      return sp.toLowerCase().includes(q) || (m?.scientific || '').toLowerCase().includes(q);
    }).slice(0, 8);
  }, [searchQuery, speciesList, speciesMetadata]);

  // BirdSearch profile data (exact same as BirdSearch.tsx profileData)
  const profileData = useMemo(() => {
    if (!selectedSpecies) return null;
    const meta = speciesMetadata[selectedSpecies] || {};
    const detections = stats.spSiteMatrix[selectedSpecies] || {};

    let total = 0, lcDet = 0, liDet = 0, lcCount = 0, liCount = 0;
    filteredRecorders.forEach((rec: any) => {
      const key = `${rec.site_group}/${rec.recorder_id}`;
      const cnt = detections[key] || 0;
      if (cnt > 0) {
        total += cnt;
        if (rec.habitat === 'LC') { lcDet += cnt; lcCount++; }
        else { liDet += cnt; liCount++; }
      }
    });

    const igRaw = meta.indicator_group;
    const indicatorGroup = (!igRaw || igRaw === 'nan' || igRaw === 'None') ? 'Nil' : igRaw;

    return {
      name: selectedSpecies,
      scientific: meta.scientific || 'N/A',
      endemic: meta.endemic || 'No',
      preferred_habitat: meta.preferred_habitat || 'Unknown',
      guild: meta.guild || 'Unknown',
      vocal_activity: meta.vocal_activity || 'Unknown',
      iucn: meta.iucn || 'LC',
      foraging_stratum: meta.foraging_stratum || 'Unknown',
      indicator_group: indicatorGroup,
      image: meta.image || '',
      audio: meta.audio || '',
      totalDetections: total, lcDetections: lcDet, liDetections: liDet,
      lcRecordersCount: lcCount, liRecordersCount: liCount,
    };
  }, [selectedSpecies, speciesMetadata, stats.spSiteMatrix, filteredRecorders]);

  // Diurnal chart option (ECharts – exact same as BirdSearch.tsx chartOption)
  const diurnalOption = useMemo(() => {
    if (!selectedSpecies) return {};
    const hourlyData = stats.hourlyMap[selectedSpecies] || {};
    const dataX = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const dataY = Array.from({ length: 24 }, (_, i) => hourlyData[i] || 0);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => `<div style="font-family:Inter,sans-serif;font-size:11px;padding:2px 4px">Hour: <strong>${params[0].name}</strong><br/>Detections: <strong>${params[0].value} calls</strong></div>`
      },
      grid: { top: '15%', left: '8%', right: '4%', bottom: '22%' },
      xAxis: {
        type: 'category', data: dataX,
        axisLabel: { interval: 2, fontSize: 8, color: '#64748b' },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      yAxis: {
        type: 'value', name: 'Calls',
        nameTextStyle: { fontSize: 8, color: '#64748b' },
        axisLabel: { fontSize: 8, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } }
      },
      series: [{ data: dataY, type: 'bar', itemStyle: { color: '#4f46e5' }, barWidth: '70%' }]
    };
  }, [selectedSpecies, stats.hourlyMap]);

  // Heatmap matrix species list (exact same as HeatmapPanel.tsx processedSpecies)
  const matrixSpecies = useMemo(() => {
    // Landscape recorders for Y axis (not fully filtered – same as original)
    const recs = landscapeRecorders;

    const totals = speciesList.map(sp => {
      let t = 0;
      recs.forEach((r: any) => { t += stats.spSiteMatrix[sp]?.[`${r.site_group}/${r.recorder_id}`] || 0; });
      return { name: sp, total: t };
    });

    let filtered = totals.filter(item => item.name.toLowerCase().includes(matrixSearch.toLowerCase()));
    if (sortBy === 'detections') filtered.sort((a, b) => b.total - a.total);
    else filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (topN !== 'All') filtered = filtered.slice(0, parseInt(topN, 10));

    return filtered;
  }, [speciesList, landscapeRecorders, stats.spSiteMatrix, matrixSearch, sortBy, topN]);

  const matrixRecs = useMemo(() => {
    return landscapeRecorders.sort((a: any, b: any) =>
      a.site_group.localeCompare(b.site_group) || a.recorder_id.localeCompare(b.recorder_id)
    );
  }, [landscapeRecorders]);

  const xCategories = useMemo(() => matrixRecs.map((r: any) => `${r.site_group}\n${r.recorder_id}`), [matrixRecs]);
  const yCategories = useMemo(() => matrixSpecies.map(s => s.name).reverse(), [matrixSpecies]);

  // ECharts Heatmap option (exact same as HeatmapPanel.tsx chartOption)
  const heatmapOption = useMemo(() => {
    const data: [number, number, number, number][] = [];
    let maxVal = 1;

    yCategories.forEach((sp, yIdx) => {
      matrixRecs.forEach((rec: any, xIdx: number) => {
        const recKey = `${rec.site_group}/${rec.recorder_id}`;
        const val = stats.spSiteMatrix[sp]?.[recKey] || 0;
        const colorVal = useLogScale ? Math.log1p(val) : val;
        data.push([xIdx, yIdx, colorVal, val]);
        if (val > maxVal) maxVal = val;
      });
    });

    const maxColorVal = useLogScale ? Math.log1p(maxVal) : Math.max(10, Math.ceil(maxVal * 0.4));

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const xIdx = params.value[0];
          const yIdx = params.value[1];
          const val = params.value[3];
          const rec = matrixRecs[xIdx];
          const spName = yCategories[yIdx];
          return `<div style="font-family:Inter,sans-serif;padding:4px 8px"><div style="font-weight:700;font-size:13px">${spName}</div><div style="font-size:12px;color:#666;margin-top:4px">Site: <strong>${rec?.site_group} — ${rec?.recorder_id}</strong> (${rec?.habitat})</div><div style="font-size:12px;color:#666;margin-top:2px">Detections: <strong style="color:#4f46e5">${val} calls</strong></div></div>`;
        }
      },
      grid: { top: 30, left: '2%', right: 30, bottom: 90, containLabel: true },
      xAxis: {
        type: 'category', data: xCategories,
        axisLabel: { interval: 0, rotate: 45, fontSize: 9, color: '#475569' },
        axisTick: { alignWithLabel: true },
        splitArea: { show: true }
      },
      yAxis: {
        type: 'category', data: yCategories,
        axisLabel: { fontSize: 9, color: '#475569', verticalAlign: 'middle' },
        axisTick: { alignWithLabel: true },
        splitArea: { show: true }
      },
      visualMap: {
        min: 0, max: maxColorVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 5,
        inRange: { color: ['#f8fafc', '#ccfbf1', '#2dd4bf', '#0d9488', '#0f766e', '#115e59', '#134e4a'] },
        textStyle: { color: '#475569', fontSize: 10 },
        formatter: (value: number) => useLogScale ? value.toFixed(1) : Math.round(value).toString(),
        text: [useLogScale ? 'log(Detections + 1)' : 'Detections', '']
      },
      series: [{
        name: 'Detections', type: 'heatmap', data,
        label: {
          show: selectedSiteGroup !== 'All' && yCategories.length <= 30,
          fontSize: 8,
          color: (params: any) => (params.value[3] || 0) <= 2 ? '#115e59' : '#ffffff',
          formatter: (params: any) => params.value[3] || ''
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    };
  }, [matrixRecs, xCategories, yCategories, stats.spSiteMatrix, selectedSiteGroup, useLogScale]);

  const heatmapHeight = useMemo(() => `${Math.max(300, yCategories.length * 20 + 100)}px`, [yCategories]);

  // Indicator heatmap (exact same as IndicatorPanel.tsx)
  const activeIndicators = useMemo(() => {
    if (indicatorClass === 'recovery') return recoveryIndicators;
    if (indicatorClass === 'lantana') return lantanaIndicators;
    return [...recoveryIndicators, ...lantanaIndicators];
  }, [indicatorClass, recoveryIndicators, lantanaIndicators]);

  const indicatorRecs = useMemo(() => {
    return landscapeRecorders.sort((a: any, b: any) =>
      a.site_group.localeCompare(b.site_group) || a.recorder_id.localeCompare(b.recorder_id)
    );
  }, [landscapeRecorders]);

  const indicatorSpecies = useMemo(() => {
    return activeIndicators.map(sp => {
      let total = 0;
      indicatorRecs.forEach((r: any) => { total += stats.spSiteMatrix[sp]?.[`${r.site_group}/${r.recorder_id}`] || 0; });
      return { name: sp, total };
    }).sort((a, b) => b.total - a.total);
  }, [activeIndicators, indicatorRecs, stats.spSiteMatrix]);

  const indicatorTotals = useMemo(() => {
    let lcTotal = 0, liTotal = 0;
    indicatorSpecies.forEach(sp => {
      indicatorRecs.forEach((r: any) => {
        const val = stats.spSiteMatrix[sp.name]?.[`${r.site_group}/${r.recorder_id}`] || 0;
        const token = (r.recorder_id || '').toUpperCase().split(/[-_/]/)[0];
        const habitat = r.habitat || token;
        if (habitat === 'LC') lcTotal += val;
        else if (habitat === 'LI') liTotal += val;
      });
    });
    return { lcTotal, liTotal };
  }, [indicatorSpecies, indicatorRecs, stats.spSiteMatrix]);

  const indXCats = useMemo(() => indicatorRecs.map((r: any) => `${r.site_group}\n${r.recorder_id}`), [indicatorRecs]);
  const indYCats = useMemo(() => indicatorSpecies.map(s => s.name).reverse(), [indicatorSpecies]);

  const indicatorOption = useMemo(() => {
    const data: [number, number, number, number][] = [];
    let maxVal = 1;

    indYCats.forEach((sp, yIdx) => {
      indicatorRecs.forEach((rec: any, xIdx: number) => {
        const recKey = `${rec.site_group}/${rec.recorder_id}`;
        const val = stats.spSiteMatrix[sp]?.[recKey] || 0;
        const colorVal = indicatorLogScale ? Math.log1p(val) : val;
        data.push([xIdx, yIdx, colorVal, val]);
        if (val > maxVal) maxVal = val;
      });
    });

    const maxColorVal = indicatorLogScale ? Math.log1p(maxVal) : Math.max(10, Math.ceil(maxVal * 0.4));

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const val = params.value[3];
          const rec = indicatorRecs[params.value[0]];
          const sp = indYCats[params.value[1]];
          return `<div style="font-family:Inter,sans-serif;padding:4px 8px"><div style="font-weight:700;font-size:13px">${sp}</div><div style="font-size:12px;color:#666;margin-top:4px">Site: <strong>${rec?.site_group} — ${rec?.recorder_id}</strong></div><div style="font-size:12px;color:#666;margin-top:2px">Detections: <strong style="color:#4f46e5">${val} calls</strong></div></div>`;
        }
      },
      grid: { top: 30, left: '2%', right: 30, bottom: 90, containLabel: true },
      xAxis: {
        type: 'category', data: indXCats,
        axisLabel: { interval: 0, rotate: 45, fontSize: 9, color: '#475569' },
        axisTick: { alignWithLabel: true },
        splitArea: { show: true }
      },
      yAxis: {
        type: 'category', data: indYCats,
        axisLabel: { fontSize: 9, color: '#475569', verticalAlign: 'middle' },
        axisTick: { alignWithLabel: true },
        splitArea: { show: true }
      },
      visualMap: {
        min: 0, max: maxColorVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 5,
        inRange: { color: ['#f8fafc', '#ccfbf1', '#2dd4bf', '#0d9488', '#0f766e', '#115e59', '#134e4a'] },
        textStyle: { color: '#475569', fontSize: 10 },
        formatter: (value: number) => indicatorLogScale ? value.toFixed(1) : Math.round(value).toString(),
        text: [indicatorLogScale ? 'log(Detections + 1)' : 'Detections', '']
      },
      series: [{
        name: 'Detections', type: 'heatmap', data,
        label: {
          show: indYCats.length <= 30, fontSize: 8,
          color: (params: any) => (params.value[3] || 0) <= 2 ? '#115e59' : '#ffffff',
          formatter: (params: any) => params.value[3] || ''
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    };
  }, [indicatorRecs, indXCats, indYCats, stats.spSiteMatrix, indicatorLogScale]);

  const indicatorChartHeight = useMemo(() => `${Math.max(300, indYCats.length * 20 + 100)}px`, [indYCats]);

  // CSV Exporters
  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadSummaryCSV = () => {
    const hdr = ['Site Group', 'Recorder ID', 'Habitat', 'Files Processed', 'Species Richness', 'Total Detections'];
    const rows = filteredRecorders.map((r: any) => {
      const k = `${r.site_group}/${r.recorder_id}`;
      return [r.site_group, r.recorder_id, r.habitat === 'LC' ? 'Lantana-Cleared' : 'Lantana-Infested', r.actual_files || 0, stats.siteRichness[k] || 0, stats.siteDetections[k] || 0];
    });
    triggerDownload([hdr.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n'), `lantana_summary_${selectedSiteGroup}.csv`);
  };

  const downloadMatrixCSV = () => {
    const hdr = ['Species', 'Scientific Name', ...matrixRecs.map((r: any) => `${r.site_group}_${r.recorder_id}`)];
    const rows = matrixSpecies.map(sp => {
      const meta = speciesMetadata[sp.name];
      const counts = matrixRecs.map((r: any) => stats.spSiteMatrix[sp.name]?.[`${r.site_group}/${r.recorder_id}`] || 0);
      return [sp.name, meta?.scientific || '', ...counts];
    });
    triggerDownload([hdr.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n'), `lantana_matrix_${selectedSiteGroup}.csv`);
  };

  if (loading) return <DashboardLoader message="Loading Lantana bioacoustics..." progress={loadingProgress} />;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ─── HERO SECTION (exact same as Hero.tsx) ─────────────────────────── */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-grid">
            <div className="hero-text">
              <h1 className="hero-title">Bioacoustics for restoration monitoring.</h1>
              <p className="hero-subtitle">
                An interactive dashboard exploring how bird communities respond to lantana clearance across monitored sites using passive acoustic monitoring and BirdNET-based detections.
              </p>
              <p className="hero-description">
                This project uses sound to assess ecological change in restored and lantana-infested habitats. By combining passive acoustic recorder deployments, automated species detections, and site-level comparisons, the dashboard helps reveal patterns in species richness, indicator species, and bird activity across the landscape. Passive Acoustic Monitoring (PAM) captures continuous soundscapes to track ecological recovery without disturbing wildlife.
              </p>
              <p className="hero-description">
                By analyzing thousands of hours of audio recordings across diverse stations, this platform provides forest departments, conservationists, NGOs, and CSR partners with robust, evidence-based insights into ecosystem health to guide future restoration efforts.
              </p>
            </div>
            <div className="hero-visual">
              <div className="featured-image-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/lantana/hero_bird.jpg" alt="Forest Bird" className="featured-img" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── FILTER BAR (exact same as FilterBar.tsx) ──────────────────────── */}
      <div className="filter-bar">
        <div className="filter-grid">
          <div className="filter-item">
            <label className="filter-label">Lantana Project</label>
            <select className="select-input" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
              <option value="ALL_LANTANA">All Lantana Projects</option>
              {projectsList.map((p: any) => <option key={p.id} value={p.id}>{p.name || p.title}</option>)}
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">Landscape / Site Group</label>
            <select className="select-input" value={selectedSiteGroup} onChange={e => setSelectedSiteGroup(e.target.value)}>
              <option value="All">All Landscapes</option>
              {siteGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">Recorder Site</label>
            <select className="select-input" value={selectedRecorder} onChange={e => setSelectedRecorder(e.target.value)}>
              <option value="All">All Recorders</option>
              {recordersList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">
              BirdNet Confidence Cutoff
              <span style={{ float: 'right', color: '#4f46e5', fontWeight: 700 }}>{confidenceThreshold.toFixed(2)}</span>
            </label>
            <div className="slider-wrapper">
              <input
                type="range" min="0.0" max="1.0" step="0.05"
                value={confidenceThreshold}
                onChange={e => setConfidenceThreshold(Number(e.target.value))}
                className="range-slider"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── SUMMARY KPI CARDS (exact same as SummaryCards.tsx) ─────────────── */}
      <div className="summary-cards">
        <div className="kpi-card">
          <span className="kpi-label">Species Richness</span>
          <span className="kpi-value">{stats.uniqueSpecies}</span>
          <span className="kpi-subtext">Unique avian species detected</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total Detections</span>
          <span className="kpi-value">{stats.totalDetections.toLocaleString()}</span>
          <span className="kpi-subtext">BirdNET classification triggers</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Active Recorders</span>
          <span className="kpi-value">{filteredRecorders.length}</span>
          <span className="kpi-subtext">Recorder stations monitored</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Acoustic Survey Effort</span>
          <span className="kpi-value">{stats.filesProcessed.toLocaleString()}</span>
          <span className="kpi-subtext">{stats.filesProcessed} of {stats.filesExpected} clips parsed</span>
        </div>
      </div>

      {/* ─── SURVEY SITE MAP ────────────────────────────────────────────────── */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Survey Site Map</h2>
            <p>Recorder locations colored by species richness and detections.</p>
          </div>
        </div>
        <LantanaMap sites={mapSites} center={[10.47, 76.87]} zoom={13} />
      </div>

      {/* ─── DASHBOARD GRID SECTIONS ────────────────────────────────────────── */}
      <div className="dashboard-grid">

        {/* ─── AVIAN SPECIES EXPLORER (exact same as BirdSearch.tsx) ───────── */}
        <div className="dashboard-section" id="explorer-section">
          <div className="section-header">
            <div>
              <h2>Avian Species Explorer</h2>
              <p>Search for any detected bird species to view its ecological profile, IUCN status, and habitat associations.</p>
            </div>
          </div>

          {/* Search Box with Autocomplete */}
          <div className="search-box" ref={dropdownRef} style={{ maxWidth: '500px' }}>
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search by Common or Scientific name..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => searchQuery.trim() !== '' && setShowDropdown(true)}
            />
            {showDropdown && suggestions.length > 0 && (
              <div className="autocomplete-suggestions">
                {suggestions.map(sp => (
                  <div key={sp} className="suggestion-item" onClick={() => {
                    setSelectedSpecies(sp); setSearchQuery(''); setShowDropdown(false);
                  }}>
                    <span className="common">{sp}</span>
                    <span className="scientific">{speciesMetadata[sp]?.scientific}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Species Profile Card */}
          {profileData ? (
            <div className="profile-card">
              <div className="profile-left-col">
                <div className="profile-image-container">
                  {profileData.image && !profileData.image.includes('nan') && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileData.image}
                      alt={profileData.name}
                      className="profile-img"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div className="profile-placeholder">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '48px', height: '48px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Avian Species Profile</span>
                  </div>
                </div>
                <AudioPlayer 
                  src={profileData.audio ? (profileData.audio.startsWith('http') ? profileData.audio : `/${profileData.audio.replace(/^\/?audio\//, '')}`) : ''} 
                  speciesName={profileData.name} 
                />
              </div>

              <div className="profile-details">
                <div className="profile-header">
                  <h3>{profileData.name}</h3>
                  <div className="scientific">{profileData.scientific}</div>
                </div>

                <div className="profile-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Conservation Status</span>
                    <span className="meta-value" style={{ color: profileData.iucn !== 'LC' ? '#ea580c' : 'inherit' }}>
                      {profileData.iucn === 'LC' ? 'Least Concern (LC)' : profileData.iucn}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Foraging Guild</span>
                    <span className="meta-value">{profileData.guild}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Endemic Status</span>
                    <span className="meta-value">{profileData.endemic}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Vocal Activity</span>
                    <span className="meta-value">{profileData.vocal_activity}</span>
                  </div>
                </div>

                <div className="profile-meta-grid" style={{ gridTemplateColumns: '2fr 1fr', marginTop: '-0.5rem' }}>
                  <div className="meta-item">
                    <span className="meta-label">Preferred Habitat / Foraging Stratum</span>
                    <span className="meta-value" style={{ fontWeight: 500, fontSize: '0.8rem' }}>
                      {profileData.preferred_habitat} ({profileData.foraging_stratum})
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Indicator Class</span>
                    <span className="meta-value" style={{ color: profileData.indicator_group !== 'Nil' ? '#4f46e5' : 'inherit' }}>
                      {profileData.indicator_group}
                    </span>
                  </div>
                </div>

                <div className="profile-compare-block">
                  <span className="profile-compare-title">Habitat Distribution &amp; Relative Abundance</span>
                  <div className="profile-compare-grid">
                    <div className="compare-col lc">
                      <span className="compare-header lc">Lantana-Cleared (LC)</span>
                      <div className="compare-stats">
                        <span className="compare-large">{profileData.lcDetections.toLocaleString()}</span>
                        <span className="compare-label lc">detections</span>
                      </div>
                      <span className="kpi-subtext" style={{ color: '#14532d' }}>Present in {profileData.lcRecordersCount} LC stations</span>
                    </div>
                    <div className="compare-col li">
                      <span className="compare-header li">Lantana-Infested (LI)</span>
                      <div className="compare-stats">
                        <span className="compare-large">{profileData.liDetections.toLocaleString()}</span>
                        <span className="compare-label li">detections</span>
                      </div>
                      <span className="kpi-subtext" style={{ color: '#991b1b' }}>Present in {profileData.liRecordersCount} LI stations</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                  <span className="profile-compare-title">Diurnal Detections Pattern (Detections by Hour of Day)</span>
                  <div style={{ height: '180px', width: '100%', marginTop: '0.5rem' }}>
                    <ReactECharts option={diurnalOption} style={{ height: '100%', width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <span>Search or select a species from the auto-suggest list.</span>
            </div>
          )}
        </div>

        {/* ─── SPECIES DETECTION HEATMAP (exact same as HeatmapPanel.tsx) ───── */}
        <div className="dashboard-section" id="heatmap-section">
          <div className="section-header">
            <div>
              <h2>Species Detection Heatmap</h2>
              <p>Distribution and relative abundance (call counts) of species across physical recorders.</p>
            </div>
            <button className="btn-primary" onClick={downloadMatrixCSV}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Matrix CSV
            </button>
          </div>

          {/* Heatmap Controls – exact same layout as HeatmapPanel.tsx */}
          <div className="heatmap-controls">
            <div className="search-box">
              <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" className="search-input"
                placeholder="Search species common name..."
                value={matrixSearch} onChange={e => setMatrixSearch(e.target.value)}
              />
            </div>

            <div className="filter-item" style={{ minWidth: '150px' }}>
              <select className="select-input" value={topN} onChange={e => setTopN(e.target.value)}>
                <option value="15">Top 15 Species</option>
                <option value="25">Top 25 Species</option>
                <option value="50">Top 50 Species</option>
                <option value="All">All Species</option>
              </select>
            </div>

            <div className="filter-item" style={{ minWidth: '150px' }}>
              <select className="select-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="detections">Sort by Detections</option>
                <option value="alphabetical">Sort Alphabetically</option>
              </select>
            </div>

            <div className="filter-item">
              <div className="scale-toggle-group">
                <button type="button" className={`scale-toggle-btn${!useLogScale ? ' active' : ''}`} onClick={() => setUseLogScale(false)}>
                  Linear
                </button>
                <button type="button" className={`scale-toggle-btn${useLogScale ? ' active' : ''}`} onClick={() => setUseLogScale(true)}>
                  Log Scale ln(x+1)
                </button>
              </div>
            </div>
          </div>

          {yCategories.length === 0 ? (
            <div className="empty-state"><span>No species match your query.</span></div>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ minWidth: '800px', padding: '1rem 0' }}>
                <ReactECharts option={heatmapOption} style={{ height: heatmapHeight, width: '100%' }} />
              </div>
            </div>
          )}
        </div>

        {/* ─── RESTORATION INDICATOR SPECIES ANALYSIS (exact same as IndicatorPanel.tsx) */}
        <div className="dashboard-section" id="indicator-section">
          <div className="section-header">
            <div>
              <h2>Restoration Indicator Species Analysis</h2>
              <p>Detections of ecologically significant indicator species across Lantana-Cleared (LC) vs Lantana-Infested (LI) habitats.</p>
            </div>
          </div>

          <div className="heatmap-controls">
            <div className="filter-item" style={{ minWidth: '200px' }}>
              <select className="select-input" value={indicatorClass} onChange={e => setIndicatorClass(e.target.value as any)}>
                <option value="recovery">Recovery-associated Species</option>
                <option value="lantana">Lantana-associated Species</option>
                <option value="all">All Indicator Species</option>
              </select>
            </div>

            <div className="filter-item">
              <div className="scale-toggle-group">
                <button type="button" className={`scale-toggle-btn${!indicatorLogScale ? ' active' : ''}`} onClick={() => setIndicatorLogScale(false)}>
                  Linear
                </button>
                <button type="button" className={`scale-toggle-btn${indicatorLogScale ? ' active' : ''}`} onClick={() => setIndicatorLogScale(true)}>
                  Log Scale ln(x+1)
                </button>
              </div>
            </div>
          </div>

          <div style={{ width: '100%' }}>
            <div>
              {indYCats.length === 0 ? (
                <div className="empty-state"><span>No indicator species detected in current filter.</span></div>
              ) : (
                <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div style={{ minWidth: '800px', padding: '1rem 0' }}>
                    <ReactECharts option={indicatorOption} style={{ height: indicatorChartHeight, width: '100%' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <AnalysisCharts
          recs={landscapeRecorders}
          spSiteMatrix={stats.spSiteMatrix}
          siteRichness={stats.siteRichness}
          siteDetections={stats.siteDetections}
          speciesList={speciesList}
          speciesMetadata={speciesMetadata}
        />
      </div>
    </div>
  );
}
