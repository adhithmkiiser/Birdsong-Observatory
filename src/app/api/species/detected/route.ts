import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  // Load local species master metadata
  const filePath = path.join(process.cwd(), 'public', 'species_data.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const { byScientific, byCommon } = JSON.parse(raw);

  // Fetch live detections
  const { data: dets, error } = await supabase
    .from('live_detections')
    .select('common_name, scientific_name, recorder_id, project_name, site_name, timestamp')
    .order('timestamp', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Supabase error fetching live detections:', error);
    return NextResponse.json({ total_results: 0, species: [] });
  }

  const rows = dets || [];

  // Dedupe by recorder/timestamp/species
  const seen = new Set<string>();
  const unique = rows.filter((r: any) => {
    const key = `${r.recorder_id}|${r.timestamp}|${r.common_name}|${r.scientific_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Aggregate by species
  const speciesMap: Record<string, any> = {};
  unique.forEach((r: any) => {
    const sci = r.scientific_name || 'Unknown';
    const comm = r.common_name || 'Unknown';
    const key = sci.toLowerCase();
    if (!speciesMap[key]) {
      speciesMap[key] = {
        common_name: comm,
        scientific_name: sci,
        first_seen: r.timestamp,
        last_seen: r.timestamp,
        recorders: {} as Record<string, number>,
        projects: {} as Record<string, number>,
        sites: {} as Record<string, number>,
        count: 0
      };
    }
    const s = speciesMap[key];
    s.count++;
    s.recorders[r.recorder_id] = (s.recorders[r.recorder_id] || 0) + 1;
    s.projects[r.project_name || 'Unknown'] = (s.projects[r.project_name || 'Unknown'] || 0) + 1;
    s.sites[r.site_name || 'Unknown'] = (s.sites[r.site_name || 'Unknown'] || 0) + 1;
    const t = new Date(r.timestamp).getTime();
    if (new Date(s.first_seen).getTime() > t) s.first_seen = r.timestamp;
    if (new Date(s.last_seen).getTime() < t) s.last_seen = r.timestamp;
  });

  // Build results matched with local species master
  let results = Object.values(speciesMap).map((s: any) => {
    const sciKey = String(s.scientific_name).toLowerCase();
    const commKey = String(s.common_name).toLowerCase();
    const master = byScientific[sciKey] || byCommon[commKey] || {};
    const byProject = Object.entries(s.projects)
      .map(([project_name, count]) => ({ project_name, count: Number(count) }))
      .sort((a: any, b: any) => b.count - a.count);
    const bySite = Object.entries(s.sites)
      .map(([site_name, count]) => ({ site_name, count: Number(count) }))
      .sort((a: any, b: any) => b.count - a.count);
    const byRecorder = Object.entries(s.recorders)
      .map(([recorder_id, count]) => ({ recorder_id, count: Number(count) }))
      .sort((a: any, b: any) => b.count - a.count);

    return {
      id: `spc-detected-${sciKey || commKey}`,
      taxa_id: 0,
      common_name: master.common_name || s.common_name,
      scientific_name: master.scientific_name || s.scientific_name,
      square_url: master.image_url || 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=200&auto=format&fit=crop',
      image_url: master.image_url || 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=800&auto=format&fit=crop',
      attribution: 'IISER Tirupati Bird Lab',
      iucn_status: (master.iucn_status || 'Least Concern').toUpperCase().replace(/_/g, ' '),
      guild: master.guild || 'Unknown',
      habitat: master.habitat || 'Unknown',
      foraging_stratum: master.foraging_stratum || 'Unknown',
      vocal_activity: master.vocal_activity || 'Unknown',
      endemic_status: master.endemic_status || 'No',
      indicator_group: master.indicator_group || '',
      total_detections: s.count,
      first_seen: s.first_seen,
      last_seen: s.last_seen,
      by_project: byProject,
      by_site: bySite,
      by_recorder: byRecorder,
      top_project: byProject[0] || null,
      top_site: bySite[0] || null,
      top_recorder: byRecorder[0] || null
    };
  });

  if (q) {
    results = results.filter((r: any) =>
      String(r.common_name).toLowerCase().includes(q) ||
      String(r.scientific_name).toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ total_results: results.length, species: results });
}
