'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled App Router Error:', error);
  }, [error]);

  return (
    <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-sm max-w-lg mx-auto my-12 space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Something went wrong!</h2>
      <p className="text-xs text-slate-500">{error?.message || 'An unexpected error occurred while loading this page.'}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition"
      >
        Try Again
      </button>
    </div>
  );
}
