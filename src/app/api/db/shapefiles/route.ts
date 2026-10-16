import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authGuard } from '@/lib/authGuard';

const BUCKET = 'observatory-data';
const MANIFEST_PATH = 'shapefiles/manifest.json';

interface ShapefileManifestItem {
  id: string; // targetId
  targetId: string;
  targetType: 'site' | 'project';
  name: string;
  habitat?: string; // 'LC' | 'LI' | 'CS' | 'common' | 'live'
  projectId?: string;
  siteId?: string;
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
    const projectId = url.searchParams.get('projectId')?.toLowerCase().trim();
    const siteId = url.searchParams.get('siteId')?.toLowerCase().trim();

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

    // Filter manifest by target project or site if requested
    let filteredManifest = manifest;
    if (projectId && projectId !== 'all' && projectId !== 'all_lantana') {
      filteredManifest = filteredManifest.filter((item) => {
        const itemTarget = item.targetId.toLowerCase();
        const itemProj = (item.projectId || '').toLowerCase();
        return itemTarget === projectId || itemTarget.startsWith(projectId + '_') || itemProj === projectId;
      });
    }

    if (siteId && siteId !== 'all') {
      filteredManifest = filteredManifest.filter((item) => {
        const itemTarget = item.targetId.toLowerCase();
        const itemSite = (item.siteId || '').toLowerCase();
        return itemTarget === siteId || itemTarget.startsWith(siteId + '_') || itemSite === siteId;
      });
    }

    // 2. Load shapefiles with GeoJSON payload for map overlay
    if (loadAll) {
      const itemsWithGeojson = await Promise.all(
        filteredManifest.map(async (item) => {
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
    return NextResponse.json({ items: filteredManifest });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save or update shapefile for site or project
// Only Admin, Project Manager (for assigned project), and Site Manager (for assigned site) can upload
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager', 'Site Manager']);
  if (authError || !user) {
    return NextResponse.json(
      { error: authError || 'Unauthorized: Only Admins, Project Managers (for assigned projects), and Site Managers (for assigned sites) can upload shapefiles.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { targetId, targetType, name, habitat, geojson, centroid, projectId, siteId } = body;

    if (!targetId || !geojson) {
      return NextResponse.json({ error: 'targetId and geojson are required' }, { status: 400 });
    }

    // Role-specific scope validation
    const userRole = user.role;
    if (userRole === 'Project Manager') {
      const userProjects: string[] = [
        ...(user.assignedProjects || []),
        ...(user.assigned_projects || []),
        ...(user.projectScopePermissions || []),
        ...(user.project_scope_permissions || []),
        ...(user.assignedProject ? [user.assignedProject] : []),
        ...(user.assigned_project ? [user.assigned_project] : [])
      ].map((p: any) => String(p).toLowerCase().trim()).filter(Boolean);

      const targetProj = (projectId || (targetType === 'project' ? targetId : '') || '').toLowerCase().trim();

      if (userProjects.length === 0) {
        return NextResponse.json({ error: 'Unauthorized: No assigned projects found for this Project Manager account.' }, { status: 403 });
      }

      if (targetProj && targetProj !== 'all' && targetProj !== 'all_lantana' && !userProjects.includes(targetProj)) {
        return NextResponse.json({ error: 'Unauthorized: Project Managers can only upload shapefiles for their assigned project.' }, { status: 403 });
      }
    } else if (userRole === 'Site Manager') {
      const userSites: string[] = [
        ...(user.assignedSites || []),
        ...(user.assigned_sites || []),
        ...(user.assignedSite ? [user.assignedSite] : []),
        ...(user.assigned_site ? [user.assigned_site] : [])
      ].map((s: any) => String(s).toLowerCase().trim()).filter(Boolean);

      const targetSite = (siteId || (targetType === 'site' ? targetId : '') || '').toLowerCase().trim();

      if (userSites.length === 0) {
        return NextResponse.json({ error: 'Unauthorized: No assigned sites found for this Site Manager account.' }, { status: 403 });
      }

      if (targetSite && targetSite !== 'all' && !userSites.includes(targetSite)) {
        return NextResponse.json({ error: 'Unauthorized: Site Managers can only upload shapefiles for their assigned site.' }, { status: 403 });
      }
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
      projectId: projectId || (targetType === 'project' ? sanitizedId : undefined),
      siteId: siteId || (targetType === 'site' ? sanitizedId : undefined),
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
// Only Admin, Project Manager (for assigned project), and Site Manager (for assigned site) can delete
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager', 'Site Manager']);
  if (authError || !user) {
    return NextResponse.json(
      { error: authError || 'Unauthorized: Only Admins, Project Managers (for assigned projects), and Site Managers (for assigned sites) can delete shapefiles.' },
      { status: 403 }
    );
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const sanitizedId = id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const normalizedId = sanitizedId.toLowerCase();

    // Role-specific scope checks for DELETE
    const userRole = user.role;
    if (userRole === 'Project Manager') {
      const userProjects: string[] = [
        ...(user.assignedProjects || []),
        ...(user.assigned_projects || []),
        ...(user.projectScopePermissions || []),
        ...(user.project_scope_permissions || []),
        ...(user.assignedProject ? [user.assignedProject] : []),
        ...(user.assigned_project ? [user.assigned_project] : [])
      ].map((p: any) => String(p).toLowerCase().trim()).filter(Boolean);

      if (!userProjects.includes(normalizedId)) {
        return NextResponse.json({ error: 'Unauthorized: Project Managers can only delete shapefiles for their assigned project.' }, { status: 403 });
      }
    } else if (userRole === 'Site Manager') {
      const userSites: string[] = [
        ...(user.assignedSites || []),
        ...(user.assigned_sites || []),
        ...(user.assignedSite ? [user.assignedSite] : []),
        ...(user.assigned_site ? [user.assigned_site] : [])
      ].map((s: any) => String(s).toLowerCase().trim()).filter(Boolean);

      if (!userSites.includes(normalizedId)) {
        return NextResponse.json({ error: 'Unauthorized: Site Managers can only delete shapefiles for their assigned site.' }, { status: 403 });
      }
    }

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
