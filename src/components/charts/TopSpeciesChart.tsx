'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface TopSpeciesChartProps {
  data?: { species: string; detections: number }[];
}

export function TopSpeciesChart({ data }: TopSpeciesChartProps) {
  const chartData = data || [];

  if (chartData.length === 0) {
    return (
      <div className="w-full h-80 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center space-y-2 text-slate-400">
        <div className="text-xs font-extrabold text-slate-700">No Species Classification Detections Ingested</div>
        <div className="text-[10px] text-slate-500 font-medium">As new bird species calls are recorded by field nodes, rankings will populate automatically.</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={chartData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis
            dataKey="species"
            type="category"
            stroke="#0f172a"
            fontSize={12}
            fontWeight={700}
            tickLine={false}
            width={280}
            interval={0}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderColor: '#e2e8f0',
              borderRadius: '12px',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
          />
          <Bar dataKey="detections" fill="#16a34a" radius={[0, 6, 6, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
