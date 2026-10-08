'use client';

import React from 'react';
import { Trees, Sparkles } from 'lucide-react';

interface Partner {
  name: string;
  logo?: string;
  fallbackIcon?: React.ReactNode;
  iconBg?: string;
}

const PARTNERS: Partner[] = [
  {
    name: 'IISER Tirupati',
    logo: '/iiser tpt.png'
  },
  {
    name: 'Tamil Nadu Forest Department',
    logo: '/logo-tn.jpg'
  },
  {
    name: 'The Shola Trust',
    logo: '/The_shola_trust.avif'
  },
  {
    name: 'Karnataka Forest Department',
    fallbackIcon: <Trees className="w-7 h-7 text-[#10b981]" />,
    iconBg: 'bg-[#eaf3ee] border-[#b8dbc8]'
  }
];

export function CollaboratorsMarquee() {
  // Duplicate array 4 times for a smooth continuous infinite marquee loop
  const marqueeItems = [...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS];

  return (
    <section className="w-full bg-gradient-to-b from-[#f8faf8] via-[#ffffff] to-[#f8faf8] py-16 sm:py-20 border-b border-[#dde1dc] overflow-hidden">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="space-y-2 border-b border-[#dde1dc] pb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eaf3ee] border border-[#b8dbc8] text-[11px] font-mono text-[#1f4d3a] font-semibold mb-1">
            <Sparkles className="w-3 h-3 text-[#10b981]" />
            <span>COLLABORATORS &amp; PARTNERS</span>
          </div>
          <h2 className="text-[#1a1f1c] font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
            Institutional research and forest department partners
          </h2>
          <p className="text-[#5a635d] text-sm leading-relaxed max-w-2xl">
            Working in direct partnership with national academic institutes, state forest departments, and ecological restoration trusts across southern India.
          </p>
        </div>
      </div>

      {/* Marquee Track with Left and Right Fade Gradients */}
      <div className="relative w-full overflow-hidden py-2">
        {/* Left Fade Gradient */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-28 sm:w-40 bg-gradient-to-r from-[#f8faf8] via-[#f8faf8]/90 to-transparent z-10" />
        
        {/* Right Fade Gradient */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-28 sm:w-40 bg-gradient-to-l from-[#f8faf8] via-[#f8faf8]/90 to-transparent z-10" />

        {/* Continuous Left-to-Right Moving Marquee Track */}
        <div className="animate-marquee-ltr flex items-center gap-8 py-2">
          {marqueeItems.map((partner, idx) => (
            <div
              key={`${partner.name}-${idx}`}
              className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-white border border-[#dde1dc] flex-shrink-0 hover:border-[#1f4d3a] hover:shadow-md transition-all duration-200 shadow-2xs group cursor-default"
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center p-2 overflow-hidden flex-shrink-0 border ${partner.iconBg || 'bg-white border-[#dde1dc]'}`}>
                {partner.logo ? (
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105 duration-200"
                  />
                ) : (
                  partner.fallbackIcon
                )}
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm sm:text-base text-[#1a1f1c] whitespace-nowrap group-hover:text-[#1f4d3a] transition-colors">
                  {partner.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
