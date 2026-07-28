'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 flex items-center justify-center min-h-screen p-6 font-sans">
        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900">System Application Error</h2>
          <p className="text-xs text-slate-500">{error?.message || 'A global error occurred.'}</p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
