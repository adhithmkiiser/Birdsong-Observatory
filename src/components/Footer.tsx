import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full bg-[#ffffff] text-[#1a1f1c] py-12 border-t border-[#dde1dc]">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="font-serif font-semibold text-lg text-[#1a1f1c]">
              Birdsong Observatory
            </div>
            <p className="text-xs text-[#5a635d]">
              Bird Ecology Lab &bull; Department of Biology &bull; Indian Institute of Science Education and Research Tirupati
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-[#5a635d]">
            <Link href="/" className="hover:text-[#1f4d3a] transition-colors">Home</Link>
            <Link href="/#projects" className="hover:text-[#1f4d3a] transition-colors">Projects</Link>
            <Link href="/#method" className="hover:text-[#1f4d3a] transition-colors">Method</Link>
            <Link href="/about" className="hover:text-[#1f4d3a] transition-colors">About</Link>
            <a href="https://www.skyisland.in/" target="_blank" rel="noopener noreferrer" className="hover:text-[#1f4d3a] transition-colors">
              Sky Island Lab &rarr;
            </a>
          </div>
        </div>

        <div className="pt-6 border-t border-[#dde1dc] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-[#5a635d] font-mono">
          <div>
            &copy; {new Date().getFullYear()} Bird Ecology Lab, IISER Tirupati. Open research data.
          </div>
          <div>
            Contact: <a href="mailto:adhithmk@labs.iisertirupati.ac.in" className="text-link">adhithmk@labs.iisertirupati.ac.in</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
