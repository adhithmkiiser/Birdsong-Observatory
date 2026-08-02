'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const stages = [
  {
    title: 'Study Design',
    body: 'We work with conservation teams to design statistically robust acoustic monitoring plans: site selection, recorder spacing, temporal sampling, and target species.',
  },
  {
    title: 'Data Collection',
    body: 'Field teams deploy autonomous PAM recorders or BirdNET-Pi live nodes. Audio, metadata, and telemetry stream or batch into the cloud.',
  },
  {
    title: 'Analysis',
    body: 'Bioacoustic AI classifies vocalizations, filters false positives, and links detections to species, sites, and environmental covariates.',
  },
  {
    title: 'Graphical Insights',
    body: 'Interactive dashboards translate thousands of detections into species accumulation curves, diversity indices, and temporal activity patterns.',
  },
  {
    title: 'Reporting',
    body: 'We deliver technical reports with annotated spectrograms, photos, maps, and conservation recommendations for funders and regulators.',
  },
];

const fixedBgImage = 'https://images.unsplash.com/photo-1441974231531-c6227db76b84?auto=format&fit=crop&w=1920&q=80';

export default function WhatWeProvide() {
  const [active, setActive] = useState(0);
  const triggerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'));
            setActive(idx);
          }
        });
      },
      {
        threshold: 0.5,
      }
    );

    triggerRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-[500vh] bg-slate-950">
      
      {/* Sticky Frame - Holds background and horizontal slides */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center">
        
        {/* Persistent Background Image */}
        <div className="absolute inset-0 w-full h-full -z-10 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1600&q=80"
            alt="Aerial forest canopy"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/90" />
        </div>

        {/* Horizontal Sliding Track - Animates between slides with a smooth pause/snap */}
        <motion.div 
          animate={{ x: `-${active * 100}vw` }}
          transition={{ type: 'tween', ease: 'easeInOut', duration: 0.65 }}
          className="flex w-[500%] h-full items-center"
        >
          {stages.map((stage, idx) => (
            <div 
              key={idx} 
              className="w-screen h-full flex-shrink-0 flex items-center justify-center px-6 md:px-16"
            >
              <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                
                {/* Left Column: Stage Text Content */}
                <div className="space-y-6 text-left">
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">
                      What We Provide
                    </span>
                    <div className="w-16 h-px bg-white/20" />
                    <span className="text-[11px] font-black text-white/40 tabular-nums">
                      {String(idx + 1).padStart(2, '0')} / {String(stages.length).padStart(2, '0')}
                    </span>
                  </div>

                  <span className="block text-6xl md:text-8xl font-black text-white/10 leading-none">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  
                  <h3 className="font-sans text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.05]">
                    {stage.title}
                  </h3>
                  
                  <p className="text-base md:text-lg text-slate-200 font-medium leading-relaxed max-w-lg">
                    {stage.body}
                  </p>

                  {/* Progress Indicators */}
                  <div className="flex items-center gap-2 pt-4">
                    {stages.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === idx ? 'w-8 bg-emerald-400' : 'w-1.5 bg-white/25'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Right Column: Visual Component Card in Cream Style */}
                <div className="relative h-[26rem] md:h-[32rem] rounded-[32px] bg-[#F5F2EB] border border-emerald-900/10 p-8 flex items-center justify-center overflow-hidden shadow-xl">
                  <StageVisuals index={idx} />
                </div>

              </div>
            </div>
          ))}
        </motion.div>

      </div>

      {/* Invisible triggers layered vertically to drive active state transitions during scroll */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        {stages.map((_, i) => (
          <div
            key={i}
            ref={(el) => { triggerRefs.current[i] = el; }}
            data-index={i}
            className="h-screen w-full"
          />
        ))}
      </div>

    </div>
  );
}

