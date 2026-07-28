'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Cpu, Radio, Sparkles, Layers, Activity } from 'lucide-react';

// Dynamically import SatelliteMap component with ssr: false
const SatelliteMap = dynamic(() => import('@/components/map/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-[24px] bg-slate-100 border border-slate-200 flex flex-col items-center justify-center space-y-3 text-slate-500 animate-pulse">
      <MapPin className="w-8 h-8 text-indigo-600 animate-bounce" />
      <div className="font-extrabold text-xs">Loading High-Resolution Satellite Map...</div>
    </div>
  )
});

export default function MapPage() {
  return (
    <div className="space-y-6 pb-12 pt-2 max-w-6xl mx-auto px-4 md:px-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">GIS Satellite Field Station Network</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Interactive high-resolution satellite imagery map showing deployed acoustic recorder nodes across canopy and reserve habitats.
          </p>
        </div>
      </div>

      {/* Framed Curved-Edge Box Container for Satellite Map */}
      <div className="mt-6 mb-8">
        <SatelliteMap />
      </div>
    </div>
  );
}
