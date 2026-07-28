'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-sm max-w-lg mx-auto my-12 space-y-4">
      <h2 className="text-2xl font-black text-slate-900">404 - Page Not Found</h2>
      <p className="text-xs text-slate-500">The page or resource you requested could not be located in the monitoring system.</p>
      <Link
        href="/"
        className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition"
      >
        Return to Dashboard Overview
      </Link>
    </div>
  );
}
