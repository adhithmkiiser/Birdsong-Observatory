'use client';

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Fix Leaflet default marker icons in Next.js
const createCustomIcon = (status?: string) => {
  const isOnline = status === 'online';
  const color = isOnline ? '#10b981' : status === 'idle' ? '#f59e0b' : '#f43f5e';

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="#ffffff"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-leaflet-marker',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -36]
  });
};

interface StationMapDetail {
  id: string;
  station_name: string;
  description: string;
  project_name: string;
  latitude: number;
  longitude: number;
  status: string;
  battery_level: number;
  cpu_temperature: number;
  disk_usage: number;
  total_detections: number;
  most_detected_species: string;
  latest_detection: string;
  image_url: string;
}

export default function SatelliteMap() {
  const [rawStations, setRawStations] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([13.6288, 79.4192]);

  useEffect(() => {
    async function loadStationsData() {
      try {
        const { data: recRegistry } = await supabase
          .from('recorders_registry')
          .select('*')
          .eq('project_type', 'Live');

        const combined: any[] = (recRegistry || []).map((r: any) => ({
          id: r.id || `${r.site_name}_${r.recorder_id}`,
          station_name: `${r.site_name} - Recorder ${r.recorder_id}`,
          description: `Project: ${r.project_name} | Site: ${r.site_name} | Recorder: ${r.recorder_id}`,
          project_name: r.project_name,
          latitude: Number(r.lat) || 13.6288,
          longitude: Number(r.long) || 79.4192,
          status: r.status || 'online',
          battery_level: r.battery_level ?? 100,
          cpu_temperature: r.cpu_temperature ?? 42.5,
          disk_usage: r.storage_used_percent ?? 18
        }));

        if (combined.length > 0) {
          setMapCenter([combined[0].latitude, combined[0].longitude]);
        }
        setRawStations(combined);
      } catch (err) {
        console.error('Failed to load satellite map stations:', err);
      }
    }

    loadStationsData();
  }, []);

  // Safely map deployed stations dataset
  const extendedStations: StationMapDetail[] = rawStations.map(stn => ({
    id: stn.id || 'stn-unknown',
    station_name: stn.station_name || 'Station Node',
    description: stn.description || 'Bioacoustic Field Node',
    project_name: stn.project_name || 'Live Observatory',
    latitude: Number(stn.latitude) || 13.5804,
    longitude: Number(stn.longitude) || 75.6432,
    status: stn.status || 'online',
    battery_level: stn.battery_level || 100,
    cpu_temperature: stn.cpu_temperature || 42,
    disk_usage: stn.disk_usage || 15,
    total_detections: stn.total_detections || 1,
    most_detected_species: 'Common Myna',
    latest_detection: 'Just now',
    image_url: 'https://images.unsplash.com/photo-1511497584788-8767610419ea?q=80&w=800&auto=format&fit=crop'
  }));

  const onlineCount = extendedStations.filter(s => s.status === 'online').length;

  return (
    /* Outer Curved Edge Card Box Container */
    <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-[24px] shadow-xl space-y-3.5 relative z-10">
      {/* Box Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 px-1">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-black text-slate-900">Live Recorder Location</h2>
        </div>
        <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
          {onlineCount} Active Nodes
        </span>
      </div>

      {/* Inner Map Container Box */}
      <div className="w-full h-[450px] rounded-[18px] border border-slate-200 overflow-hidden relative shadow-inner">
        <MapContainer
          key={mapCenter.join(',')}
          center={mapCenter}
          zoom={16}
          scrollWheelZoom={true}
          zoomControl={false}
          className="w-full h-full rounded-[18px]"
        >
          <ZoomControl position="bottomright" />

          {/* High Resolution ESRI World Satellite Imagery */}
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri World Imagery</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />

          {/* Transportation & Reference Overlay */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />

          {/* Field Recorder Markers */}
          {extendedStations.map((stn) => (
            <Marker
              key={stn.id}
              position={[stn.latitude, stn.longitude]}
              icon={createCustomIcon(stn.status)}
              eventHandlers={{
                mouseover: (e) => {
                  e.target.openTooltip();
                }
              }}
            >
              {/* Hover Card */}
              <Tooltip
                direction="bottom"
                offset={[0, 10]}
                opacity={1}
                interactive={true}
                className="rich-hover-tooltip"
              >
                <div className="w-80 rounded-2xl overflow-hidden bg-white text-slate-900 shadow-2xl space-y-3 font-sans border border-slate-300 p-0 text-left relative z-50">
                  {/* 1. Image on Top */}
                  <div className="h-40 relative bg-slate-950 overflow-hidden rounded-t-2xl">
                    <img
                      src={stn.image_url}
                      alt={stn.station_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-black text-white border border-slate-700/80 flex items-center gap-1.5 shadow-md">
                      <span className={`w-2 h-2 rounded-full ${stn.status === 'online' ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
                      ID: {stn.id} ({(stn.status || 'offline').toUpperCase()})
                    </div>
                  </div>

                  {/* 2. Recorder Details */}
                  <div className="p-4 pt-0 space-y-2.5 text-xs">
                    <div>
                      <h3 className="text-base font-black text-slate-900 leading-tight">{stn.station_name}</h3>
                      <p className="text-[11px] font-extrabold text-indigo-600 mt-0.5">{stn.project_name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{stn.description}</p>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">Detections So Far:</span>
                        <strong className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          {stn.total_detections.toLocaleString()} calls
                        </strong>
                      </div>

                      <div className="pt-1 border-t border-slate-200/80">
                        <span className="text-slate-500 font-bold block">Most Detected Species:</span>
                        <strong className="text-slate-900 font-extrabold block truncate">{stn.most_detected_species}</strong>
                      </div>

                      <div className="pt-1 border-t border-slate-200/80">
                        <span className="text-slate-500 font-bold block">Latest Audio Detection:</span>
                        <strong className="text-indigo-600 font-extrabold block truncate">{stn.latest_detection}</strong>
                      </div>
                    </div>

                    {/* 3. Hardware Telemetry */}
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 text-center font-bold pt-1">
                      <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200">
                        Temp: <strong className="text-slate-900 block">{stn.cpu_temperature}°C</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200">
                        Batt: <strong className="text-slate-900 block">{stn.battery_level}%</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200">
                        Disk: <strong className="text-slate-900 block">{stn.disk_usage}%</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {/* Empty State Banner when 0 Stations Deployed */}
        {extendedStations.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-950/85 backdrop-blur-md text-white border border-slate-700 px-4 py-2.5 rounded-2xl text-xs shadow-2xl flex items-center gap-3">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>No station nodes deployed yet on satellite map.</span>
            <a
              href="/stations"
              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-[10px] transition"
            >
              + Deploy Station
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
