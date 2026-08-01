'use client';

import React from 'react';

export default function DashboardLoader({ message = 'Loading dashboard...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-emerald-600 animate-spin" />
      <h1 className="mt-6 text-[13px] font-bold tracking-[0.2em] uppercase text-slate-900">
        Birdsong Observatory
      </h1>
      <p className="mt-2 text-[11px] text-slate-400 font-medium tracking-wide">
        {message}
      </p>
    </div>
  );
}
