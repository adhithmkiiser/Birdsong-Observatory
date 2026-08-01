'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface Props {
  detections: any[];
}

export default function CommonSpeciesHourMatrix({ detections }: Props) {
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixTopN, setMatrixTopN] = useState('25');
  const [matrixSort, setMatrixSort] = useState<'detections' | 'alphabetical'>('detections');
  const [useLogScale, setUseLogScale] = useState(true);
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const { matrixOption, matrixHeight, yCount } = useMemo(() => {
    const bySp: Record<string, number[]> = {};
    detections.forEach((d: any) => {
      const sp = d.common_name || 'Unknown';
      if (!d.time) return;
      const h = parseInt(d.time.split(':')[0], 10);
      if (isNaN(h) || h < 0 || h >= 24) return;
      if (sp.toLowerCase() === 'nocall' || sp === 'Unknown') return;
      if (!bySp[sp]) bySp[sp] = Array(24).fill(0);
      bySp[sp][h]++;
    });

    const totals = Object.entries(bySp).map(([name, counts]) => ({
      name,
      total: counts.reduce((a, b) => a + b, 0),
      counts
    }));

    let filtered = totals.filter(item => item.name.toLowerCase().includes(matrixSearch.toLowerCase()));
    if (matrixSort === 'detections') filtered.sort((a, b) => b.total - a.total);
    else filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (matrixTopN !== 'All') filtered = filtered.slice(0, parseInt(matrixTopN, 10));

    const yCats = filtered.map(s => s.name).reverse();
    const data: [number, number, number, number][] = [];
    let maxVal = 1;

    yCats.forEach((sp, yIdx) => {
      const counts = bySp[sp];
      hourLabels.forEach((_, xIdx) => {
        const val = counts?.[xIdx] || 0;
        const colorVal = useLogScale ? Math.log1p(val) : val;
        data.push([xIdx, yIdx, colorVal, val]);
        if (val > maxVal) maxVal = val;
      });
    });

    const maxColorVal = useLogScale ? Math.log1p(maxVal) : Math.max(10, Math.ceil(maxVal * 0.4));

    const option = {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const xIdx = params.value[0];
          const yIdx = params.value[1];
          const val = params.value[3];
          const spName = yCats[yIdx];
          return `<div style="font-family:Inter,sans-serif;padding:4px 8px"><div style="font-weight:700;font-size:13px">${spName}</div><div style="font-size:12px;color:#666;margin-top:4px">Hour: <strong>${hourLabels[xIdx]}</strong></div><div style="font-size:12px;color:#666;margin-top:2px">Detections: <strong style="color:#0284c7">${val} calls</strong></div></div>`;
        }
      },
      grid: { top: '5%', left: '22%', right: '4%', bottom: 80, containLabel: false },
      xAxis: {
        type: 'category' as const,
        data: hourLabels,
        axisLabel: { interval: 0, fontSize: 9, color: '#475569' },
        splitArea: { show: true }
      },
      yAxis: {
        type: 'category' as const,
        data: yCats,
        axisLabel: { fontSize: 10, color: '#334155', fontWeight: 600 },
        splitArea: { show: true }
      },
      visualMap: {
        min: 0,
        max: maxColorVal,
        calculable: true,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 5,
        inRange: {
          color: ['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0c4a6e', '#082f49']
        },
        textStyle: { color: '#475569', fontSize: 10 },
        formatter: (value: number) => useLogScale ? value.toFixed(1) : Math.round(value).toString(),
        text: [useLogScale ? 'log(Detections + 1)' : 'Detections', '']
      },
      series: [{
        name: 'Detections',
        type: 'heatmap' as const,
        data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    };

    return {
      matrixOption: option,
      matrixHeight: `${Math.max(300, yCats.length * 24 + 100)}px`,
      yCount: yCats.length
    };
  }, [detections, matrixSearch, matrixTopN, matrixSort, useLogScale, hourLabels]);

  const downloadCSV = () => {
    // Re-compute the displayed matrix data for CSV
    const bySp: Record<string, number[]> = {};
    detections.forEach((d: any) => {
      const sp = d.common_name || 'Unknown';
      if (!d.time || sp.toLowerCase() === 'nocall' || sp === 'Unknown') return;
      const h = parseInt(d.time.split(':')[0], 10);
      if (isNaN(h) || h < 0 || h >= 24) return;
      if (!bySp[sp]) bySp[sp] = Array(24).fill(0);
      bySp[sp][h]++;
    });

    const totals = Object.entries(bySp).map(([name, counts]) => ({
      name,
      total: counts.reduce((a, b) => a + b, 0),
      counts
    }));
    let filtered = totals.filter(item => item.name.toLowerCase().includes(matrixSearch.toLowerCase()));
    if (matrixSort === 'detections') filtered.sort((a, b) => b.total - a.total);
    else filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (matrixTopN !== 'All') filtered = filtered.slice(0, parseInt(matrixTopN, 10));

    const header = ['Species', ...hourLabels].join(',');
    const rows = filtered.map(sp => [sp.name, ...sp.counts].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'species_hour_matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4 text-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-600" /> Species Detection Matrix by Hour of Day
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">24-hour diurnal call counts for each detected species.</p>
        </div>
        <button
          onClick={downloadCSV}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold flex items-center gap-1.5 transition self-start md:self-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download CSV
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={matrixSearch}
            onChange={(e) => setMatrixSearch(e.target.value)}
            placeholder="Search species..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={matrixTopN}
          onChange={(e) => setMatrixTopN(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
        >
          <option value="15">Top 15 Species</option>
          <option value="25">Top 25 Species</option>
          <option value="50">Top 50 Species</option>
          <option value="All">All Species</option>
        </select>

        <select
          value={matrixSort}
          onChange={(e) => setMatrixSort(e.target.value as any)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
        >
          <option value="detections">Sort by Detections</option>
          <option value="alphabetical">Sort Alphabetically</option>
        </select>

        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setUseLogScale(false)}
            className={`px-3 py-2.5 font-extrabold text-[11px] transition ${!useLogScale ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            Linear
          </button>
          <button
            onClick={() => setUseLogScale(true)}
            className={`px-3 py-2.5 font-extrabold text-[11px] transition ${useLogScale ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            Log ln(x+1)
          </button>
        </div>
      </div>

      {yCount === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="text-[11px] text-slate-500 font-medium">No species match the current filter.</div>
        </div>
      ) : (
        <div className="overflow-x-auto w-full border border-slate-200 rounded-xl">
          <div style={{ minWidth: '800px', padding: '0.75rem 0' }}>
            <ReactECharts option={matrixOption} style={{ height: matrixHeight, width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
}
