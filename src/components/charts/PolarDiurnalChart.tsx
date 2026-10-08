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
      formatter: (params: any) => `<div style="font-family:Inter,sans-serif;padding:2px 4px"><span style="font-weight:600">${params.name}:</span> <strong style="color:#1f4d3a">${params.value} calls</strong></div>`
    },
    angleAxis: {
      type: 'category',
      data: hoursLabels,
      startAngle: 90,
      clockwise: true,
      axisLine: { lineStyle: { color: '#dde1dc' } },
      axisLabel: { color: '#5a635d', fontSize: 10, fontWeight: 600 }
    },
    radiusAxis: {
      min: 0,
      axisLine: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: '#f0f4f1' } }
    },
    polar: {
      radius: '72%'
    },
    series: [
      {
        type: 'bar',
        data: values.map((val, idx) => ({
          value: val,
          name: hoursLabels[idx],
          itemStyle: {
            color: val > 0 ? '#1f4d3a' : 'transparent',
            borderRadius: [4, 4, 0, 0]
          }
        })),
        coordinateSystem: 'polar',
        name: 'Detections'
      }
    ]
  };

  return (
    <div className="w-full flex flex-col items-center font-sans space-y-3">
      <div className="w-full h-[320px]">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
      <div className="text-xs font-mono font-semibold text-[#1f4d3a] bg-[#f0f7f3] px-3.5 py-1.5 rounded-lg border border-[#dde1dc]">
        Total Detections: <span className="font-bold font-mono text-sm ml-1 text-[#1f4d3a]">{totalDetections.toLocaleString()}</span>
      </div>
    </div>
  );
}
