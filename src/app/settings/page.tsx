'use client';

import React, { useState } from 'react';
import { Settings, Key, Shield, Database, Sun, Moon, Cpu, Save } from 'lucide-react';

export default function SettingsPage() {
  const [supabaseUrl, setSupabaseUrl] = useState('https://demo-birdnet-cloud.supabase.co');
  const [supabaseKey, setSupabaseKey] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" /> Platform Configuration & System Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage Supabase cloud connection, Raspberry Pi sync defaults, and user permissions.</p>
        </div>

        <button className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>

      {/* Cloud Backend Form */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="w-4 h-4 text-emerald-400" /> Supabase Cloud Credentials
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Supabase Project URL</label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Supabase Anon Key</label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* Sync Daemon Defaults */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Cpu className="w-4 h-4 text-cyan-400" /> Raspberry Pi BirdNET Sync Engine Parameters
        </h3>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Sync Interval (Seconds)</label>
            <input
              type="number"
              defaultValue={15}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Offline Retry Attempts</label>
            <input
              type="number"
              defaultValue={10}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
