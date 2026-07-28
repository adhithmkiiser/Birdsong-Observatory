'use client';

import React from 'react';
import { Cpu, Battery, HardDrive, Thermometer, MapPin, Clock, ShieldCheck, Activity } from 'lucide-react';
import { STATIONS_DATA } from '@/lib/mockData';

export default function StationsPage() {
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
        <button className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition">
          + Add New Station Node
        </button>
      </div>

      {/* Station Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {STATIONS_DATA.map((station) => (
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
