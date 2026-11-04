import { NextRequest, NextResponse } from 'next/server';
import { SPECIES_MASTER_LIST } from '@/lib/speciesMasterData';

function normalizeBirdImageUrl(url?: string | null): string {
  if (!url) return '';
  let clean = url.trim();
  // Convert Wikimedia Commons 3840px/huge thumbs to 800px or direct file URLs to avoid HTTP 429 rate-limiting
  if (clean.includes('upload.wikimedia.org/wikipedia/commons/thumb/')) {
    clean = clean.replace(/\/(\d{4,})px-/, '/800px-');
  }
  return clean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();

  // Check curated SPECIES_MASTER_LIST first for instant ecological & taxonomy metadata
  const masterMatch = SPECIES_MASTER_LIST.find(
    (s) =>
      s.common_name.toLowerCase() === lowerName ||
      s.scientific_name.toLowerCase() === lowerName
  );

  try {
    // Query iNaturalist Taxa API (taxon_id=3 = Aves)
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(cleanName)}&taxon_id=3&rank=species`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BirdSong-Observatory/1.0 (https://birdsong-observatory.onrender.com)',
      },
      next: { revalidate: 86400 } // Cache API results for 24 hours
    });

    if (response.ok) {
      const data = await response.json();
      const results = data.results || [];

      if (results.length > 0) {
        // Prefer exact common_name or scientific_name match if present in top results
        const exactMatch = results.find(
          (r: any) =>
            (r.preferred_common_name && r.preferred_common_name.toLowerCase() === lowerName) ||
            (r.name && r.name.toLowerCase() === lowerName) ||
            (masterMatch && r.name && r.name.toLowerCase() === masterMatch.scientific_name.toLowerCase())
        );
        const taxa = exactMatch || results[0];
        const defaultPhoto = taxa.default_photo || {};
        const mediumUrl = defaultPhoto.medium_url || '';
        const largeUrl = mediumUrl ? mediumUrl.replace('medium', 'large') : '';

        if (mediumUrl || largeUrl) {
          return NextResponse.json({
            found: true,
            id: taxa.id,
            common_name: taxa.preferred_common_name || masterMatch?.common_name || cleanName,
            scientific_name: taxa.name || masterMatch?.scientific_name || cleanName,
            photo: {
              square: defaultPhoto.square_url || mediumUrl,
              medium: mediumUrl || largeUrl,
              large: largeUrl || mediumUrl,
              attribution: defaultPhoto.attribution
            },
            conservation_status: taxa.conservation_status?.status_name || masterMatch?.iucn_status || 'Least Concern',
            wikipedia_summary: taxa.wikipedia_summary || '',
            wikipedia_url: taxa.wikipedia_url || `https://en.wikipedia.org/wiki/${encodeURIComponent(taxa.name)}`
          });
        }
      }
    }

    // Fallback 2: Wikipedia REST Summary API (by common name or master scientific name)
    const wikiQuery = masterMatch?.scientific_name || cleanName;
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery.replace(/ /g, '_'))}`;
    const wikiRes = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'BirdSong-Observatory/1.0' },
      next: { revalidate: 86400 }
    });

    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const thumb = wikiData.thumbnail?.source || wikiData.originalimage?.source || '';
      const orig = wikiData.originalimage?.source || thumb;
      if (thumb) {
        return NextResponse.json({
          found: true,
          common_name: masterMatch?.common_name || cleanName,
          scientific_name: masterMatch?.scientific_name || cleanName,
          photo: {
            square: thumb,
            medium: thumb,
            large: orig,
            attribution: 'Wikipedia / Wikimedia Commons'
          },
          conservation_status: masterMatch?.iucn_status || 'Least Concern',
          wikipedia_summary: wikiData.extract || '',
          wikipedia_url: wikiData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiQuery)}`
        });
      }
    }

    // Fallback 3: Curated SPECIES_MASTER_LIST image if available
    if (masterMatch) {
      const masterImg = normalizeBirdImageUrl(masterMatch.image_url);
      return NextResponse.json({
        found: true,
        common_name: masterMatch.common_name,
        scientific_name: masterMatch.scientific_name,
        photo: {
          square: masterImg,
          medium: masterImg,
          large: masterImg,
          attribution: 'Wikimedia Commons'
        },
        conservation_status: masterMatch.iucn_status || 'Least Concern',
        wikipedia_summary: '',
        wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(masterMatch.scientific_name)}`
      });
    }

    return NextResponse.json({ found: false, message: 'No species match found' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch species details' }, { status: 500 });
  }
}

