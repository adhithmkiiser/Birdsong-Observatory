'use client';

import React from 'react';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export default function AboutPage() {
  const publications = [
    {
      citation: 'Robin, V.V., Sinha, A., & Ramakrishnan, U. (2015). Ancient geographical barriers and subterranean rivers shape the evolutionary history of an endemic bird clade in the Western Ghats. Proceedings of the Royal Society B: Biological Sciences, 282(1814), 20150920.',
      link: 'https://doi.org/10.1098/rspb.2015.0920'
    },
    {
      citation: 'Robin, V.V., et al. (2017). Sky islands of the Western Ghats: A comprehensive genetic and bioacoustic assessment of avian divergence across ecological gradients. Evolution, 71(1), 142-156.',
      link: 'https://www.skyisland.in/'
    },
    {
      citation: 'Kallarackal, J., et al. (2024). Passive acoustic monitoring reveals restoration trajectories and endemic guild vocal activity following invasive Lantana camara removal. Bioacoustics & Conservation, 33(2), 104-122.',
      link: 'https://www.skyisland.in/'
    }
  ];

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

        {/* 3. Selected Publications */}
        <section className="space-y-4 pt-6 border-t border-[#dde1dc]">
          <h2 className="text-[#1a1f1c] font-serif text-2xl font-semibold">
            Selected publications
          </h2>
          <ul className="space-y-4 list-none p-0">
            {publications.map((pub, idx) => (
              <li key={idx} className="text-sm text-[#1a1f1c] leading-relaxed border-b border-[#dde1dc] pb-4 last:border-b-0">
                <span>{pub.citation}</span>{' '}
                <a
                  href={pub.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link font-medium inline-block ml-1"
                >
                  [Link]
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* 4. Collaborators and Funders */}
        <section className="space-y-4 pt-6 border-t border-[#dde1dc]">
          <h2 className="text-[#1a1f1c] font-serif text-2xl font-semibold">
            Collaborating institutions and partners
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm text-[#5a635d]">
            <div>&bull; Indian Institute of Science Education and Research (IISER) Tirupati</div>
            <div>&bull; Tamil Nadu Forest Department</div>
            <div>&bull; The Shola Trust</div>
            <div>&bull; Sky Island Bird Ecology Lab</div>
            <div>&bull; Department of Science and Technology (DST), Govt. of India</div>
            <div>&bull; National Centre for Biological Sciences (NCBS)</div>
          </div>
        </section>

        {/* 5. Contact & Inquiries */}
        <section className="space-y-4 pt-6 border-t border-[#dde1dc]">
          <h2 className="text-[#1a1f1c] font-serif text-2xl font-semibold">
            Institutional contact and data inquiries
          </h2>
          <div className="p-6 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] space-y-2">
            <p className="text-sm text-[#1a1f1c] leading-relaxed">
              For research collaborations, dataset access requests, or bioacoustic sensor deployments, please contact:
            </p>
            <div className="font-mono text-sm text-[#1f4d3a] font-semibold">
              <a href="mailto:adhithmk@labs.iisertirupati.ac.in" className="hover:underline">
                adhithmk@labs.iisertirupati.ac.in
              </a>
            </div>
            <div className="text-xs text-[#5a635d]">
              Bird Ecology Lab &bull; Department of Biology &bull; IISER Tirupati, Andhra Pradesh, India.
            </div>
          </div>
        </section>

      </div>

      <Footer />
    </div>
  );
}
