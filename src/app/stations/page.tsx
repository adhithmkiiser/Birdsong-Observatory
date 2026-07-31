'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Cpu, Battery, HardDrive, Thermometer, MapPin, Clock, ShieldCheck, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;
const STATION_HEARTBEAT_INTERVAL_MS = 60 * 1000;

export default function StationsPage() {
  const [recorders, setRecorders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    async function loadStations() {
      try {
        const { data: recordersData } = await supabase
          .from('recorders_registry')
          .select('*')
          .eq('project_type', 'Live')
          .order('created_at', { ascending: false });

        setRecorders(recordersData || []);
      } catch (err) {
        console.error('Failed to load stations:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStations();
    const interval = setInterval(() => setNow(Date.now()), STATION_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const stations = useMemo(() => {
    return recorders.map((r: any) => {
      const lastPingAt = r.last_ping ? new Date(r.last_ping) : (r.created_at ? new Date(r.created_at) : null);
      const isOnline = lastPingAt ? (now - lastPingAt.getTime()) < OFFLINE_THRESHOLD_MS : false;
      const minutesAgo = lastPingAt ? (now - lastPingAt.getTime()) / (1000 * 60) : 999;

      return {
        id: r.recorder_id,
        station_name: r.site_name,
        description: `Live Recorder Node ${r.recorder_id}`,
        project_name: r.project_name || 'Bird_Lab_demo',
        status: isOnline ? 'online' : 'offline',
        last_seen: isOnline ? 'Online now' : (lastPingAt ? `${Math.round(minutesAgo)} min ago (${lastPingAt.toLocaleTimeString()})` : 'Never'),
        battery_level: r.battery_level ?? 100,
        cpu_temperature: r.cpu_temperature ? Math.round(r.cpu_temperature * 10) / 10 : 45.0,
        disk_usage: r.storage_used_percent ? Math.round(r.storage_used_percent) : 0,
        latitude: r.lat ? r.lat.toFixed(4) : '13.6288',
        longitude: r.long ? r.long.toFixed(4) : '79.4192',
        firmware_version: r.firmware_version || 'v2.4 (Live)',
        birdnet_version: 'BirdNET-Pi',
        state: r.site_name,
        country: r.project_name
      };
    });
  }, [recorders, now]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" /> Field Recorder Telemetry & Node Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">Monitor deployed BirdNET-Pi hardware nodes, battery levels, disk space, and firmware health.</p>
        </div>
      </div>

      {/* Station Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 h-48 animate-pulse" />
          ))
        ) : stations.length === 0 ? (
          <div className="col-span-3 py-16 flex flex-col items-center gap-3 text-slate-500">
            <Cpu className="w-10 h-10 text-slate-700" />
            <div className="font-black text-sm text-slate-300">No Stations Deployed Yet</div>
            <p className="text-xs text-slate-500 max-w-sm text-center">Deploy a BirdNET-Pi field node and register it via the Admin console to see telemetry here.</p>
          </div>
        ) : stations.map((station) => (
          <div key={station.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden">
            {/* Status Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${station.status === 'online' ? 'bg-emerald-400 animate-ping' : station.status === 'idle' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                  {station.station_name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{station.description}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                station.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {station.status}
              </span>
            </div>

            {/* Location & Meta */}
            <div className="space-y-1 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{station.state}, {station.country} ({station.latitude}°N, {station.longitude}°E)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Last heartbeat: <strong className="text-white">{station.last_seen}</strong></span>
              </div>
            </div>

            {/* Telemetry Dials Grid */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Battery className="w-3 h-3 text-emerald-400" /> Battery
                </div>
                <p className="font-extrabold text-white">{station.battery_level}%</p>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full" style={{ width: `${station.battery_level}%` }}></div>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-rose-400" /> CPU Temp
                </div>
                <p className="font-extrabold text-white">{station.cpu_temperature}°C</p>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-rose-400 h-full" style={{ width: `${(station.cpu_temperature / 70) * 100}%` }}></div>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-cyan-400" /> Storage
                </div>
                <p className="font-extrabold text-white">{station.disk_usage}%</p>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full" style={{ width: `${station.disk_usage}%` }}></div>
                </div>
              </div>
            </div>

            {/* Firmware Footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/60">
              <span>BirdNET Version: <strong className="text-slate-200">{station.birdnet_version}</strong></span>
              <span>Firmware: <strong className="text-slate-200">{station.firmware_version}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
