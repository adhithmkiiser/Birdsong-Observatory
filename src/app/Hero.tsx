'use client';

import React from 'react';
import Link from 'next/link';

export default function HomeHero() {
  return (
    <section className="relative w-full min-h-[520px] sm:min-h-[580px] md:min-h-[620px] lg:min-h-[660px] xl:min-h-[700px] flex items-center overflow-hidden border-b border-[#1b3d2b] bg-[#07130c]">
      
      {/* 1. Full-Width Background Rainforest Image Filling the Entire Screen Edge-to-Edge */}
      <img
        src="/Image/Hero%20Image.png"
        alt="Birdsong Observatory Field Acoustic Monitoring"
        className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 pointer-events-none select-none"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/64789.jpg';
        }}
      />

      {/* 2. Atmospheric Dark Multi-layer Gradient Scrim for Exceptional White Font Readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/70 to-black/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35" />
      <div className="absolute inset-0 bg-[#07130c]/25 backdrop-blur-[0.5px]" />

      {/* 3. Fluid Responsive Foreground Container Aligned Across All Viewports */}
      <div className="relative z-10 w-full max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-14 sm:py-16 md:py-20 lg:py-24">
        <div className="max-w-3xl xl:max-w-4xl space-y-6 sm:space-y-8">
          
          {/* Institutional / Mission Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-emerald-500/30 backdrop-blur-md text-emerald-300 font-mono text-xs font-semibold tracking-wide shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Passive Acoustic Ecology &bull; Western Ghats</span>
          </div>

          {/* Headline in Crisp White with Emerald Accent */}
          <h1 className="text-white font-serif font-semibold text-3xl sm:text-5xl md:text-6xl lg:text-[62px] xl:text-[68px] leading-[1.12] tracking-tight drop-shadow-sm">
            Acoustic monitoring for{' '}
            <span className="text-emerald-400 underline decoration-emerald-500/60 decoration-2 sm:decoration-[3px] underline-offset-6 sm:underline-offset-8">
              forest biodiversity
            </span>
            .
          </h1>

          {/* 2-Sentence Summary in Light Gray/White */}
          <p className="text-slate-200 text-base sm:text-lg md:text-xl lg:text-2xl leading-[1.6] max-w-2xl font-light drop-shadow-xs">
            Continuous passive acoustic sensing and automated species classification across Western Ghats and tropical forest corridors. Quantifying ecosystem health and restoration trajectories through soundscape analytics.
          </p>

          {/* Responsive Action Buttons (touch-friendly on phone, streamlined on iPad/desktop) */}
          <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5 font-sans">
            <a
              href="#projects"
              className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm sm:text-base shadow-lg shadow-emerald-950/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] inline-flex items-center justify-center gap-2"
            >
              <span>View survey projects</span>
              <span className="text-emerald-200">&rarr;</span>
            </a>

            <a
              href="#method"
              className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white hover:text-emerald-200 font-semibold text-sm sm:text-base transition-all duration-200 backdrop-blur-md border border-white/20 hover:border-white/40 inline-flex items-center justify-center gap-2"
            >
              <span>How it works</span>
              <span className="text-xs sm:text-sm">&rarr;</span>
            </a>
          </div>

        </div>
      </div>

    </section>
  );
}

