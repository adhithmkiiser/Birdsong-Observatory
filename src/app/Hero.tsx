'use client';

import React from 'react';
import Link from 'next/link';

export default function HomeHero() {
  return (
    <section className="relative w-full bg-[#0a1610] py-6 sm:py-8 border-b border-[#dde1dc]">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Large Prominent Hero Image Container with White/Light Text Overlay */}
        <div className="relative w-full min-h-[480px] sm:min-h-[540px] md:min-h-[580px] rounded-3xl overflow-hidden border border-black/10 shadow-xl flex items-center">
          
          {/* Background Image */}
          <img
            src="/Image/Hero%20Image.png"
            alt="Birdsong Observatory Field Acoustic Monitoring"
            className="absolute inset-0 w-full h-full object-cover object-center transform scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/64789.jpg';
            }}
          />

          {/* Multi-layer Dark Gradient Scrim to ensure crisp light/white font legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          {/* Foreground Text in White/Light Colors */}
          <div className="relative z-10 p-8 sm:p-12 md:p-16 max-w-3xl space-y-6">
            
            {/* Headline in Crisp White with Emerald Accent */}
            <h1 className="text-white font-serif font-semibold text-4xl sm:text-5xl lg:text-[56px] leading-[1.12] tracking-tight">
              Acoustic monitoring for{' '}
              <span className="text-emerald-400 underline decoration-emerald-500/50 decoration-2 underline-offset-8">
                forest biodiversity
              </span>
              .
            </h1>

            {/* 2-Sentence Summary in Light Gray/White */}
            <p className="text-slate-200 text-lg sm:text-xl leading-[1.611] max-w-2xl font-light">
              Continuous passive acoustic sensing and automated species classification across Western Ghats and tropical forest corridors. Quantifying ecosystem health and restoration trajectories through soundscape analytics.
            </p>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center gap-6 font-sans">
              <a
                href="#projects"
                className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] inline-flex items-center gap-2"
              >
                <span>View survey projects</span>
                <span className="text-emerald-200">&rarr;</span>
              </a>

              <a
                href="#method"
                className="text-white hover:text-emerald-300 text-[15px] font-semibold transition-colors inline-flex items-center gap-1.5 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
              >
                <span>How it works</span>
                <span className="text-sm">&rarr;</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
