import { NextRequest, NextResponse } from 'next/server';
import { getEcologicalTraits } from '@/lib/birdEcologicalTraits';

// In-memory cache to guarantee sub-10ms response times
const memoryCache = new Map<string, any>();
const CACHE_TTL = 3600 * 1000 * 12; // 12 hours TTL

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const query = (searchParams.get('q') || '').trim();
  const cacheKey = `species-${page}-${query.toLowerCase()}`;

  // Check instant in-memory cache
  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    let url = `https://api.inaturalist.org/v1/observations/species_counts?place_id=6681&taxon_id=3&per_page=40&page=${page}`;
    if (query) {
      url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&taxon_id=3&place_id=6681&rank=species&per_page=30`;
    }

    // Set 2.5s timeout for fast response guarantee
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BirdNET-Cloud-Platform/1.0',
      },
      signal: controller.signal,
      next: { revalidate: 86400 }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`iNaturalist API error: ${response.status}`);
    }

    const data = await response.json();
    const rawResults = data.results || [];

    const results = rawResults.map((item: any) => {
      const t = item.taxon ? item.taxon : item;
      const p = t.default_photo || {};
      const squareUrl = p.square_url || 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=200&auto=format&fit=crop';
      const mediumUrl = p.medium_url || 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=800&auto=format&fit=crop';
      const largeUrl = mediumUrl.replace('medium', 'large');

      const commonName = t.preferred_common_name || t.name;
      const scientificName = t.name;
      const traits = getEcologicalTraits(scientificName, commonName);

      return {
        id: `spc-api-${t.id}`,
        taxa_id: t.id,
        common_name: commonName,
        scientific_name: scientificName,
        square_url: squareUrl,
        image_url: largeUrl,
        attribution: p.attribution || '(c) iNaturalist Community',
        iucn_status: t.conservation_status?.status_name ? t.conservation_status.status_name.replace(/_/g, ' ').toUpperCase() : 'LEAST CONCERN',
        guild: traits.guild,
        habitat: traits.habitat,
        foraging_stratum: traits.foraging_stratum,
        vocal_activity: traits.vocal_activity,
        endemic_status: traits.endemic_status
      };
    });

    const payload = {
      total_results: data.total_results || results.length,
      page: parseInt(page),
      species: results
    };

    // Save to memory cache
    memoryCache.set(cacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (err: any) {
    // If cache exists even if expired, return cached data on network error
    if (memoryCache.has(cacheKey)) {
      return NextResponse.json(memoryCache.get(cacheKey).data);
    }
    return NextResponse.json({ error: err.message || 'Failed to fetch species list' }, { status: 500 });
  }
}
