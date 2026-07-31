'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LantanaSiteMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  site_group: string;
  recorder_id: string;
  detectionsCount: number;
  speciesCount: number;
}

interface LantanaMapProps {
  sites: LantanaSiteMarkerData[];
  center?: [number, number];
  zoom?: number;
  heightClass?: string;
}

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

function getGroupColor(recorderId: string): string {
  const token = (recorderId || '').toUpperCase().split(/[-_/]/)[0];
  if (token === 'LC') return '#10b981'; // green
  if (token === 'LI') return '#ef4444'; // red
  if (token === 'CS') return '#f59e0b'; // yellow
  return '#64748b'; // slate
}

export default function LantanaMap({
  sites,
  center = [11.41, 76.69],
  zoom = 13,
  heightClass = 'h-[380px]'
}: LantanaMapProps) {
  return (
    <div className={`w-full rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative ${heightClass}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="w-full h-full z-0">
        {/* Esri World Imagery satellite tiles */}
        <TileLayer
          attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={18}
        />

        <RecenterMap center={center} zoom={zoom} sites={sites} />

        {sites.map((site) => {
          const color = getGroupColor(site.recorder_id);
          const icon = L.divIcon({
            html: `<div style="width:24px;height:32px;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.4));">
              <svg viewBox="0 0 24 32" width="24" height="32" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 20 12 20s12-11.5 12-20c0-6.6-5.4-12-12-12z"/>
                <circle cx="12" cy="12" r="4.5" fill="white" stroke="none"/>
              </svg>
            </div>`,
            className: 'bg-transparent border-0',
            iconSize: [24, 32],
            iconAnchor: [12, 32],
            popupAnchor: [0, -30]
          });

          return (
            <Marker
              key={site.id}
              position={[site.lat, site.lng]}
              icon={icon}
            >
              <Popup>
                <div className="p-2 space-y-1 font-sans text-xs">
                  <div className="font-extrabold text-slate-900">{site.name}</div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    Group: <strong className="text-slate-900">{site.site_group}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    Detections: <strong className="text-slate-900">{site.detectionsCount}</strong>
                  </div>
                  <div className="text-[11px] text-indigo-600 font-extrabold">
                    Unique Species: <strong>{site.speciesCount}</strong>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Legend */}
      <div className="absolute top-3 right-3 z-[400] bg-white/90 backdrop-blur-md border border-slate-200 p-2.5 rounded-2xl text-[10px] font-bold text-slate-700 shadow-md flex items-center gap-3">
        <span className="text-slate-900 font-extrabold">Site Groups:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> LC
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> LI
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> CS
        </div>
      </div>
    </div>
  );
}
