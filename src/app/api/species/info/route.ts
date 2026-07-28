import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  try {
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&taxon_id=3`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BirdNET-Cloud-Platform/1.0',
      },
      next: { revalidate: 86400 } // Cache API results for 24 hours
    });

    if (!response.ok) {
      throw new Error(`iNaturalist API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      return NextResponse.json({ found: false, message: 'No species match found' });
    }

    const taxa = results[0];
    const defaultPhoto = taxa.default_photo || {};
    const mediumUrl = defaultPhoto.medium_url || '';
    const largeUrl = mediumUrl.replace('medium', 'large');

    return NextResponse.json({
      found: true,
      id: taxa.id,
      common_name: taxa.preferred_common_name || taxa.name,
      scientific_name: taxa.name,
      photo: {
        square: defaultPhoto.square_url,
        medium: mediumUrl,
        large: largeUrl,
        attribution: defaultPhoto.attribution
      },
      conservation_status: taxa.conservation_status?.status_name || 'Least Concern',
      wikipedia_summary: taxa.wikipedia_summary || '',
      wikipedia_url: taxa.wikipedia_url || `https://en.wikipedia.org/wiki/${encodeURIComponent(taxa.name)}`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch species details' }, { status: 500 });
  }
}
