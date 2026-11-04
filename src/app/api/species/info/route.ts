import { NextRequest, NextResponse } from 'next/server';
import { 
  SPECIES_MASTER_LIST, 
  normalizeSpeciesKey, 
  normalizeSpeciesImageUrl, 
  DEFAULT_AVIAN_PLACEHOLDER 
} from '@/lib/speciesMasterData';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  const cleanName = name.trim();
  const normKey = normalizeSpeciesKey(cleanName);

  // 1. Check curated SPECIES_MASTER_LIST first with normalized key (handles hyphens, spaces, underscores)
  // All images in SPECIES_MASTER_LIST are verified Wikimedia Commons photos under free Creative Commons licenses
  const masterMatch = SPECIES_MASTER_LIST.find(
    (s) =>
      normalizeSpeciesKey(s.common_name) === normKey ||
      normalizeSpeciesKey(s.scientific_name) === normKey ||
      (s.birdnet_label && normalizeSpeciesKey(s.birdnet_label) === normKey)
  );

  if (masterMatch && masterMatch.image_url) {
    const masterImg = normalizeSpeciesImageUrl(masterMatch.image_url);
    return NextResponse.json({
      found: true,
      common_name: masterMatch.common_name,
      scientific_name: masterMatch.scientific_name,
      photo: {
        square: masterImg,
        medium: masterImg,
        large: masterImg,
        attribution: 'Wikimedia Commons (Free Creative Commons / Public Domain)'
      },
      conservation_status: masterMatch.iucn_status || 'Least Concern',
      wikipedia_summary: '',
      wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(masterMatch.scientific_name)}`
    });
  }

  try {
    // 2. Wikipedia REST Summary API (strictly Wikimedia Commons free CC/Public Domain photos)
    const wikiQueries = [
      masterMatch?.scientific_name,
      masterMatch?.common_name,
      cleanName
    ].filter(Boolean) as string[];

    for (const query of wikiQueries) {
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g, '_'))}`;
        const wikiRes = await fetch(wikiUrl, {
          headers: { 'User-Agent': 'BirdSong-Observatory/1.0' },
          next: { revalidate: 86400 }
        });

        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const thumb = normalizeSpeciesImageUrl(wikiData.thumbnail?.source || wikiData.originalimage?.source || '');
          const orig = normalizeSpeciesImageUrl(wikiData.originalimage?.source || thumb);
          if (thumb) {
            return NextResponse.json({
              found: true,
              common_name: masterMatch?.common_name || cleanName,
              scientific_name: masterMatch?.scientific_name || wikiData.title || cleanName,
              photo: {
                square: thumb,
                medium: thumb,
                large: orig,
                attribution: 'Wikimedia Commons (Free Creative Commons / Public Domain)'
              },
              conservation_status: masterMatch?.iucn_status || 'Least Concern',
              wikipedia_summary: wikiData.extract || '',
              wikipedia_url: wikiData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`
            });
          }
        }
      } catch {
        // try next
      }
    }

    // 3. iNaturalist Taxa API (taxon_id=3 = Aves) - Open Data observations under Creative Commons
    const inatUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(cleanName)}&taxon_id=3&rank=species`;
    const inatRes = await fetch(inatUrl, {
      headers: {
        'User-Agent': 'BirdSong-Observatory/1.0 (https://birdsong-observatory.onrender.com)',
      },
      next: { revalidate: 86400 }
    });

    if (inatRes.ok) {
      const data = await inatRes.json();
      const results = data.results || [];

      if (results.length > 0) {
        const exactMatch = results.find(
          (r: any) =>
            normalizeSpeciesKey(r.preferred_common_name) === normKey ||
            normalizeSpeciesKey(r.name) === normKey
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
              attribution: defaultPhoto.attribution || 'iNaturalist Open Data (Creative Commons)'
            },
            conservation_status: taxa.conservation_status?.status_name || masterMatch?.iucn_status || 'Least Concern',
            wikipedia_summary: taxa.wikipedia_summary || '',
            wikipedia_url: taxa.wikipedia_url || `https://en.wikipedia.org/wiki/${encodeURIComponent(taxa.name)}`
          });
        }
      }
    }

    // 4. Clean SVG fallback placeholder (never a misleading bird photo like a green parrot)
    return NextResponse.json({
      found: false,
      common_name: masterMatch?.common_name || cleanName,
      scientific_name: masterMatch?.scientific_name || cleanName,
      photo: {
        square: DEFAULT_AVIAN_PLACEHOLDER,
        medium: DEFAULT_AVIAN_PLACEHOLDER,
        large: DEFAULT_AVIAN_PLACEHOLDER,
        attribution: 'Bioacoustic Detection (Photo in curation)'
      },
      message: 'Photo in curation'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch species details' }, { status: 500 });
  }
}


