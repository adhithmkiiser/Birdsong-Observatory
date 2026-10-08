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
      <div className="w-full h-80 rounded-xl bg-[#fafbfa] border border-[#dde1dc] flex flex-col items-center justify-center space-y-2 text-[#5a635d]">
        <div className="text-xs font-bold text-[#1a1f1c]">No Species Classification Detections Ingested</div>
        <div className="text-[11px] text-[#5a635d] font-medium">As new bird species calls are recorded by field nodes, rankings will populate automatically.</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
          <YAxis
            dataKey="species"
            type="category"
            stroke="#1a1f1c"
            fontSize={11}
            fontWeight={600}
            tickLine={false}
            width={240}
            interval={0}
          />
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
          <Bar dataKey="detections" fill="#1f4d3a" radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
