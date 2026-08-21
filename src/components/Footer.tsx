import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12 px-6 mt-16 rounded-t-3xl border-t border-slate-900">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-1 items-center md:items-start">
          <h4 className="text-white font-black text-lg tracking-tight">Birdsong Observatory</h4>
          <p className="text-xs font-medium">IISER Tirupati Bird Lab</p>
        </div>
        
        <div className="flex items-center gap-6 text-sm font-semibold">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/about" className="hover:text-white transition">About</Link>
          <Link href="/dashboard" className="hover:text-emerald-400 transition">Dashboard</Link>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-slate-800 text-center text-xs">
        &copy; {new Date().getFullYear()} Birdsong Observatory. All rights reserved.
      </div>
    </footer>
  );
}
