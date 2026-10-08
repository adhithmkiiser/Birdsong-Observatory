'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AccumulationChartProps {
  data?: { day: string; species: number }[];
}

export function AccumulationChart({ data }: AccumulationChartProps) {
  const chartData = data || [];

  if (chartData.length === 0) {
    return (
      <div className="w-full h-72 rounded-xl bg-[#fafbfa] border border-[#dde1dc] flex flex-col items-center justify-center space-y-2 text-[#5a635d]">
        <div className="text-xs font-bold text-[#1a1f1c]">No Accumulation Transect Modeling Yet</div>
        <div className="text-[11px] text-[#5a635d] font-medium">Accumulation curves generate dynamically as species are logged over multi-day transects.</div>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
          <defs>
            <linearGradient id="colorSpecies" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1f4d3a" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#1f4d3a" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} />
          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderColor: '#dde1dc',
              borderRadius: '10px',
              color: '#1a1f1c',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
            }}
          />
          <Area type="monotone" dataKey="species" stroke="#1f4d3a" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpecies)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
