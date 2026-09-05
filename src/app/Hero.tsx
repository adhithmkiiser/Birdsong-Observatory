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
    <section className="home-hero relative w-full min-h-[calc(100dvh-4.5rem)] md:h-[calc(100dvh-4.5rem)] bg-[#081C16] overflow-hidden flex flex-col justify-center">
      <div className="grid md:grid-cols-2 h-full min-h-[calc(100dvh-4.5rem)]">
        {/* Left content */}
        <motion.div
          style={{ opacity: opacityText, y: yText }}
          className="relative z-10 flex flex-col justify-center px-6 sm:px-10 md:px-10 lg:px-16 xl:px-20 py-12 md:py-6 bg-[#081C16]"
        >
          <div className="max-w-lg lg:max-w-xl space-y-4 md:space-y-5 lg:space-y-6">
            <h1 className="font-sans text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-[1.08] text-white">
              Birdsong{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Observatory
              </span>
            </h1>
            <p className="text-emerald-400 text-xs sm:text-sm md:text-base font-bold tracking-wide">
              Bird Ecology Lab, IISER Tirupati
            </p>
            <p className="text-slate-300 text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-md">
              A unified cloud analytics platform for landscape-scale avian acoustics. Integrating automated Raspberry Pi field recording nodes with offline passive monitoring (PAM) survey pipelines.
            </p>
            <a
              href="#projects"
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm hover:bg-emerald-400 transition w-fit shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Explore Projects <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </motion.div>

        {/* Right image + overlay */}
        <div className="relative h-[40vh] md:h-full overflow-hidden">
          <motion.img
            style={{ y: yBg }}
            src="/Image/Hero%20Image.png"
            alt="Aerial forest canopy"
            className="absolute inset-0 w-full h-full object-cover scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#081C16] via-transparent to-transparent md:bg-gradient-to-r md:from-[#081C16] md:via-[#081C16]/20 md:to-transparent" />
        </div>
      </div>
    </section>
  );
}
