'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Bird, Clock, Database, Search, X } from 'lucide-react';
import { useDashboardStore } from '@/lib/store/useDashboardStore';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface DashboardChartsProps {
  p_project_names: string[] | null;
  p_site_name: string;
  p_recorder_name: string;
}

export function DashboardCharts({ p_project_names, p_site_name, p_recorder_name }: DashboardChartsProps) {
  const {
    confidenceThreshold,
    selectedSpecies,
    setSelectedSpecies,
    addSpecies,
    removeSpecies
  } = useDashboardStore();

  const [topSpeciesList, setTopSpeciesList] = useState<string[]>([]);
  const [speciesSearch, setSpeciesSearch] = useState('');
  
  // Data States
  const [trendData, setTrendData] = useState<any[]>([]);
  const [diversityData, setDiversityData] = useState<any[]>([]);
  const [diurnalData, setDiurnalData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [radialDataState, setRadialDataState] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Date selectors for chart drill-downs
  const [diversityYear, setDiversityYear] = useState<string>('');
  const [diversityMonth, setDiversityMonth] = useState<string>('');
  const [diurnalDate, setDiurnalDate] = useState<string>('');
  const [radialDate, setRadialDate] = useState<string>('');

  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#06b6d4', '#f43f5e', '#8b5cf6'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  // 1. Fetch Top Species & Available Dates
  useEffect(() => {
    async function initOptions() {
      const { data: topData } = await supabase.rpc('get_top_species', {
        p_limit: 15, p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold
      });
      if (topData) {
        const names = topData.map((d: any) => d.common_name);
        setTopSpeciesList(names);
        if (selectedSpecies.length === 0 && names.length > 0) {
          setSelectedSpecies(names.slice(0, 5));
        }
      }

      const { data: datesData } = await supabase.rpc('get_available_dates', {
        p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold
      });
      if (datesData && datesData.length > 0) {
        const dates = datesData.map((d: any) => d.date);
        setAvailableDates(dates);
        const latest = dates[0]; // descending order
        const [y, m] = latest.split('-');
        setDiversityYear(y);
        setDiversityMonth(m);
        setDiurnalDate(latest);
        setRadialDate(latest);
      }
    }
    initOptions();
  }, [p_project_names, p_site_name, p_recorder_name, confidenceThreshold]);

  // 2. Fetch Trend Data (Daily)
  useEffect(() => {
    if (selectedSpecies.length === 0) return;
    async function fetchTrend() {
      const { data } = await supabase.rpc('get_trend_data', {
        p_species: selectedSpecies, p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold
      });
      if (data) setTrendData(data);
    }
    fetchTrend();
  }, [selectedSpecies, p_project_names, p_site_name, p_recorder_name, confidenceThreshold]);

  // 3. Fetch Diversity Data
  useEffect(() => {
    if (!diversityYear || !diversityMonth) return;
    async function fetchDiversity() {
      const { data } = await supabase.rpc('get_diversity_data', {
        p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold,
        p_year: diversityYear, p_month: diversityMonth
      });
      if (data) setDiversityData(data);
    }
    fetchDiversity();
  }, [diversityYear, diversityMonth, p_project_names, p_site_name, p_recorder_name, confidenceThreshold]);

  // 4. Fetch Diurnal Data
  useEffect(() => {
    if (selectedSpecies.length === 0 || !diurnalDate) return;
    async function fetchDiurnal() {
      const { data } = await supabase.rpc('get_diurnal_data', {
        p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold,
        p_species: selectedSpecies, p_date: diurnalDate
      });
      if (data) setDiurnalData(data);
    }
    fetchDiurnal();
  }, [diurnalDate, selectedSpecies, p_project_names, p_site_name, p_recorder_name, confidenceThreshold]);

  // 5. Fetch Monthly Abundance
  useEffect(() => {
    async function fetchMonthly() {
      const { data } = await supabase.rpc('get_monthly_abundance', {
        p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold
      });
      if (data) setMonthlyData(data);
    }
    fetchMonthly();
  }, [p_project_names, p_site_name, p_recorder_name, confidenceThreshold]);

  // 6. Fetch Radial Activity
  useEffect(() => {
    if (!radialDate) return;
    async function fetchRadial() {
      const { data } = await supabase.rpc('get_radial_activity', {
        p_project_names, p_site_name, p_recorder_name, p_confidence: confidenceThreshold,
        p_date: radialDate
      });
      if (data) setRadialDataState(data);
    }
    fetchRadial();
  }, [radialDate, p_project_names, p_site_name, p_recorder_name, confidenceThreshold]);

  // Available Years/Months for Selectors
  const availableYears = useMemo(() => {
    const years = availableDates.map(d => d.slice(0, 4));
    return [...new Set(years)].sort();
  }, [availableDates]);

  const availableMonthsInYear = useMemo(() => {
    const months = availableDates.filter(d => d.startsWith(diversityYear)).map(d => d.slice(5, 7));
    return [...new Set(months)].sort();
  }, [availableDates, diversityYear]);


  // ================= ECHARTS OPTIONS ================= //

  const trendOption = useMemo(() => {
    const dates = Array.from(new Set(trendData.map(d => d.detection_date))).sort();
    const series = selectedSpecies.map((sp, idx) => {
      const dataForSp = dates.map(date => {
        const match = trendData.find(d => d.common_name === sp && d.detection_date === date);
        return match ? Number(match.detection_count) : 0;
      });
      return {
        name: sp,
        type: 'line' as const,
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: chartColors[idx % chartColors.length] },
        data: dataForSp
      };
    });
    return {
      tooltip: { trigger: 'axis' },
      title: { text: 'Daily Trend (Auto-binned)', left: 'right', top: 0, textStyle: { fontSize: 11, color: '#64748b' } },
      legend: { data: selectedSpecies, top: 24 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 64, containLabel: true },
      xAxis: { type: 'category' as const, boundaryGap: false, data: dates },
      yAxis: { type: 'value' as const },
      series: series
    };
  }, [trendData, selectedSpecies]);

  const diversityOption = useMemo(() => {
    const daysInMonth = new Date(parseInt(diversityYear || '2000'), parseInt(diversityMonth || '1'), 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const data = labels.map(day => {
      const match = diversityData.find(d => d.day === day);
      return match ? Number(match.unique_species_count) : 0;
    });

    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category' as const, boundaryGap: false, data: labels },
      yAxis: { type: 'value' as const },
      series: [{
        name: 'Unique Species',
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#3b82f6' },
        areaStyle: { opacity: 0.15, color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.4)' }, { offset: 1, color: 'rgba(59, 130, 246, 0.02)' }] } },
        data: data
      }]
    };
  }, [diversityData, diversityYear, diversityMonth]);

  const diurnalOption = useMemo(() => {
    const series = selectedSpecies.map((sp, idx) => {
      const dataForSp = Array.from({ length: 24 }, (_, h) => {
        const match = diurnalData.find(d => d.common_name === sp && d.hour === h);
        return match ? Number(match.count) : 0;
      });
      return {
        name: sp,
        type: 'line' as const,
        smooth: true,
        itemStyle: { color: chartColors[idx % chartColors.length] },
        data: dataForSp
      };
    });
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: selectedSpecies, top: 0 },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category' as const, boundaryGap: false, data: hourLabels },
      yAxis: { type: 'value' as const },
      series: series
    };
  }, [diurnalData, selectedSpecies]);

  const monthlyOption = useMemo(() => {
    const labels = monthlyData.map(d => {
      const [y, mo] = d.month.split('-');
      return `${new Date(2000, parseInt(mo) - 1).toLocaleString('default', { month: 'short' })} ${y}`;
    });
    const data = monthlyData.map(d => Number(d.count));

    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category' as const, data: labels },
      yAxis: { type: 'value' as const },
      series: [{
        name: 'Detections',
        type: 'bar' as const,
        barWidth: '50%',
        itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] },
        data: data
      }]
    };
  }, [monthlyData]);

  const radialOption = useMemo(() => {
    const data = Array.from({ length: 24 }, (_, h) => {
      const match = radialDataState.find(d => d.hour === h);
      return match ? Number(match.count) : 0;
    });

    return {
      tooltip: { trigger: 'axis' },
      polar: {},
      angleAxis: { type: 'category' as const, data: hourLabels, startAngle: 90, boundaryGap: false },
      radiusAxis: { type: 'value' as const },
      series: [{
        type: 'bar' as const,
        coordinateSystem: 'polar',
        data: data,
        itemStyle: { color: '#10b981', borderRadius: [2, 2, 2, 2] }
      }]
    };
  }, [radialDataState]);


  return (
    <div className="space-y-6">
      
      {/* Species Selector Tool */}
      <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Bird className="w-4 h-4 text-indigo-600" /> Species for Trends & Diurnal Charts
          </h3>
          <span className="text-[11px] font-black text-slate-500">{selectedSpecies.length}/8</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedSpecies.map((sp) => (
            <span key={sp} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[11px] font-bold border border-indigo-200">
              {sp}
              <button onClick={() => removeSpecies(sp)} className="hover:text-indigo-950">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="md:col-span-2 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={speciesSearch}
                onChange={(e) => setSpeciesSearch(e.target.value)}
                placeholder="Search and add a species..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
            {speciesSearch && (
              <div className="absolute z-20 w-full mt-1 max-h-40 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                {topSpeciesList
                  .filter((sp) => sp.toLowerCase().includes(speciesSearch.toLowerCase()) && !selectedSpecies.includes(sp))
                  .slice(0, 8)
                  .map((sp) => (
                    <button
                      key={sp}
                      onClick={() => { addSpecies(sp); setSpeciesSearch(''); }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-slate-700"
                    >
                      {sp}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <button
              onClick={() => setSelectedSpecies(topSpeciesList.slice(0, 8))}
              className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100"
            >
              Top 8 Most Detected
            </button>
            <button
              onClick={() => setSelectedSpecies([...topSpeciesList].reverse().slice(0, 8))}
              className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-bold hover:bg-rose-100"
            >
              Top 8 Rarest
            </button>
        </div>
      </div>

      {/* Chart 1: Species Detection Trends Over Time */}
      <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" /> Species Detection Trends Over Time
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">Daily trend across the survey period for the selected species</p>
        </div>
        <ReactECharts option={trendOption} notMerge={true} style={{ height: '320px' }} />
      </div>

      {/* Chart 2: Detection Patterns by Time of Day (24-Hour Diurnal) */}
      <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" /> Detection Patterns by Time of Day (24-Hour Diurnal)
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Use the species selector above; pick a date to see hourly detections</p>
          </div>
          <select
            value={diurnalDate}
            onChange={(e) => setDiurnalDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
          >
            {availableDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <ReactECharts option={diurnalOption} notMerge={true} style={{ height: '280px' }} />
      </div>

      {/* Chart 3: Species Diversity Over Time */}
      <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Bird className="w-4 h-4 text-blue-600" /> Species Diversity Over Time
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Number of unique species detected per day in a given month</p>
          </div>
          <div className="flex gap-2">
            <select
              value={diversityYear}
              onChange={(e) => { setDiversityYear(e.target.value); setDiversityMonth(''); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={diversityMonth}
              onChange={(e) => setDiversityMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              {availableMonthsInYear.map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, parseInt(m) - 1, 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ReactECharts option={diversityOption} notMerge={true} style={{ height: '280px' }} />
      </div>

      {/* Chart 4: Month by Month Abundance Bar Chart */}
      <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" /> Month by Month Vocal Activity Volume
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">Monthly total bioacoustic call detections across the survey period</p>
        </div>
        <ReactECharts option={monthlyOption} notMerge={true} style={{ height: '280px' }} />
      </div>

      {/* Chart 5: Diurnal Activity Pattern (24-Hour Radial Clock - Total) */}
      <div className="p-6 rounded-[24px] bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" /> Diurnal Activity Pattern (24-Hour Radial Clock - Total)
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Pick a date to see total detections per hour for that day</p>
          </div>
          <select
            value={radialDate}
            onChange={(e) => setRadialDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
          >
            {availableDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <ReactECharts option={radialOption} notMerge={true} style={{ height: '360px' }} />
      </div>

    </div>
  );
}
