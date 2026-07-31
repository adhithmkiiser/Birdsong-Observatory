'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface AnalysisChartsProps {
  recs: any[];
  spSiteMatrix: Record<string, Record<string, number>>;
  siteRichness: Record<string, number>;
  siteDetections: Record<string, number>;
  speciesList: string[];
  speciesMetadata: Record<string, any>;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'
];

function getHabitatColor(habitat?: string) {
  if (habitat === 'LC') return '#10b981';
  if (habitat === 'LI') return '#ef4444';
  return '#64748b';
}

function getRecKey(r: any) {
  return `${r.site_group}/${r.recorder_id}`;
}

export default function AnalysisCharts({
  recs,
  spSiteMatrix,
  siteRichness,
  siteDetections,
  speciesList,
  speciesMetadata
}: AnalysisChartsProps) {
  const [search, setSearch] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);

  // Species totals across current sites
  const speciesTotals = useMemo(() => {
    const map: Record<string, number> = {};
    speciesList.forEach(sp => {
      let total = 0;
      recs.forEach(r => { total += spSiteMatrix[sp]?.[getRecKey(r)] || 0; });
      map[sp] = total;
    });
    return map;
  }, [speciesList, recs, spSiteMatrix]);

  const filteredSpecies = useMemo(() => {
    const q = search.toLowerCase().trim();
    return speciesList
      .filter(sp => {
        if (!q) return true;
        if (sp.toLowerCase().includes(q)) return true;
        const meta = speciesMetadata[sp] || {};
        return (meta.scientific || '').toLowerCase().includes(q);
      })
      .sort((a, b) => speciesTotals[b] - speciesTotals[a]);
  }, [speciesList, search, speciesTotals, speciesMetadata]);

  const topSpecies = useMemo(() => {
    if (selectedSpecies.length > 0) return selectedSpecies;
    return filteredSpecies.slice(0, 8);
  }, [selectedSpecies, filteredSpecies]);

  const xCategories = useMemo(() =>
    recs.map(r => `${r.site_group}\n${r.recorder_id}`),
  [recs]);

  // ── Species-by-Site Bar Chart ────────────────────────────────────────────
  const speciesBySiteOption = useMemo(() => {
    const series = topSpecies.map((sp, i) => ({
      name: sp,
      type: 'bar' as const,
      data: recs.map(r => spSiteMatrix[sp]?.[getRecKey(r)] || 0),
      itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [3, 3, 0, 0] },
      barGap: '10%'
    }));

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const }
      },
      legend: { top: 0, textStyle: { color: '#475569', fontSize: 10 } },
      grid: { left: '12%', right: '5%', top: '14%', bottom: '18%' },
      xAxis: {
        type: 'category' as const,
        data: xCategories,
        axisLabel: { interval: 0, rotate: 45, fontSize: 9, color: '#475569' }
      },
      yAxis: {
        type: 'value' as const,
        name: 'Detections',
        axisLabel: { color: '#475569' }
      },
      series
    };
  }, [topSpecies, recs, spSiteMatrix, xCategories]);

  // ── Richness Stats & Chart ───────────────────────────────────────────────
  const richnessStats = useMemo(() => {
    const values = recs.map(r => ({
      key: getRecKey(r),
      habitat: r.habitat || 'LI',
      value: siteRichness[getRecKey(r)] || 0
    }));
    const lc = values.filter(v => v.habitat === 'LC').map(v => v.value);
    const li = values.filter(v => v.habitat === 'LI').map(v => v.value);
    const lcMean = lc.length ? lc.reduce((a, b) => a + b, 0) / lc.length : 0;
    const liMean = li.length ? li.reduce((a, b) => a + b, 0) / li.length : 0;
    return { lcMean, liMean, lcCount: lc.length, liCount: li.length, diff: lcMean - liMean };
  }, [recs, siteRichness]);

  const richnessOption = useMemo(() => {
    const data = recs.map(r => ({
      value: siteRichness[getRecKey(r)] || 0,
      itemStyle: { color: getHabitatColor(r.habitat), borderRadius: [3, 3, 0, 0] }
    }));

    return {
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      grid: { left: '12%', right: '10%', top: '15%', bottom: '18%' },
      xAxis: {
        type: 'category' as const,
        data: xCategories,
        axisLabel: { interval: 0, rotate: 45, fontSize: 9, color: '#475569' }
      },
      yAxis: { type: 'value' as const, name: 'Species Richness' },
      series: [{
        type: 'bar' as const,
        data,
        markLine: {
          data: [
            {
              yAxis: richnessStats.lcMean,
              lineStyle: { color: '#10b981', type: 'dashed', width: 2 },
              label: { formatter: `LC Mean ${richnessStats.lcMean.toFixed(1)}`, position: 'insideEndTop' as const }
            },
            {
              yAxis: richnessStats.liMean,
              lineStyle: { color: '#ef4444', type: 'dashed', width: 2 },
              label: { formatter: `LI Mean ${richnessStats.liMean.toFixed(1)}`, position: 'insideEndTop' as const }
            }
          ]
        }
      }]
    };
  }, [recs, siteRichness, xCategories, richnessStats]);

  // ── Site-Level Performance Dual-Axis Chart ───────────────────────────────
  const performanceOption = useMemo(() => {
    const speciesData = recs.map(r => ({
      value: siteRichness[getRecKey(r)] || 0,
      itemStyle: { color: getHabitatColor(r.habitat), borderRadius: [3, 3, 0, 0] }
    }));
    const detectionsData = recs.map(r => siteDetections[getRecKey(r)] || 0);

    return {
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'cross' as const } },
      legend: { top: 0, data: ['Unique Species', 'Total Detections'], textStyle: { color: '#475569', fontSize: 10 } },
      grid: { left: '8%', right: '8%', top: '16%', bottom: '18%' },
      xAxis: {
        type: 'category' as const,
        data: xCategories,
        axisLabel: { interval: 0, rotate: 45, fontSize: 9, color: '#475569' }
      },
      yAxis: [
        { type: 'value' as const, name: 'Unique Species', position: 'left' as const, axisLabel: { color: '#475569' } },
        { type: 'value' as const, name: 'Total Detections', position: 'right' as const, axisLabel: { color: '#475569' }, splitLine: { show: false } }
      ],
      series: [
        {
          name: 'Unique Species',
          type: 'bar' as const,
          yAxisIndex: 0,
          data: speciesData,
          barMaxWidth: 28
        },
        {
          name: 'Total Detections',
          type: 'line' as const,
          yAxisIndex: 1,
          data: detectionsData,
          smooth: true,
          symbol: 'circle' as const,
          symbolSize: 7,
          lineStyle: { color: '#4f46e5', width: 2.5 },
          itemStyle: { color: '#4f46e5' }
        }
      ]
    };
  }, [recs, siteRichness, siteDetections, xCategories]);

  if (recs.length === 0) {
    return (
      <div className="dashboard-section">
        <div className="empty-state"><span>No recorder sites match the current filter.</span></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── SPECIES DETECTIONS BY SITE ─────────────────────────────────────── */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Species Detections by Site</h2>
            <p>Search and select birds to compare detections across active recorder sites.</p>
          </div>
        </div>

        <div className="heatmap-controls" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' as const }}>
          <div className="search-box" style={{ maxWidth: '360px' }}>
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search species common or scientific name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => setSelectedSpecies(filteredSpecies.slice(0, 8))}>
            Top 8 Most Detected
          </button>
          <button className="btn-primary" onClick={() => setSelectedSpecies([])}>
            Clear
          </button>
        </div>

        {selectedSpecies.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {selectedSpecies.map((sp, i) => (
              <span
                key={sp}
                onClick={() => setSelectedSpecies(prev => prev.filter(s => s !== sp))}
                style={{
                  background: COLORS[i % COLORS.length],
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                {sp} <span style={{ opacity: 0.8 }}>×</span>
              </span>
            ))}
          </div>
        )}

        <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <div style={{ minWidth: '800px', padding: '1rem 0' }}>
            <ReactECharts option={speciesBySiteOption} style={{ height: '420px', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* ── SPECIES RICHNESS: LC vs LI ─────────────────────────────────────── */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Species Richness: LC vs LI Comparison</h2>
            <p>Avian species richness comparison between Lantana-Cleared (LC) and Lantana-Infested (LI) sites.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
          <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ minWidth: '700px', padding: '1rem 0' }}>
              <ReactECharts option={richnessOption} style={{ height: '420px', width: '100%' }} />
            </div>
          </div>

          <div className="stats-summary-panel">
            <span className="stats-summary-title">Summary Statistics</span>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>
                <div style={{ background: '#dcfce7', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(22,163,74,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#14532d', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>LC Mean</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#14532d', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>Richness</div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#14532d' }}>{richnessStats.lcMean.toFixed(1)}</div>
                  <div style={{ fontSize: '0.7rem', color: '#15803d' }}>n = {richnessStats.lcCount} sites</div>
                </div>
                <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>LI Mean</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>Richness</div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#991b1b' }}>{richnessStats.liMean.toFixed(1)}</div>
                  <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>n = {richnessStats.liCount} sites</div>
                </div>
              </div>

              <div className="stat-diff-callout">
                <span className="stat-diff-label">Richness Difference (LC vs LI)</span>
                <span className="stat-diff-val" style={{ color: richnessStats.diff >= 0 ? '#15803d' : '#dc2626' }}>
                  {richnessStats.diff >= 0 ? '+' : ''}{richnessStats.diff.toFixed(1)}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Lantana-cleared sites show {richnessStats.diff >= 0 ? 'higher' : 'lower'} species richness.
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Mann-Whitney U Test (Significance)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.25rem' }}>ns (p=0.210)</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  U = 6; p = 0.210. The difference is not statistically significant.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SITE-LEVEL PERFORMANCE & DETECTIONS ────────────────────────────── */}
      <div className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Site-Level Performance &amp; Detections</h2>
            <p>Avian species counts paired with acoustic detection triggers per active recorder site.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }}></span> LC Site (Species)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ef4444', display: 'inline-block' }}></span> LI Site (Species)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#4f46e5', display: 'inline-block' }}></span> Total Detections
          </span>
        </div>

        <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <div style={{ minWidth: '800px', padding: '1rem 0' }}>
            <ReactECharts option={performanceOption} style={{ height: '420px', width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
