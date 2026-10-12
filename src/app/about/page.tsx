'use client';

import React from 'react';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export default function AboutPage() {
  return (
    <div className="w-full bg-[#ffffff] text-[#1a1f1c] font-sans">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-16">

        {/* Header */}
        <div className="space-y-2 border-b border-[#dde1dc] pb-6">
          <span className="label-mono">INSTITUTIONAL OVERVIEW</span>
          <h1 className="text-[#1a1f1c] font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
            About the Birdsong Observatory
          </h1>
          <p className="text-[#5a635d] text-base sm:text-lg leading-relaxed max-w-[680px]">
            An initiative of the Bird Ecology Lab at the Indian Institute of Science Education and Research (IISER) Tirupati.
          </p>
        </div>

        {/* 1. Mission */}
        <section className="space-y-4 max-w-[680px]">
          <h2 className="text-[#1a1f1c] font-serif text-2xl font-semibold">
            Mission and scope
          </h2>
          <p className="text-base sm:text-lg leading-[1.611]">
            The Birdsong Observatory develops scalable computational ecology tools for continuous biodiversity monitoring. Rather than treating bioacoustics as an offline academic pursuit, the Observatory operates as an applied ecological platform.
          </p>
          <p className="text-base sm:text-lg leading-[1.611]">
            We partner with state forest departments, conservation non-profits, ecological restoration teams, and land managers to design, deploy, and analyze dense acoustic sensor arrays. Our mission is to generate quantitative, verifiable ecological evidence that directly informs forest restoration strategies, habitat management, and policy decisions.
          </p>
        </section>

        {/* 2. Research Principles */}
        <section className="space-y-6 pt-6 border-t border-[#dde1dc]">
          <h2 className="text-[#1a1f1c] font-serif text-2xl font-semibold">
            Why bioacoustics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <h3 className="font-serif font-semibold text-lg text-[#1a1f1c]">
                Standardized sampling regimes
              </h3>
              <p className="text-sm text-[#5a635d] leading-relaxed">
                Autonomous recording units capture the full soundscape continuously, eliminating subjective inter-observer variation in detection probability.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-serif font-semibold text-lg text-[#1a1f1c]">
                24/7 presence across canopies
              </h3>
              <p className="text-sm text-[#5a635d] leading-relaxed">
                Automated dawn chorus and nocturnal sampling captures cryptic, endangered, and high-canopy taxa that standard manual point counts miss.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-serif font-semibold text-lg text-[#1a1f1c]">
                Auditable scientific records
              </h3>
              <p className="text-sm text-[#5a635d] leading-relaxed">
                Lossless audio recordings act as a permanent natural history record that can be re-analyzed as machine learning taxonomic classifiers evolve.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-serif font-semibold text-lg text-[#1a1f1c]">
                Zero habitat disruption
              </h3>
              <p className="text-sm text-[#5a635d] leading-relaxed">
                Passive acoustic monitoring captures natural vocal behaviors without the stress or disturbance of physical mist netting and transect foot traffic.
              </p>
            </div>
          </div>
        </section>




        {/* 5. Contact & Inquiries */}
        <section className="space-y-4 pt-6 border-t border-[#dde1dc]">
          <h2 className="text-[#1a1f1c] font-serif text-2xl font-semibold">
            Institutional contact and data inquiries
          </h2>
          <div className="p-6 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] space-y-2">
            <p className="text-sm text-[#1a1f1c] leading-relaxed">
              For research collaborations, dataset access requests, please contact:
            </p>
            <div className="font-mono text-sm text-[#1f4d3a] font-semibold">
              <a href="mailto:robin@labs.iisertirupati.ac.in" className="hover:underline">
                robin@labs.iisertirupati.ac.in
              </a>
            </div>
            <div className="text-xs text-[#5a635d] space-y-1">
              <div> Bird Ecology Lab</div>
              <div> Department of Biology</div>
              <div> IISER Tirupati, Andhra Pradesh, India</div>
            </div>
          </div>
        </section>

      </div>

      <Footer />
    </div>
  );
}


