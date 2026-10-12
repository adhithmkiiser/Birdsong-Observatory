import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const BUCKET = 'observatory-data';
const MANIFEST_PATH = 'shapefiles/manifest.json';

interface ShapefileManifestItem {
  id: string; // targetId
  targetId: string;
  targetType: 'site' | 'project';
  name: string;
  habitat?: string; // 'LC' | 'LI' | 'CS' | 'common' | 'live'
  updated_at: string;
  centroid?: [number, number];
}

async function getManifest(): Promise<ShapefileManifestItem[]> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(MANIFEST_PATH);
    if (error || !data) return [];
    const text = await data.text();
    return JSON.parse(text) || [];
  } catch {
    return [];
  }
}

async function saveManifest(manifest: ShapefileManifestItem[]): Promise<void> {
  await supabaseAdmin.storage.from(BUCKET).upload(MANIFEST_PATH, JSON.stringify(manifest), {
    contentType: 'application/json',
    upsert: true
  });
}

// GET: Fetch shapefiles manifest, all shapefiles with geojson, or single shapefile
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const loadAll = url.searchParams.get('all') === 'true';

    // 1. Single Shapefile requested
    if (id) {
      const filePath = `shapefiles/${id}.geojson`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(filePath);
      if (error || !data) {
        return NextResponse.json({ error: 'Shapefile not found' }, { status: 404 });
      }
      const text = await data.text();
      const geojson = JSON.parse(text);
      return NextResponse.json({ id, geojson });
    }

    const manifest = await getManifest();

    // 2. Load all shapefiles with GeoJSON payload for map overlay
    if (loadAll) {
      const itemsWithGeojson = await Promise.all(
        manifest.map(async (item) => {
          try {
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`shapefiles/${item.targetId}.geojson`);
            if (data) {
              const text = await data.text();
              const geojson = JSON.parse(text);
              return { ...item, geojson };
            }
          } catch (e) {
            console.error(`Error loading geojson for ${item.targetId}:`, e);
          }
          return null;
        })
      );

      return NextResponse.json({
        items: itemsWithGeojson.filter(Boolean)
      });
    }

    // 3. Just manifest list
    return NextResponse.json({ items: manifest });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save or update shapefile for site or project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetId, targetType, name, habitat, geojson, centroid } = body;

    if (!targetId || !geojson) {
      return NextResponse.json({ error: 'targetId and geojson are required' }, { status: 400 });
    }

    const sanitizedId = targetId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `shapefiles/${sanitizedId}.geojson`;

    // 1. Upload GeoJSON payload to Supabase storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, JSON.stringify(geojson), {
        contentType: 'application/geo+json',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // 2. Update Manifest
    const manifest = await getManifest();
    const existingIdx = manifest.findIndex(m => m.targetId === sanitizedId);
    const manifestItem: ShapefileManifestItem = {
      id: sanitizedId,
      targetId: sanitizedId,
      targetType: targetType || 'site',
      name: name || sanitizedId,
      habitat: habitat || undefined,
      centroid: centroid || undefined,
      updated_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      manifest[existingIdx] = manifestItem;
    } else {
      manifest.push(manifestItem);
    }

    await saveManifest(manifest);

    return NextResponse.json({
      success: true,
      id: sanitizedId,
      manifestItem
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete shapefile for site or project
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const sanitizedId = id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `shapefiles/${sanitizedId}.geojson`;

    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);

    const manifest = await getManifest();
    const updated = manifest.filter(m => m.targetId !== sanitizedId);
    await saveManifest(updated);

    return NextResponse.json({ success: true, id: sanitizedId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