function StageVisuals({ index }: { index: number }) {
  if (index === 0) {
    // Study Design: Map with recorders appearing one by one
    const loop = { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const };

    const pinPositions = [
      { x: 50, y: 95, delay: 0.0 },
      { x: 105, y: 110, delay: 0.1 },
    ];

    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-80 h-80" fill="none" xmlns="http://www.w3.org/2000/svg">

          {/* Folded faded-yellow map */}
          <g>
            {/* Map base */}
            <path
              d="M 40 60 L 80 45 L 120 60 L 160 45 L 160 125 L 120 140 L 80 125 L 40 140 Z"
              fill="#F7E7A3"
              stroke="#0F3A20"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Fold lines */}
            <line x1="80" y1="45" x2="80" y2="125" stroke="rgba(15,58,32,0.15)" strokeWidth="1.5" />
            <line x1="120" y1="60" x2="120" y2="140" stroke="rgba(15,58,32,0.15)" strokeWidth="1.5" />

            {/* Gray hills */}
            <path d="M 55 75 L 75 50 L 95 75 Z" fill="#94A3B8" stroke="#0F3A20" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 75 75 L 100 45 L 125 75 Z" fill="#CBD5E1" stroke="#0F3A20" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Blue pond */}
            <ellipse cx="100" cy="120" rx="14" ry="8" fill="#60A5FA" stroke="#0F3A20" strokeWidth="1.5" />

            {/* Trees in blank spaces */}
            {[
              { x: 55, y: 125 },
              { x: 55, y: 110 },
              { x: 130, y: 100 },
              { x: 140, y: 125 },
              { x: 145, y: 60 },
            ].map((pos, i) => (
              <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                <line x1="0" y1="0" x2="0" y2="6" stroke="#0F3A20" strokeWidth="1.5" />
                <path d="M -7 0 L 0 -12 L 7 0 Z" fill="#10B981" stroke="#0F3A20" strokeWidth="1.5" strokeLinejoin="round" />
              </g>
            ))}
          </g>

          {/* Recorder pins appearing one by one */}
          {pinPositions.map((pin) => {
            const appear = 0.1 + pin.delay;
            const settle = appear + 0.05;
            const leave = 0.7;
            const gone = 0.75;
            return (
              <motion.g
                key={`${pin.x}-${pin.y}`}
                initial={{ x: pin.x, y: pin.y - 20, opacity: 0 }}
                animate={{
                  x: pin.x,
                  y: [pin.y - 20, pin.y - 20, pin.y, pin.y, pin.y - 20, pin.y - 20],
                  opacity: [0, 0, 1, 1, 0, 0],
                }}
                transition={{
                  ...loop,
                  ease: 'backOut' as const,
                  times: [0, appear, settle, leave, gone, 1],
                }}
              >
                <path
                  d="M 0 0 C -5 -8 -12 -16 -12 -24 C -12 -34 -7 -40 0 -40 C 7 -40 12 -34 12 -24 C 12 -16 5 -8 0 0 Z"
                  fill="#DC2626"
                  stroke="#0F3A20"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <circle cx="0" cy="-24" r="4" fill="#FFFFFF" stroke="#0F3A20" strokeWidth="1.5" />
              </motion.g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (index === 1) {
    // Data Collection: Custom geometric origami bird emitting waves to a curved rectangular recorder (wider layout)
    const loopTransition = {
      duration: 5,
      repeat: Infinity,
      ease: "linear" as const,
    };

    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-80 h-80" fill="none" xmlns="http://www.w3.org/2000/svg">

          {/* Green origami bird on the Left */}
          <g transform="translate(4, 28) scale(0.2)">
            <polygon points="66,79 315,273 185,352" fill="#7ed492" stroke="#0F3A20" strokeWidth="3" strokeLinejoin="round" />
            <polygon points="319,191 403,235 315,244" fill="#4fa862" stroke="#0F3A20" strokeWidth="3" strokeLinejoin="round" />
            <polygon points="39,440 319,191 315,273" fill="#245530" stroke="#0F3A20" strokeWidth="3" strokeLinejoin="round" />
            <polygon points="315,273 194,345 118,40" fill="#2f6b3c" stroke="#0F3A20" strokeWidth="3" strokeLinejoin="round" />
          </g>

          {/* Sound Wave Ripples (Emerging from beak at x=85, y=78 and traveling to x=150) */}
          <g>
            {/* Arc 1 */}
            <motion.path
              d="M 90 72 A 8 8 0 0 1 90 84"
              animate={{
                x: [0, 65],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                times: [0, 0.08, 0.32, 0.36],
                ease: "linear",
              }}
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Arc 2 */}
            <motion.path
              d="M 95 67 A 14 14 0 0 1 95 89"
              animate={{
                x: [0, 65],
                opacity: [0, 0, 1, 1, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                times: [0, 0.06, 0.14, 0.38, 0.42],
                ease: "linear",
              }}
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Arc 3 */}
            <motion.path
              d="M 100 62 A 20 20 0 0 1 100 94"
              animate={{
                x: [0, 65],
                opacity: [0, 0, 1, 1, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                times: [0, 0.12, 0.2, 0.44, 0.48],
                ease: "linear",
              }}
              stroke="#10B981"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>

          {/* PAM (Passive Acoustic Monitoring) Field Recorder (Right side, wider spacing at x=150) */}
          <g>
            {/* Top strap mounting loop */}
            <rect x="164" y="48" width="14" height="10" rx="3" fill="none" stroke="#0F3A20" strokeWidth="2.5" />

            {/* Weatherproof outer casing */}
            <rect x="148" y="56" width="46" height="86" rx="8" fill="#DCD4B8" stroke="#0F3A20" strokeWidth="2.5" />

            {/* Corner screws */}
            <circle cx="154" cy="62" r="1.8" fill="#0F3A20" />
            <circle cx="188" cy="62" r="1.8" fill="#0F3A20" />
            <circle cx="154" cy="136" r="1.8" fill="#0F3A20" />
            <circle cx="188" cy="136" r="1.8" fill="#0F3A20" />

            {/* Circular microphone grille */}
            <circle cx="171" cy="82" r="15" fill="#F5F2EB" stroke="#0F3A20" strokeWidth="2" />
            <circle cx="171" cy="82" r="11" fill="none" stroke="#0F3A20" strokeWidth="1" />
            <circle cx="171" cy="82" r="7" fill="none" stroke="#0F3A20" strokeWidth="1" />
            {/* Mic grille dot pattern */}
            {[-6, 0, 6].flatMap((dx) =>
              [-6, 0, 6].map((dy) => (
                <circle key={`${dx}-${dy}`} cx={171 + dx} cy={82 + dy} r="1" fill="#0F3A20" />
              ))
            )}

            {/* Side vent slats */}
            <line x1="152" y1="102" x2="158" y2="102" stroke="#0F3A20" strokeWidth="1.5" />
            <line x1="152" y1="106" x2="158" y2="106" stroke="#0F3A20" strokeWidth="1.5" />
            <line x1="152" y1="110" x2="158" y2="110" stroke="#0F3A20" strokeWidth="1.5" />
            <line x1="184" y1="102" x2="190" y2="102" stroke="#0F3A20" strokeWidth="1.5" />
            <line x1="184" y1="106" x2="190" y2="106" stroke="#0F3A20" strokeWidth="1.5" />
            <line x1="184" y1="110" x2="190" y2="110" stroke="#0F3A20" strokeWidth="1.5" />

            {/* Status LED, blinks green when the bird call wave arrives */}
            <motion.rect
              x="165"
              y="119"
              width="12"
              height="8"
              rx="3"
              animate={{
                fill: ['#94A3B8', '#94A3B8', '#10B981', '#10B981', '#94A3B8', '#94A3B8'],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                times: [0, 0.32, 0.36, 0.84, 0.92, 1.0],
                ease: 'linear',
              }}
              stroke="#0F3A20"
              strokeWidth="1"
            />

            {/* Bottom strap mounting loop */}
            <rect x="164" y="140" width="14" height="10" rx="3" fill="none" stroke="#0F3A20" strokeWidth="2.5" />
          </g>
        </svg>
      </div>
    );
  }

  if (index === 2) {
    // Analysis: Magnifying glass scanning over equalizer-style dancing vertical soundwave bars
    const barsX = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180];
    const baseHeights = [20, 35, 50, 45, 30, 65, 75, 40, 30, 50, 80, 65, 40, 55, 70, 45, 20];

    // Generate cyclic offset height keyframes for each bar
    const getBarKeyframes = (i: number, baseH: number) => {
      const factors = [0.4, 1.1, 0.6, 1.3, 0.5, 0.9, 0.4];
      const y1 = factors.map(f => 110 - (baseH * f) / 2);
      const y2 = factors.map(f => 110 + (baseH * f) / 2);
      const shift = i % factors.length;
      return {
        y1: [...y1.slice(shift), ...y1.slice(0, shift)],
        y2: [...y2.slice(shift), ...y2.slice(0, shift)]
      };
    };

    // Glass scanning transition (scans back and forth horizontally)
    const scanTransition = {
      duration: 6,
      repeat: Infinity,
      repeatType: "mirror" as const,
      ease: "easeInOut",
    };

    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-80 h-80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Dynamic Clip Path: moving circular mask for the magnifying glass lens (direct attribute animation) */}
            <clipPath id="magnifyClip">
              <motion.circle
                r="28"
                animate={{
                  cx: [50, 150],
                  cy: [110, 122, 98, 122, 98, 110]
                }}
                transition={scanTransition}
              />
            </clipPath>
          </defs>


          {/* Background Equalizer Waveform Bars (thin, semi-transparent forest green) */}
          {barsX.map((x, i) => {
            const keyframes = getBarKeyframes(i, baseHeights[i]);
            return (
              <motion.line
                key={`bg-bar-${i}`}
                x1={x}
                y1={keyframes.y1[0]}
                x2={x}
                y2={keyframes.y2[0]}
                animate={{
                  y1: keyframes.y1,
                  y2: keyframes.y2,
                }}
                transition={{
                  duration: 2.0,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                stroke="rgba(15, 58, 32, 0.25)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* Highlighted Equalizer Waveform Bars (thick, bright emerald, visible inside magnifying glass only) */}
          <g clipPath="url(#magnifyClip)">
            {barsX.map((x, i) => {
              const keyframes = getBarKeyframes(i, baseHeights[i]);
              return (
                <motion.line
                  key={`fg-bar-${i}`}
                  x1={x}
                  y1={keyframes.y1[0]}
                  x2={x}
                  y2={keyframes.y2[0]}
                  animate={{
                    y1: keyframes.y1,
                    y2: keyframes.y2,
                  }}
                  transition={{
                    duration: 2.0,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  stroke="#10B981"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              );
            })}
          </g>

          {/* Scanning Magnifying Glass components (following same scan transition with direct attributes) */}
          <g>
            {/* Handle shadow/outline */}
            <motion.line
              animate={{
                x1: [70, 170],
                y1: [130, 142, 118, 142, 118, 130],
                x2: [105, 205],
                y2: [165, 177, 153, 177, 153, 165]
              }}
              transition={scanTransition}
              stroke="#0F3A20"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Outer frame */}
            <motion.circle
              r="32"
              animate={{
                cx: [50, 150],
                cy: [110, 122, 98, 122, 98, 110]
              }}
              transition={scanTransition}
              stroke="#0F3A20"
              strokeWidth="3.5"
              fill="rgba(16, 185, 129, 0.04)"
            />
            {/* Inner lens border reflection */}
            <motion.circle
              r="28"
              animate={{
                cx: [50, 150],
                cy: [110, 122, 98, 122, 98, 110]
              }}
              transition={scanTransition}
              stroke="rgba(15, 58, 32, 0.15)"
              strokeWidth="1"
            />
          </g>
        </svg>
      </div>
    );
  }

  if (index === 3) {
    // Graphical Insights: Multi-stage line chart animation with scattered points, active bouncing, staggered lock-in, and late line connection (uniform speed)
    const dotX = [20, 46.67, 73.33, 100, 126.67, 153.33, 180];
    const scatteredY = [110, 100, 60, 120, 105, 45, 40];
    const chartY = [135, 122, 118, 85, 100, 98, 65];
    const baselineY = 160;

    // Generate 96 uniform samples from 0.0s to 9.5s with exactly 0.1s steps
    // This ensures a 100% constant, uniform speed throughout the loop
    const timeSamples: number[] = [];
    for (let t = 0; t <= 9.5; t += 0.1) {
      timeSamples.push(Math.round(t * 10) / 10);
    }

    const getFinalSequenceY = (i: number, t: number) => {
      // 0.0s - 1.0s: Baseline y = 160
      if (t <= 1.0) return baselineY;
      
      // 9.0s - 9.5s: Reset back to baselineY
      if (t >= 9.0) {
        const ratio = (t - 9.0) / 0.5;
        return chartY[i] + (baselineY - chartY[i]) * ratio;
      }

      // Active bouncing calculation (deterministic simulation of random bouncing above baseline)
      const bounceY = baselineY - Math.abs(40 + 50 * Math.sin(4.5 * t + i * 1.7) * Math.sin(2.8 * t - i * 0.9));

      // 1.0s - 2.5s: Transition from baseline to bouncing state
      if (t > 1.0 && t < 2.5) {
        const ratio = (t - 1.0) / 1.5;
        return baselineY + (bounceY - baselineY) * ratio;
      }

      // 2.5s - 5.5s: Staggered settle (locked in one-by-one, others continue to bounce)
      const settleTime = 2.5 + i * 0.5;
      if (t >= 2.5 && t < 5.5) {
        if (t >= settleTime) return chartY[i];
        return bounceY;
      }

      // 5.5s onwards: all points are settled at chartY
      return chartY[i];
    };

    // Generate keyframes for each dot
    const dotKeyframes = dotX.map((_, i) => {
      return timeSamples.map(t => getFinalSequenceY(i, t));
    });

    const linePaths: string[] = [];
    const areaPaths: string[] = [];
    const areaOpacities: number[] = [];
    const lineOpacities: number[] = [];

    for (let step = 0; step < timeSamples.length; step++) {
      const t = timeSamples[step];
      const stepY = dotX.map((_, i) => dotKeyframes[i][step]);
      
      const pathStr = stepY.reduce((acc, y, i) => {
        return acc + (i === 0 ? `M ${dotX[i]} ${y}` : ` L ${dotX[i]} ${y}`);
      }, "");
      linePaths.push(pathStr);

      const areaPathStr = pathStr + ` L 180 160 L 20 160 Z`;
      areaPaths.push(areaPathStr);

      // Line and area are hidden (opacity = 0) until all points settle at their final positions (t < 5.5).
      // They fade in between 5.5s and 7.0s, then hold complete (for 2 seconds: 7.0s to 9.0s), then reset to 0.
      const isMovingOrScattered = t <= 5.5;
      const isFullChart = t >= 7.0 && t <= 9.0;
      const isReset = t >= 9.0;

      // Line connecting fade in
      if (isMovingOrScattered || isReset) {
        lineOpacities.push(0);
      } else if (isFullChart) {
        lineOpacities.push(1);
      } else {
        // Fade in: t goes from 5.5 to 7.0
        const ratio = (t - 5.5) / 1.5;
        lineOpacities.push(ratio);
      }

      // Area fill fade in (starts slightly after line connects)
      if (t <= 6.0 || isReset) {
        areaOpacities.push(0);
      } else if (isFullChart) {
        areaOpacities.push(1);
      } else {
        // Fade in: t goes from 6.0 to 7.0
        const ratio = (t - 6.0) / 1.0;
        areaOpacities.push(ratio);
      }
    }

    const times = timeSamples.map(t => t / 9.5);
    const duration = 13;
    const loopTransition = {
      duration,
      ease: "linear",
      times,
      repeat: Infinity,
      repeatType: "loop" as const,
    };

    const blueTeal = "#0F4C5C";

    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-80 h-80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={blueTeal} stopOpacity="0.4" />
              <stop offset="100%" stopColor={blueTeal} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <motion.path
            d={areaPaths[0]}
            animate={{
              d: areaPaths,
              opacity: areaOpacities,
            }}
            transition={loopTransition}
            fill="url(#chartGradient)"
          />

          {/* Connecting Line */}
          <motion.path
            d={linePaths[0]}
            animate={{
              d: linePaths,
              opacity: lineOpacities,
            }}
            transition={loopTransition}
            stroke={blueTeal}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Animated Dots */}
          {dotX.map((x, i) => (
            <motion.circle
              key={i}
              cx={x}
              animate={{
                cy: dotKeyframes[i],
                opacity: timeSamples.map(t => (t >= 9.5 ? 0 : 1)),
              }}
              transition={loopTransition}
              r="5.5"
              fill={blueTeal}
            />
          ))}
        </svg>
      </div>
    );
  }

  if (index === 4) {
    // Reporting: Enlarged report sheet (larger scale) with dynamic moving line graph and expanding text lines (no green arrow)
    const lineTransition = {
      duration: 3,
      repeat: Infinity,
      repeatType: "reverse" as const,
      ease: "easeInOut",
    };

    const graphTransition = {
      duration: 5,
      repeat: Infinity,
      repeatType: "mirror" as const,
      ease: "easeInOut",
    };

    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-80 h-80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="reportGraphGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>


          {/* Report Sheet (Enlarged to 140x180) */}
          <rect x="30" y="10" width="140" height="180" rx="6" fill="#FFFFFF" stroke="#0F3A20" strokeWidth="2.5" />
          
          {/* Top header layout */}
          <rect x="42" y="25" width="60" height="8" rx="2" fill="#0F3A20" />
          
          {/* Graph box container inside report */}
          <rect x="42" y="42" width="116" height="60" rx="4" fill="#F5F2EB" stroke="#0F3A20" strokeWidth="1.5" />

          {/* Moving Line Graph - Area Fill */}
          <motion.path
            d="M 46 100 L 46 85 L 62 70 L 82 90 L 102 55 L 122 75 L 142 65 L 154 80 L 154 100 Z"
            animate={{
              d: [
                "M 46 100 L 46 85 L 62 70 L 82 90 L 102 55 L 122 75 L 142 65 L 154 80 L 154 100 Z",
                "M 46 100 L 46 75 L 62 85 L 82 60 L 102 80 L 122 55 L 142 70 L 154 65 L 154 100 Z",
                "M 46 100 L 46 80 L 62 65 L 82 75 L 102 70 L 122 85 L 142 60 L 154 75 L 154 100 Z"
              ]
            }}
            transition={graphTransition}
            fill="url(#reportGraphGradient)"
          />

          {/* Moving Line Graph - Stroke Line */}
          <motion.path
            d="M 46 85 L 62 70 L 82 90 L 102 55 L 122 75 L 142 65 L 154 80"
            animate={{
              d: [
                "M 46 85 L 62 70 L 82 90 L 102 55 L 122 75 L 142 65 L 154 80",
                "M 46 75 L 62 85 L 82 60 L 102 80 L 122 55 L 142 70 L 154 65",
                "M 46 80 L 62 65 L 82 75 L 102 70 L 122 85 L 142 60 L 154 75"
              ]
            }}
            transition={graphTransition}
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Text lines beneath graph (animating width with stable left side, straight and parallel) */}
          <motion.line
            x1="42"
            y1="117"
            y2="117"
            x2="158"
            animate={{ x2: [120, 158, 100, 140, 120] }}
            transition={{ ...lineTransition, delay: 0.1 }}
            stroke="#0F3A20"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <motion.line
            x1="42"
            y1="131"
            y2="131"
            x2="150"
            animate={{ x2: [140, 90, 150, 110, 140] }}
            transition={{ ...lineTransition, delay: 0.3 }}
            stroke="#0F3A20"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <motion.line
            x1="42"
            y1="145"
            y2="145"
            x2="158"
            animate={{ x2: [100, 150, 110, 140, 100] }}
            transition={{ ...lineTransition, delay: 0.5 }}
            stroke="#0F3A20"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <motion.line
            x1="42"
            y1="159"
            y2="159"
            x2="140"
            animate={{ x2: [140, 110, 150, 95, 140] }}
            transition={{ ...lineTransition, delay: 0.7 }}
            stroke="#0F3A20"
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Little handwritten check mark */}
          <path d="M 140 28 L 144 33 L 153 23" stroke="#10B981" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return null;
}
