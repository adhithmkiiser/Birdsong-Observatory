'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface SiteMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  detectionsCount: number;
  speciesCount: number;
}

interface LightMapProps {
  sites: SiteMarkerData[];
  center?: [number, number];
  zoom?: number;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

// Compute gradient color based on species count
function getGradientColor(count: number, maxCount: number): string {
  const ratio = maxCount > 0 ? Math.min(count / maxCount, 1) : 0;
  if (ratio < 0.25) return '#3b82f6'; // Bright Blue
  if (ratio < 0.50) return '#10b981'; // Emerald Green
  if (ratio < 0.75) return '#f59e0b'; // Amber Gold
  return '#8b5cf6'; // Violet Purple
}

export default function LightMap({ sites, center = [11.41, 76.69], zoom = 10 }: LightMapProps) {
  const maxSpecies = Math.max(...sites.map(s => s.speciesCount), 1);

  return (
    <div className="w-full h-[380px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="w-full h-full z-0">
        {/* Sleek Positron Light Map Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <RecenterMap center={center} />

        {sites.map((site) => {
          const color = getGradientColor(site.speciesCount, maxSpecies);
          const radius = Math.max(12, Math.min(24, 10 + site.speciesCount * 0.8));

          return (
            <CircleMarker
              key={site.id}
              center={[site.lat, site.lng]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.85,
                color: '#ffffff',
                weight: 3
              }}
            >
              <Popup>
                <div className="p-2 space-y-1 font-sans text-xs">
                  <div className="font-extrabold text-slate-900">{site.name}</div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    🔊 Detections: <strong className="text-slate-900">{site.detectionsCount}</strong>
                  </div>
                  <div className="text-[11px] text-indigo-600 font-extrabold">
                    🐦 Unique Species: <strong>{site.speciesCount}</strong>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Floating Legend */}
      <div className="absolute bottom-3 right-3 z-[400] bg-white/90 backdrop-blur-md border border-slate-200 p-2.5 rounded-2xl text-[10px] font-bold text-slate-700 shadow-md flex items-center gap-3">
        <span className="text-slate-900 font-extrabold">Species Richness Gradient:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Low
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Mid
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> High
          <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> Highest
        </div>
      </div>
    </div>
  );
}
