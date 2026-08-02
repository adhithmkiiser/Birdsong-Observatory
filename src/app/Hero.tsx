'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function HomeHero() {
  const { scrollY } = useScroll();

  // Smooth transforms linked to scroll position
  const yBg = useTransform(scrollY, [0, 800], ['0%', '20%']);
  const opacityText = useTransform(scrollY, [0, 400], [1, 0]);
  const yText = useTransform(scrollY, [0, 400], [0, 40]);

  return (
    <section className="home-hero relative w-full min-h-[90vh] bg-[#081C16] overflow-hidden">
      <div className="grid md:grid-cols-2 min-h-[90vh]">
        {/* Left content */}
        <motion.div 
          style={{ opacity: opacityText, y: yText }}
          className="relative z-10 flex flex-col justify-center px-6 md:px-12 lg:px-20 py-20 md:py-0 bg-[#081C16]"
        >
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Platform Core Active
            </div>
            <h1 className="font-sans text-5xl md:text-7xl font-black tracking-tight leading-[1.05] text-white">
              Birdsong{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Observatory
              </span>
            </h1>
            <p className="text-emerald-400 text-sm md:text-base font-bold tracking-wide">
              IISER Tirupati Bird Ecology &amp; Bioacoustics Lab
            </p>
            <p className="text-slate-300 text-sm md:text-base font-medium leading-relaxed max-w-md">
              A unified cloud analytics platform for landscape-scale avian acoustics. Integrating automated Raspberry Pi field recording nodes with offline passive monitoring (PAM) survey pipelines.
            </p>
            <a
              href="#projects"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-slate-950 font-black text-sm hover:bg-emerald-400 transition w-fit"
            >
              Explore Projects <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </motion.div>

        {/* Right image + overlay */}
        <div className="relative h-[50vh] md:h-auto overflow-hidden">
          <motion.img
            style={{ y: yBg }}
            src="/Image/Hero%20Image.png"
            alt="Aerial forest canopy"
            className="absolute inset-0 w-full h-full object-cover scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#081C16] via-[#081C16]/40 to-transparent md:bg-gradient-to-r md:from-[#081C16] md:via-transparent md:to-transparent" />

        </div>
      </div>
    </section>
  );
}
