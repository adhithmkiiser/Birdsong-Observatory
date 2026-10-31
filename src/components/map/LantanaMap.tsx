'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Check, Map as MapIcon, Eye, EyeOff, Upload } from 'lucide-react';
import { parseShapefileOrGeoJson } from '@/lib/shapefileParser';
import { useRole } from '@/components/layout/RoleContext';
import { apiFetch } from '@/lib/apiClient';

export interface LantanaSiteMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  site_group: string;
  recorder_id: string;
  detectionsCount: number;
  speciesCount: number;
  color?: string;
  habitat?: string;
}

export interface MapShapefileItem {
  id: string;
  name: string;
  targetId: string;
  targetType?: 'site' | 'project';
  habitat?: string;
  projectId?: string;
  siteId?: string;
  centroid?: [number, number];
  geojson: any;
}

interface LantanaMapProps {
  sites: LantanaSiteMarkerData[];
  shapefiles?: MapShapefileItem[];
  center?: [number, number];
  zoom?: number;
  heightClass?: string;
  showLantanaLegend?: boolean;
  showRichnessLegend?: boolean;
  minSpecies?: number;
  maxSpecies?: number;
  onSelectSite?: (siteName: string, siteId: string) => void;
  projectId?: string;
  selectedSiteId?: string;
}

import { getSpeciesGradientColor } from '@/lib/colorUtils';
export { getSpeciesGradientColor };

export type BasemapId =
  | 'pure-satellite'
  | 'terrain-elevation'
  | 'esri-satellite';

interface BasemapDef {
  id: BasemapId;
  name: string;
  badge: string;
  description: string;
  url: string;
  attribution: string;
  maxNativeZoom: number;
}

const BASEMAP_OPTIONS: BasemapDef[] = [
  {
    id: 'pure-satellite',
    name: 'Pure Satellite Imagery (Recommended)',
    badge: 'Recommended',
    description: 'Cloud-free Google Satellite imagery without road or text overlays',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite (Cloud-Free)',
    maxNativeZoom: 20
  },
  {
    id: 'terrain-elevation',
    name: 'Terrain / Elevation',
    badge: 'Elevation',
    description: 'Elevation contours, shaded relief, and altitude gradients',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Topo Map',
    maxNativeZoom: 18
  },
  {
    id: 'esri-satellite',
    name: 'Esri (Satellite)',
    badge: 'Esri Sat',
    description: 'Standard Esri World Imagery satellite view',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxNativeZoom: 18
  }
];

