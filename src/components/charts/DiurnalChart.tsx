'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const EMPTY_24H_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  detections: 0
}));

interface DiurnalChartProps {
  data?: { hour: string; detections: number }[];
}

export function DiurnalChart({ data }: DiurnalChartProps) {
  const chartData = (data && data.length > 0) ? data : EMPTY_24H_DATA;
  const hasData = chartData.some(d => d.detections > 0);

  if (!hasData) {
    return (
      <div className="w-full h-80 rounded-xl bg-[#fafbfa] border border-[#dde1dc] flex flex-col items-center justify-center space-y-2 text-[#5a635d]">
        <div className="text-xs font-bold text-[#1a1f1c]">No Diurnal Call Detections Recorded Yet</div>
        <div className="text-[11px] text-[#5a635d] font-medium">Connect a field recorder station node or run Python sync engine to stream detections.</div>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis 
            dataKey="hour" 
            stroke="#64748b" 
            fontSize={10} 
            tickLine={false} 
            interval={0}
            angle={-30}
            textAnchor="end"
          />
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
            cursor={{ fill: '#f0f7f3' }}
          />
          <Bar dataKey="detections" fill="#1f4d3a" radius={[4, 4, 0, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
