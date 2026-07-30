'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface PolarDiurnalChartProps {
  hourlyData: { hour: string; detections: number }[];
  totalDetections: number;
}

export function PolarDiurnalChart({ hourlyData, totalDetections }: PolarDiurnalChartProps) {
  // 24-hour labels matching screenshot: 12am, 1am, ..., 11pm
  const hoursLabels = [
    '12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
     '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'
  ];

  const values = hourlyData.map(d => d.detections);

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => `${params.name}: <strong>${params.value}</strong> detections`
    },
    angleAxis: {
      type: 'category',
      data: hoursLabels,
      startAngle: 90,
      clockwise: true,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#475569', fontSize: 11, fontWeight: 'bold' }
    },
    radiusAxis: {
      min: 0,
      axisLine: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    polar: {
      radius: '70%'
    },
    series: [
      {
        type: 'bar',
        data: values.map((val, idx) => ({
          value: val,
          name: hoursLabels[idx],
          itemStyle: {
            color: val > 0 ? '#2e7d32' : 'transparent',
            borderRadius: [4, 4, 0, 0]
          }
        })),
        coordinateSystem: 'polar',
        name: 'Detections'
      }
    ]
  };

  return (
    <div className="w-full flex flex-col items-center font-sans space-y-2">
      <div className="w-full h-[320px]">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
      <div className="text-xs font-black text-slate-700 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
        Total Detect: <span className="text-emerald-700 font-mono font-black text-sm">{totalDetections}</span>
      </div>
    </div>
  );
}
