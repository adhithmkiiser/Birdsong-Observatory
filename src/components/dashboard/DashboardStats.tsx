'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

export interface DashboardStatsData {
  total_detections: number;
  unique_species: number;
  bird_of_year_name: string;
  bird_of_year_count: number;
  rarest_find_name: string;
  rarest_find_count: number;
  busiest_day_date: string;
  busiest_day_count: number;
  dawn_champion_name: string;
  night_owl_name: string;
  night_owl_count: number;
}

export function DashboardStats({ stats }: { stats: DashboardStatsData | null }) {
  if (!stats) return null;

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> Survey Bioacoustic Insights (BirdNET Highlights)
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bird of the Year</div>
          <div className="font-black text-slate-900 text-sm truncate">{stats.bird_of_year_name}</div>
          <div className="text-[10px] text-indigo-600 font-bold">{stats.bird_of_year_count.toLocaleString()} detections</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rarest Find</div>
          <div className="font-black text-slate-900 text-sm truncate">{stats.rarest_find_name}</div>
          <div className="text-[10px] text-rose-600 font-bold">{stats.rarest_find_count} detection</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Busiest Day</div>
          <div className="font-black text-slate-900 text-sm truncate">{stats.busiest_day_date}</div>
          <div className="text-[10px] text-emerald-600 font-bold">{stats.busiest_day_count.toLocaleString()} calls heard</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dawn Champion</div>
          <div className="font-black text-slate-900 text-sm truncate">{stats.dawn_champion_name}</div>
          <div className="text-[10px] text-amber-600 font-bold">First song at dawn</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Night Owl</div>
          <div className="font-black text-slate-900 text-sm truncate">{stats.night_owl_name}</div>
          <div className="text-[10px] text-purple-600 font-bold">{stats.night_owl_count} calls after dark</div>
        </div>
      </div>
    </div>
  );
}
