'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  className?: string;
  position?: 'top' | 'bottom';
}

/**
 * Reusable InfoTooltip component displaying a clean small question mark in a circle.
 * Shows the explanatory description in a sleek floating tooltip on hover/click.
 */
export function InfoTooltip({ text, className = '', position = 'top' }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span 
      className={`relative inline-flex items-center align-middle group cursor-help ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => { 
        e.stopPropagation(); 
        setIsOpen(prev => !prev); 
      }}
      title={text}
    >
      <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8a9990] hover:text-[#1f4d3a] transition-colors shrink-0" />
      
      {/* Floating tooltip */}
      <span
        role="tooltip"
        className={`absolute pointer-events-none transition-all duration-200 z-[9999] ${
          position === 'top' 
            ? 'bottom-full mb-2 left-0 sm:left-1/2 sm:-translate-x-1/2' 
            : 'top-full mt-2 left-0 sm:left-1/2 sm:-translate-x-1/2'
        } ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        } group-hover:opacity-100 group-hover:scale-100`}
        style={{ minWidth: '220px', maxWidth: '320px', width: 'max-content' }}
      >
        <span className="block bg-[#1a1f1c] text-[#f8fafc] text-[11px] sm:text-xs font-sans font-normal leading-relaxed rounded-lg py-1.5 px-3 shadow-2xl border border-white/10 text-left whitespace-normal break-words">
          {text}
        </span>
        {/* Caret */}
        {position === 'top' ? (
          <span className="block w-2 h-2 bg-[#1a1f1c] rotate-45 border-r border-b border-white/10 absolute left-2 sm:left-1/2 sm:-translate-x-1/2 -bottom-1" />
        ) : (
          <span className="block w-2 h-2 bg-[#1a1f1c] rotate-45 border-l border-t border-white/10 absolute left-2 sm:left-1/2 sm:-translate-x-1/2 -top-1" />
        )}
      </span>
    </span>
  );
}

export default InfoTooltip;