function RecenterMap({
  center,
  zoom,
  sites
}: {
  center: [number, number];
  zoom: number;
  sites: LantanaSiteMarkerData[];
}) {
  const map = useMap();
  useEffect(() => {
    if (sites.length > 0) {
      const bounds: [number, number][] = sites.map((s) => [s.lat, s.lng]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else {
      map.setView(center, zoom);
    }
  }, [center, zoom, sites, map]);
  return null;
}

function getMarkerColor(site: LantanaSiteMarkerData): string {
  if (site.color) return site.color;
  const hab = (site.habitat || '').toUpperCase();
  if (hab === 'LC') return '#10b981'; // emerald
  if (hab === 'LI') return '#ef4444'; // red
  if (hab === 'CS') return '#f59e0b'; // amber

  const token = (site.recorder_id || '').toUpperCase().split(/[-_/]/)[0];
  if (token === 'LC') return '#10b981';
  if (token === 'LI') return '#ef4444';
  if (token === 'CS') return '#f59e0b';
  
  // Default vibrant green for standard monitoring stations
  return '#10b981';
}

/**
 * Shapefile polygon style calculation:
 * - Lantana cleared ('LC') or Common PAM: light transparent green
 * - Lantana infected ('LI'): light transparent red
 * - Control site ('CS'): light transparent amber
 */
export function getShapefileFeatureStyle(
  shape: { habitat?: string; targetType?: string; name?: string },
  feature?: any
) {
  const habProp = (feature?.properties?.habitat || feature?.properties?.HABITAT || shape.habitat || '').toUpperCase();
  const nameProp = (feature?.properties?.name || shape.name || '').toUpperCase();

  const isInfested =
    habProp === 'LI' ||
    habProp.includes('INFEST') ||
    nameProp.includes('LI_') ||
    nameProp.startsWith('LI');

  const isControl =
    habProp === 'CS' ||
    habProp.includes('CONTROL') ||
    nameProp.includes('CS_') ||
    nameProp.startsWith('CS');

  if (isInfested) {
    // Light transparent red
    return {
      fillColor: '#ef4444',
      fillOpacity: 0.35,
      color: '#dc2626',
      weight: 2,
      opacity: 0.9
    };
  }

  if (isControl) {
    // Control site: light transparent amber
    return {
      fillColor: '#f59e0b',
      fillOpacity: 0.35,
      color: '#d97706',
      weight: 2,
      opacity: 0.9
    };
  }

  // Lantana cleared ('LC'), Common PAM, Live recorder, or default: light transparent green
  return {
    fillColor: '#10b981',
    fillOpacity: 0.35,
    color: '#059669',
    weight: 2,
    opacity: 0.9
  };
}

export default function LantanaMap({
  sites,
  shapefiles: propShapefiles,
  center = [11.41, 76.69],
  zoom = 13,
  heightClass = 'h-[380px]',
  showLantanaLegend,
  showRichnessLegend = false,
  minSpecies = 0,
  maxSpecies = 0,
  onSelectSite,
  projectId,
  selectedSiteId
}: LantanaMapProps) {
  const { currentRole, currentUser } = useRole();
  // Pure Satellite Imagery (Recommended) as default
  const [selectedBasemap, setSelectedBasemap] = useState<BasemapId>('pure-satellite');
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [showShapefiles, setShowShapefiles] = useState(true);
  const [loadedShapefiles, setLoadedShapefiles] = useState<MapShapefileItem[]>([]);
  const basemapMenuRef = useRef<HTMLDivElement>(null);
  const quickUploadRef = useRef<HTMLInputElement>(null);

  // Automatically fetch all stored shapefiles if not passed as props
  useEffect(() => {
    if (propShapefiles && propShapefiles.length > 0) {
      setLoadedShapefiles(propShapefiles);
      return;
    }

    let isMounted = true;
    async function fetchShapefiles() {
      try {
        const queryParam = projectId && projectId !== 'ALL' && projectId !== 'ALL_LANTANA' ? `&projectId=${encodeURIComponent(projectId)}` : '';
        const res = await fetch(`/api/db/shapefiles?all=true${queryParam}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.items && Array.isArray(data.items)) {
          setLoadedShapefiles(data.items);
        }
      } catch (err) {
        console.error('Failed to load map shapefiles:', err);
      }
    }

    fetchShapefiles();
    return () => {
      isMounted = false;
    };
  }, [propShapefiles, projectId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (basemapMenuRef.current && !basemapMenuRef.current.contains(e.target as Node)) {
        setShowBasemapMenu(false);
      }
    }
    if (showBasemapMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBasemapMenu]);


  // Filter loaded shapefiles so only boundaries relevant to the current project, site, or map region are shown
  const relevantShapefiles = useMemo(() => {
    if (propShapefiles && propShapefiles.length > 0) return propShapefiles;
    if (loadedShapefiles.length === 0) return [];

    const normProj = (projectId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('project') : '') || '').toLowerCase().trim();
    const normSite = (selectedSiteId || '').toLowerCase().trim();

    // Map site IDs & names for direct matching
    const currentSiteKeys = new Set(
      sites.flatMap((s) => [
        String(s.id).toLowerCase().trim(),
        String(s.name).toLowerCase().trim(),
        String(s.site_group || '').toLowerCase().trim(),
        String(s.recorder_id || '').toLowerCase().trim()
      ]).filter(Boolean)
    );

    // Compute average map center from sites or default center
    const mapCenterLat = sites.length > 0 ? sites.reduce((acc, s) => acc + s.lat, 0) / sites.length : center[0];
    const mapCenterLng = sites.length > 0 ? sites.reduce((acc, s) => acc + s.lng, 0) / sites.length : center[1];

    return loadedShapefiles.filter((shape) => {
      const tId = String(shape.targetId || shape.id || '').toLowerCase().trim();
      const tType = shape.targetType || 'site';
      const shapeProj = String((shape as any).projectId || '').toLowerCase().trim();

      // 1. Explicit Project match
      if (normProj && normProj !== 'all' && normProj !== 'all_lantana') {
        if (tId === normProj || tId.startsWith(normProj + '_') || shapeProj === normProj) {
          return true;
        }
        // If the shapefile is explicitly for another project (e.g. nilgiri vs tst_lantana), reject
        if (tType === 'project' && (tId.includes('nilgiri') || shapeProj.includes('nilgiri')) && !normProj.includes('nilgiri')) {
          return false;
        }
      }

      // 2. Explicit Site match
      if (normSite && normSite !== 'all' && (tId === normSite || tId.startsWith(normSite + '_'))) {
        return true;
      }
      if (currentSiteKeys.has(tId)) {
        return true;
      }

      // 3. Geographic proximity check:
      // If shapefile has a centroid, verify it is within geographic range of the map's sites (~60 km)
      if (shape.centroid && Array.isArray(shape.centroid) && shape.centroid.length === 2) {
        const [sLat, sLng] = shape.centroid;
        const dLat = (sLat - mapCenterLat) * 111;
        const dLng = (sLng - mapCenterLng) * 111 * Math.cos((mapCenterLat * Math.PI) / 180);
        const distKm = Math.sqrt(dLat * dLat + dLng * dLng);

        // If distance > 60 km, it belongs to another region (e.g. Nilgiris ~11.34° is 100km from Anamalai ~10.47°)
        if (distKm > 60) {
          return false;
        }
        return true;
      }

      // If shapefile has no centroid and doesn't match current project/site, do not show
      return false;
    });
  }, [propShapefiles, loadedShapefiles, projectId, selectedSiteId, sites, center]);

  // Active shapefiles: only show actual user-uploaded shapefiles (no synthetic polygons around stations)
  const activeShapefiles = useMemo(() => {
    return relevantShapefiles;
  }, [relevantShapefiles]);

  const activeBasemap = BASEMAP_OPTIONS.find((b) => b.id === selectedBasemap) || BASEMAP_OPTIONS[0];

  const hasLantanaHabitats = sites.some(
    (s) =>
      s.habitat === 'LC' ||
      s.habitat === 'LI' ||
      s.habitat === 'CS' ||
      s.recorder_id?.toUpperCase().startsWith('LC') ||
      s.recorder_id?.toUpperCase().startsWith('LI') ||
      s.recorder_id?.toUpperCase().startsWith('CS')
  );

  const renderLantanaLegend = showLantanaLegend !== undefined ? showLantanaLegend : hasLantanaHabitats;

  // RBAC Permission Check:
  // Shapefile upload is restricted:
  // - Public / Unauthenticated: NEVER allowed (button hidden)
  // - Admin: Allowed globally across all projects & sites
  // - Project Manager: ONLY for their assigned project(s)
  // - Site Manager: ONLY for their assigned site(s)
  const { canUploadShapefile, activeProj, activeSite } = useMemo(() => {
    const isPublic = !currentRole || currentRole === 'Public' || currentUser?.role === 'Public' || currentUser?.id === 'usr-public';
    if (isPublic) {
      return { canUploadShapefile: false, activeProj: '', activeSite: '' };
    }

    const urlProj = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('project') || '' : '';
    const resolvedProj = (projectId || urlProj || '').toLowerCase().trim();
    const resolvedSite = (selectedSiteId || '').toLowerCase().trim();

    // Admin has global rights
    if (currentRole === 'Admin' || currentUser?.role === 'Admin') {
      return { canUploadShapefile: true, activeProj: resolvedProj, activeSite: resolvedSite };
    }

    // Project Manager: only for assigned project
    if (currentRole === 'Project Manager' || currentUser?.role === 'Project Manager') {
      const userAssignedProjects = [
        ...(currentUser?.assignedProjects || []),
        ...(currentUser?.projectScopePermissions || []),
        ...(currentUser?.assignedProject ? [currentUser.assignedProject] : [])
      ].map(p => String(p).toLowerCase().trim()).filter(Boolean);

      const isAssigned = (resolvedProj && resolvedProj !== 'all' && resolvedProj !== 'all_lantana')
        ? userAssignedProjects.includes(resolvedProj)
        : userAssignedProjects.length > 0;

      return { canUploadShapefile: isAssigned, activeProj: resolvedProj, activeSite: resolvedSite };
    }

    // Site Manager: only for assigned site
    if (currentRole === 'Site Manager' || currentUser?.role === 'Site Manager') {
      const userAssignedSites = [
        ...(currentUser?.assignedSites || []),
        ...(currentUser?.assignedSite ? [currentUser.assignedSite] : [])
      ].map(s => String(s).toLowerCase().trim()).filter(Boolean);

      if (userAssignedSites.length === 0) {
        return { canUploadShapefile: false, activeProj: resolvedProj, activeSite: resolvedSite };
      }

      const isAssigned = (resolvedSite && resolvedSite !== 'all')
        ? userAssignedSites.includes(resolvedSite)
        : (
          userAssignedSites.length === 1 ||
          sites.some(s =>
            userAssignedSites.includes(String(s.id).toLowerCase().trim()) ||
            userAssignedSites.includes(String(s.name).toLowerCase().trim()) ||
            userAssignedSites.includes(String(s.site_group || '').toLowerCase().trim()) ||
            userAssignedSites.includes(String(s.recorder_id || '').toLowerCase().trim())
          )
        );

      return { canUploadShapefile: isAssigned, activeProj: resolvedProj, activeSite: resolvedSite };
    }

    return { canUploadShapefile: false, activeProj: resolvedProj, activeSite: resolvedSite };
  }, [currentRole, currentUser, projectId, selectedSiteId, sites]);

  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canUploadShapefile) {
      alert('Access Denied: Shapefile upload is only permitted for Admins, Project Managers (for assigned projects), or Site Managers (for assigned sites).');
      if (quickUploadRef.current) quickUploadRef.current.value = '';
      return;
    }

    try {
      setUploadStatus('Processing file...');
      const parsed = await parseShapefileOrGeoJson(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');

      const isSiteTarget = Boolean(activeSite && activeSite !== 'all');
      const targetType: 'site' | 'project' = isSiteTarget ? 'site' : (activeProj && activeProj !== 'all' && activeProj !== 'all_lantana' ? 'project' : 'site');
      const targetId = isSiteTarget ? activeSite : (activeProj && activeProj !== 'all' && activeProj !== 'all_lantana' ? activeProj : cleanName);

      const newShape: MapShapefileItem = {
        id: `uploaded-${Date.now()}`,
        name: cleanName,
        targetId,
        targetType,
        geojson: parsed.geojson
      };

      setLoadedShapefiles((prev) => [newShape, ...prev]);
      setShowShapefiles(true);
      setUploadStatus(`Added "${file.name}" (${parsed.featureCount} polygons)`);
      setTimeout(() => setUploadStatus(''), 4500);

      // Persist to server with authentication headers
      await apiFetch(
        '/api/db/shapefiles',
        {
          method: 'POST',
          body: JSON.stringify({
            targetId: newShape.targetId,
            targetType: newShape.targetType,
            name: newShape.name,
            projectId: activeProj,
            siteId: activeSite,
            geojson: parsed.geojson,
            centroid: parsed.centroid
          })
        },
        currentUser
      );
    } catch (err: any) {
      alert('Shapefile upload error: ' + err.message);
      setUploadStatus('');
    } finally {
      if (quickUploadRef.current) quickUploadRef.current.value = '';
    }
  };

  return (
    <div className={`w-full rounded-2xl overflow-hidden border border-[#dde1dc] shadow-xs relative ${heightClass}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="w-full h-full z-0">
        {/* Dynamic Basemap Layer */}
        <TileLayer
          key={activeBasemap.id}
          attribution={activeBasemap.attribution}
          url={activeBasemap.url}
          maxNativeZoom={activeBasemap.maxNativeZoom}
        />

        <RecenterMap center={center} zoom={zoom} sites={sites} />

        {/* Shapefile Polygons Overlay */}
        {showShapefiles &&
          activeShapefiles.map((shape) => {
            if (!shape.geojson) return null;
            return (
              <GeoJSON
                key={`${shape.id}-${shape.targetId}-${shape.habitat}`}
                data={shape.geojson}
                style={(feature) => getShapefileFeatureStyle(shape, feature)}
                onEachFeature={(feature, layer) => {
                  const style = getShapefileFeatureStyle(shape, feature);
                  const isInfested = style.fillColor === '#ef4444';
                  const isControl = style.fillColor === '#f59e0b';
                  const label = isInfested
                    ? 'Lantana Infested (LI)'
                    : isControl
                    ? 'Control Site (CS)'
                    : 'Lantana Cleared / PAM Station (LC)';

                  layer.bindPopup(`
                    <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; padding: 4px; line-height: 1.4;">
                      <div style="font-weight: 800; font-size: 12px; color: #0f172a; margin-bottom: 2px;">
                        ${shape.name || feature.properties?.name || 'Survey Plot Boundary'}
                      </div>
                      <div style="color: #64748b; font-size: 10px;">
                        ID: <span style="font-family: monospace; font-weight: 600; color: #1e293b;">${shape.targetId}</span>
                      </div>
                      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; display: flex; items: center; gap: 4px;">
                        <span style="font-size: 10px; color: #475569;">Habitat:</span>
                        <span style="font-weight: 700; color: ${style.color}; background: ${style.fillColor}22; padding: 1px 4px; border-radius: 4px;">
                          ${label}
                        </span>
                      </div>
                    </div>
                  `);
                }}
              />
            );
          })}

        {/* Site Station Markers */}
        {sites.map((site) => {
          const color = getMarkerColor(site);
          const icon = L.divIcon({
            html: `<div style="width:26px;height:34px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
              <svg viewBox="0 0 24 32" width="26" height="34" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 20 12 20s12-11.5 12-20c0-6.6-5.4-12-12-12z"/>
                <circle cx="12" cy="12" r="4.5" fill="#ffffff" stroke="none"/>
              </svg>
            </div>`,
            className: 'bg-transparent border-0',
            iconSize: [26, 34],
            iconAnchor: [13, 34],
            popupAnchor: [0, -32]
          });

          return (
            <Marker key={site.id} position={[site.lat, site.lng]} icon={icon}>
              <Popup>
                <div className="p-2 space-y-1 font-sans text-xs">
                  <div className="font-extrabold text-[#1a1f1c] text-sm">{site.name}</div>
                  <div className="text-[11px] text-[#5a635d]">
                    Station Node: <strong className="text-[#1a1f1c]">{site.site_group}</strong>
                  </div>
                  <div className="text-[11px] text-[#5a635d]">
                    Detections: <strong className="text-[#1f4d3a] font-bold">{site.detectionsCount.toLocaleString()}</strong> calls
                  </div>
                  <div className="text-[11px] flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <span className="text-[#5a635d]">Species Richness:</span>
                    <span style={{ color }} className="font-black px-1.5 py-0.5 rounded bg-slate-100">
                      {site.speciesCount} species
                    </span>
                  </div>
                  {onSelectSite && (
                    <button
                      onClick={() => onSelectSite(site.name, site.id)}
                      className="mt-2 w-full py-1 px-2 rounded-lg bg-[#1f4d3a] hover:bg-[#16382a] text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                    >
                      <span>Filter to this Station</span> &rarr;
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Controls: Basemap Selector, Shapefile Toggle & Direct Upload */}
      <div ref={basemapMenuRef} className="absolute bottom-3 left-3 z-[400] flex items-center gap-2">
        <button
          onClick={() => setShowBasemapMenu(!showBasemapMenu)}
          className="bg-white/95 hover:bg-white text-[#1a1f1c] backdrop-blur-md border border-[#dde1dc] shadow-md px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer hover:border-[#1f4d3a]/40"
          title="Switch Basemap Tile Layer"
        >
          <Layers className="w-3.5 h-3.5 text-[#1f4d3a]" />
          <span>{activeBasemap.name}</span>
        </button>

        {/* Toggle Shapefile Visibility - only show when custom shapefiles exist */}
        {activeShapefiles.length > 0 && (
          <button
            onClick={() => setShowShapefiles(!showShapefiles)}
            className={`backdrop-blur-md border px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              showShapefiles
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white/95 text-slate-600 border-[#dde1dc] hover:bg-white'
            }`}
            title="Toggle Shapefile Boundaries"
          >
            {showShapefiles ? (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Shapefiles ({activeShapefiles.length})</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Shapefiles Hidden</span>
              </>
            )}
          </button>
        )}

        {/* Direct Upload Shapefile Button - Only visible for Admin, Assigned Project Manager, or Assigned Site Manager */}
        {canUploadShapefile && (
          <>
            <input
              ref={quickUploadRef}
              type="file"
              accept=".zip,.kmz,.kml,.shp,.geojson,.json"
              onChange={handleQuickUpload}
              className="hidden"
              id="map-quick-shapefile-upload"
            />
            <button
              onClick={() => quickUploadRef.current?.click()}
              className="bg-white/95 hover:bg-white text-[#1a1f1c] backdrop-blur-md border border-[#dde1dc] shadow-md px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer hover:border-emerald-600/40"
              title="Upload KML, KMZ, Shapefile (.zip/.shp), or GeoJSON directly"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Upload Shapefile</span>
            </button>
          </>
        )}

        {canUploadShapefile && uploadStatus && (
          <span className="bg-emerald-600 text-white font-bold px-2 py-1 rounded-xl text-[10px] shadow-sm flex items-center gap-1 animate-in fade-in">
            <Check className="w-3 h-3" /> {uploadStatus}
          </span>
        )}

        {showBasemapMenu && (
          <div className="absolute bottom-10 left-0 w-72 bg-white/98 backdrop-blur-md border border-[#dde1dc] rounded-2xl shadow-xl p-2 space-y-1 text-xs">
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#5a635d] border-b border-[#dde1dc]">
              Select Basemap Layer
            </div>
            {BASEMAP_OPTIONS.map((bm) => {
              const isSelected = bm.id === selectedBasemap;
              return (
                <button
                  key={bm.id}
                  onClick={() => {
                    setSelectedBasemap(bm.id);
                    setShowBasemapMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl transition-all flex items-start justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#f0f7f3] text-[#1f4d3a] font-bold border border-[#1f4d3a]/20'
                      : 'hover:bg-[#f5f6f4] text-[#1a1f1c]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs">{bm.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                          bm.badge === 'Recommended'
                            ? 'bg-emerald-100 text-emerald-800 font-bold'
                            : bm.badge === 'Shapefile'
                            ? 'bg-blue-100 text-blue-800 font-bold'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {bm.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#5a635d] leading-tight font-normal">{bm.description}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#1f4d3a] shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Legend */}
      {showRichnessLegend ? (
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md border border-[#dde1dc] px-3.5 py-2.5 rounded-xl text-[11px] font-bold text-[#1a1f1c] shadow-md flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#1f4d3a] font-black uppercase tracking-wider text-[10px]">Species Richness</span>
            <span className="text-[10px] text-[#5a635d] font-normal">{sites.length} Active Stations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-700 font-extrabold">{minSpecies} spp (Low)</span>
            <div
              className="w-28 h-2.5 rounded-full border border-black/10"
              style={{ background: 'linear-gradient(to right, #10b981, #f59e0b, #ef4444)' }}
            />
            <span className="text-[10px] text-rose-700 font-extrabold">{maxSpecies} spp (High)</span>
          </div>
          {showShapefiles && activeShapefiles.length > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
              <span className="font-semibold text-emerald-700">Shapefiles:</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-500/40 border border-emerald-600 inline-block"></span> Cleared/PAM
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-red-500/40 border border-red-600 inline-block"></span> Infested
              </span>
            </div>
          )}
        </div>
      ) : renderLantanaLegend ? (
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md border border-[#dde1dc] px-3 py-2 rounded-xl text-[11px] font-bold text-[#1a1f1c] shadow-md flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="text-[#5a635d] font-semibold">Habitats:</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1" title="Lantana Cleared (Transparent Light Green)">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> LC (Cleared)
              </span>
              <span className="flex items-center gap-1" title="Lantana Infested (Transparent Light Red)">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> LI (Infested)
              </span>
              <span className="flex items-center gap-1" title="Control Site (Amber)">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> CS
              </span>
            </div>
          </div>
          {showShapefiles && activeShapefiles.length > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
              <span className="font-semibold text-emerald-700">Polygon:</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-500/40 border border-emerald-600 inline-block"></span> Cleared/PAM
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-red-500/40 border border-red-600 inline-block"></span> Infested
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md border border-[#dde1dc] px-3 py-2 rounded-xl text-[11px] font-bold text-[#1a1f1c] shadow-md flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block"></span>
          <span>{sites.length} Active Stations</span>
        </div>
      )}
    </div>
  );
}
