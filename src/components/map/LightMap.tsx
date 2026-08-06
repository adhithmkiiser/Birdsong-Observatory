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
  uniformSize?: boolean;
  markerRadius?: number;
  heightClass?: string;
}

function RecenterMap({
  center,
  zoom,
  sites
}: {
  center: [number, number];
  zoom: number;
  sites: SiteMarkerData[];
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

// Compute a continuous blue (low) -> violet (high) gradient based on species count
function getGradientColor(count: number, minCount: number, maxCount: number): string {
  const range = maxCount - minCount;
  let ratio = 0;
  if (range > 0) {
    ratio = Math.min(Math.max((count - minCount) / range, 0), 1);
  } else if (maxCount > 0) {
    ratio = 1;
  }
  const hue = 220 + Math.round(50 * ratio); // blue (220) -> violet (270)
  return `hsl(${hue}, 80%, 58%)`;
}

export default function LightMap({
  sites,
  center = [11.41, 76.69],
  zoom = 10,
  uniformSize = false,
  markerRadius = 10,
  heightClass = 'h-[380px]'
}: LightMapProps) {
  const counts = sites.map(s => s.speciesCount);
  const minSpecies = counts.length ? Math.min(...counts) : 0;
  const maxSpecies = counts.length ? Math.max(...counts) : 1;

  return (
    <div className={`w-full rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative ${heightClass}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="w-full h-full z-0">
        {/* Sleek Positron Light Map Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <RecenterMap center={center} zoom={zoom} sites={sites} />

        {sites.map((site) => {
          const color = getGradientColor(site.speciesCount, minSpecies, maxSpecies);
          const radius = uniformSize ? markerRadius : Math.max(12, Math.min(24, 10 + site.speciesCount * 0.8));

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
          <span>Low</span>
          <div className="w-24 h-2.5 rounded-full shadow-inner" style={{ background: 'linear-gradient(to right, hsl(220, 80%, 58%), hsl(270, 80%, 58%))' }}></div>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
