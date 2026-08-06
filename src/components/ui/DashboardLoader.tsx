'use client';

import React from 'react';

export default function DashboardLoader({ message = 'Loading dashboard...', progress }: { message?: string, progress?: number }) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-emerald-600 animate-spin" />
      <h1 className="mt-6 text-[13px] font-bold tracking-[0.2em] uppercase text-slate-900">
        Birdsong Observatory
      </h1>
      <p className="mt-2 text-[11px] text-slate-400 font-medium tracking-wide">
        {message}
      </p>
      
      {progress !== undefined && (
        <div className="mt-6 w-64">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Loading...</span>
            <span className="text-[10px] font-bold text-emerald-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
