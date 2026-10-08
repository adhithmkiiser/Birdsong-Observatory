'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface LantanaMapProps {
  sites: LantanaSiteMarkerData[];
  center?: [number, number];
  zoom?: number;
  heightClass?: string;
  showLantanaLegend?: boolean;
  showRichnessLegend?: boolean;
  minSpecies?: number;
  maxSpecies?: number;
  onSelectSite?: (siteName: string, siteId: string) => void;
}

import { getSpeciesGradientColor } from '@/lib/colorUtils';
export { getSpeciesGradientColor };

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

export default function LantanaMap({
  sites,
  center = [11.41, 76.69],
  zoom = 13,
  heightClass = 'h-[380px]',
  showLantanaLegend,
  showRichnessLegend = false,
  minSpecies = 0,
  maxSpecies = 0,
  onSelectSite
}: LantanaMapProps) {
  const hasLantanaHabitats = sites.some(
    s => s.habitat === 'LC' || s.habitat === 'LI' || s.habitat === 'CS' ||
         s.recorder_id?.toUpperCase().startsWith('LC') ||
         s.recorder_id?.toUpperCase().startsWith('LI') ||
         s.recorder_id?.toUpperCase().startsWith('CS')
  );

  const renderLantanaLegend = showLantanaLegend !== undefined ? showLantanaLegend : hasLantanaHabitats;

  return (
    <div className={`w-full rounded-2xl overflow-hidden border border-[#dde1dc] shadow-xs relative ${heightClass}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="w-full h-full z-0">
        {/* Esri World Imagery satellite tiles */}
        <TileLayer
          attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={18}
        />

        <RecenterMap center={center} zoom={zoom} sites={sites} />

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
            <Marker
              key={site.id}
              position={[site.lat, site.lng]}
              icon={icon}
            >
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
                    <span
                      style={{ color }}
                      className="font-black px-1.5 py-0.5 rounded bg-slate-100"
                    >
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
        </div>
      ) : renderLantanaLegend ? (
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md border border-[#dde1dc] px-3 py-2 rounded-xl text-[11px] font-bold text-[#1a1f1c] shadow-md flex items-center gap-3">
          <span className="text-[#5a635d] font-semibold">Habitats:</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> LC</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> LI</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> CS</span>
          </div>
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
