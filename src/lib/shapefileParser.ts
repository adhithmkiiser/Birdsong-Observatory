/**
 * Comprehensive Geographic Boundary & Shapefile Parser for BirdSong Observatory.
 * Supports:
 * - Google Earth KML (.kml)
 * - Google Earth Compressed KMZ (.kmz)
 * - ESRI Shapefile Archives (.zip)
 * - Raw ESRI Shapefiles (.shp)
 * - Standard GeoJSON (.geojson, .json)
 */

export interface ParsedShapefileResult {
  geojson: any;
  featureCount: number;
  centroid?: [number, number]; // [lat, lng]
  bounds?: [[number, number], [number, number]]; // [[south, west], [north, east]]
  fileName: string;
}

/**
 * Computes the centroid [lat, lng] and bounds of a GeoJSON FeatureCollection / Feature
 */
export function extractGeoJsonMetrics(geojson: any): {
  centroid?: [number, number];
  bounds?: [[number, number], [number, number]];
  featureCount: number;
} {
  let lats: number[] = [];
  let lngs: number[] = [];

  function processCoords(coords: any) {
    if (!coords) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      // Leaflet / GeoJSON coordinates are [lng, lat]
      const lng = coords[0];
      const lat = coords[1];
      if (!isNaN(lat) && !isNaN(lng)) {
        lats.push(lat);
        lngs.push(lng);
      }
    } else if (Array.isArray(coords)) {
      for (const item of coords) {
        processCoords(item);
      }
    }
  }

  let featureCount = 0;
  if (geojson?.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    featureCount = geojson.features.length;
    for (const f of geojson.features) {
      if (f.geometry?.coordinates) {
        processCoords(f.geometry.coordinates);
      }
    }
  } else if (geojson?.type === 'Feature' && geojson.geometry?.coordinates) {
    featureCount = 1;
    processCoords(geojson.geometry.coordinates);
  } else if (geojson?.coordinates) {
    featureCount = 1;
    processCoords(geojson.coordinates);
  }

  if (lats.length === 0 || lngs.length === 0) {
    return { featureCount };
  }

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  return {
    featureCount,
    centroid: [Number(avgLat.toFixed(6)), Number(avgLng.toFixed(6))],
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng]
    ]
  };
}

/**
 * Parses an XML KML string into GeoJSON
 */
async function parseKmlStringToGeoJson(kmlText: string): Promise<any> {
  const { kml } = await import('@tmcw/togeojson');
  const parser = new DOMParser();
  const dom = parser.parseFromString(kmlText, 'text/xml');
  const parserError = dom.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid KML XML structure: ' + parserError.textContent);
  }
  return kml(dom);
}

/**
 * Parses an uploaded File (.kml, .kmz, .shp, .zip, .geojson, .json) into standard GeoJSON with metrics
 */
export async function parseShapefileOrGeoJson(file: File): Promise<ParsedShapefileResult> {
  const name = file.name.toLowerCase();
  let geojson: any = null;

  // 1. Standard GeoJSON / JSON
  if (name.endsWith('.json') || name.endsWith('.geojson')) {
    const text = await file.text();
    try {
      geojson = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON / GeoJSON format. Please verify the file syntax.');
    }
  }

  // 2. Google Earth KML
  else if (name.endsWith('.kml')) {
    const text = await file.text();
    try {
      geojson = await parseKmlStringToGeoJson(text);
    } catch (err: any) {
      throw new Error(`Failed to parse KML file: ${err?.message || 'Invalid KML content'}`);
    }
  }

  // 3. Google Earth Compressed KMZ
  else if (name.endsWith('.kmz')) {
    try {
      const JSZip = (await import('jszip')).default;
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      // Find the primary .kml file inside the KMZ archive
      let kmlFile = zip.file('doc.kml');
      if (!kmlFile) {
        const kmlFileNames = Object.keys(zip.files).filter(f => f.toLowerCase().endsWith('.kml'));
        if (kmlFileNames.length > 0) {
          kmlFile = zip.file(kmlFileNames[0]);
        }
      }

      if (!kmlFile) {
        throw new Error('No .kml document found inside this .kmz archive.');
      }

      const kmlText = await kmlFile.async('text');
      geojson = await parseKmlStringToGeoJson(kmlText);
    } catch (err: any) {
      throw new Error(`Failed to parse KMZ file: ${err?.message || 'Corrupted KMZ archive'}`);
    }
  }

  // 4. Standalone Raw ESRI Shapefile (.shp)
  else if (name.endsWith('.shp')) {
    try {
      const buffer = await file.arrayBuffer();
      const shpModule = await import('shpjs');
      const parseShp = (shpModule.parseShp || (shpModule.default as any)?.parseShp) as any;

      if (typeof parseShp === 'function') {
        const geometries = parseShp(buffer);
        geojson = {
          type: 'FeatureCollection',
          features: (Array.isArray(geometries) ? geometries : [geometries]).map((geom, idx) => ({
            type: 'Feature',
            id: idx,
            properties: { name: file.name.replace(/\.shp$/i, '') },
            geometry: geom
          }))
        };
      } else {
        throw new Error('Shapefile geometry parser is not available.');
      }
    } catch (err: any) {
      throw new Error(`Failed to parse raw .shp file: ${err?.message}. Note: uploading the full .zip with .shp and .dbf is recommended.`);
    }
  }

  // 5. Zipped Archive (.zip) - Can be ESRI Shapefile or Zipped KML
  else if (name.endsWith('.zip')) {
    const buffer = await file.arrayBuffer();

    // Check if it's a zipped KML first
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const kmlFileNames = Object.keys(zip.files).filter(f => f.toLowerCase().endsWith('.kml'));
      if (kmlFileNames.length > 0) {
        const kmlFile = zip.file(kmlFileNames[0]);
        if (kmlFile) {
          const kmlText = await kmlFile.async('text');
          geojson = await parseKmlStringToGeoJson(kmlText);
        }
      }
    } catch {
      // Continue to shpjs parser below
    }

    // If not a KML zip, parse as ESRI Shapefile Archive
    if (!geojson) {
      try {
        const shpModule = await import('shpjs');
        const shp = (shpModule.default || shpModule) as any;
        geojson = await shp(buffer);

        // If shp returned an array of layers, wrap them in a FeatureCollection
        if (Array.isArray(geojson)) {
          const combinedFeatures: any[] = [];
          for (const item of geojson) {
            if (item?.features) combinedFeatures.push(...item.features);
            else if (item?.type === 'Feature') combinedFeatures.push(item);
          }
          geojson = {
            type: 'FeatureCollection',
            features: combinedFeatures
          };
        }
      } catch (err: any) {
        throw new Error(`Failed to parse zipped Shapefile: ${err?.message || 'Unsupported archive'}. Please ensure it contains .shp and .dbf files.`);
      }
    }
  } else {
    throw new Error('Unsupported format. Please upload a KML (.kml), KMZ (.kmz), Shapefile (.zip, .shp), or GeoJSON (.geojson, .json) file.');
  }

  if (!geojson || (!geojson.features && !geojson.geometry && geojson.type !== 'Feature')) {
    throw new Error('Parsed file contains no geographic polygon or feature coordinates.');
  }

  // Ensure FeatureCollection structure if single Feature was returned
  if (geojson.type === 'Feature') {
    geojson = {
      type: 'FeatureCollection',
      features: [geojson]
    };
  }

  const { featureCount, centroid, bounds } = extractGeoJsonMetrics(geojson);

  return {
    geojson,
    featureCount,
    centroid,
    bounds,
    fileName: file.name
  };
}
