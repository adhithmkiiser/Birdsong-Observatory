import { NextRequest, NextResponse } from 'next/server';
import { authGuard, escapePostgrestValue, canUserManageProject } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PRIVATE_MARKER = '<!--PRIVATE-->';

function stripPrivateMarker(desc?: string | null): string {
  return String(desc || '').replace(/^<!--PRIVATE-->\s*/, '');
}

function hasPrivateMarker(desc?: string | null): boolean {
  return String(desc || '').startsWith(PRIVATE_MARKER);
}

// POST: Create a new project (Admin only)
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const isPublic = body.public_visible !== false;
    const cleanDesc = stripPrivateMarker(body.description);

    const { data, error } = await supabaseAdmin.from('projects').insert([body]).select().single();
    if (!error && data) {
      return NextResponse.json({
        ...data,
        description: stripPrivateMarker(data.description),
        public_visible: data.public_visible !== false && !hasPrivateMarker(data.description)
      });
    }

    // Fallback if `public_visible` column does not exist in Supabase `projects` schema yet
    if (error && String(error.message || '').includes('public_visible')) {
      const { public_visible: _ignored, ...fallbackBody } = body;
      fallbackBody.description = isPublic ? cleanDesc : `${PRIVATE_MARKER}${cleanDesc}`;
      const { data: fbData, error: fbErr } = await supabaseAdmin.from('projects').insert([fallbackBody]).select().single();
      if (fbErr) throw fbErr;
      return NextResponse.json({
        ...fbData,
        description: cleanDesc,
        public_visible: isPublic
      });
    }

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// PUT: Update an existing project
export async function PUT(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager', 'Site Manager']);
  if (authError || !user) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    // Non-admins can only edit projects they are explicitly assigned to
    if (user.role !== 'Admin' && !canUserManageProject(user, id)) {
      return NextResponse.json({ error: 'Unauthorized to edit this project' }, { status: 403 });
    }

    // Fetch existing row so we can preserve or update its visibility marker cleanly
    const { data: existingProj } = await supabaseAdmin
      .from('projects')
      .select('description')
      .eq('id', id)
      .maybeSingle();

    const currentlyPrivate = hasPrivateMarker(existingProj?.description);
    const targetPrivate =
      updateData.public_visible !== undefined
        ? updateData.public_visible === false
        : currentlyPrivate;

    const rawDesc =
      updateData.description !== undefined
        ? updateData.description
        : existingProj?.description || '';
    const cleanDesc = stripPrivateMarker(rawDesc);

    const { data, error } = await supabaseAdmin.from('projects').update(updateData).eq('id', id).select().single();
    if (!error && data) {
      return NextResponse.json({
        ...data,
        description: stripPrivateMarker(data.description),
        public_visible: !targetPrivate
      });
    }

    // Fallback if `public_visible` column does not exist in Supabase `projects` schema yet
    if (error && String(error.message || '').includes('public_visible')) {
      const { public_visible: _ignored, ...fallbackUpdate } = updateData;
      fallbackUpdate.description = targetPrivate ? `${PRIVATE_MARKER}${cleanDesc}` : cleanDesc;
      const { data: fbData, error: fbErr } = await supabaseAdmin
        .from('projects')
        .update(fallbackUpdate)
        .eq('id', id)
        .select()
        .single();
      if (fbErr) throw fbErr;
      return NextResponse.json({
        ...fbData,
        description: cleanDesc,
        public_visible: !targetPrivate
      });
    }

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete a project (with cascading deletes)
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    // Fetch the project to know if it's Lantana or PAM
    const { data: project } = await supabaseAdmin.from('projects').select('name, project_type').eq('id', id).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const isLantana = project.project_type === 'Lantana';
    const projName = project.name;
    const safeId = escapePostgrestValue(id);
    const safeProjName = escapePostgrestValue(projName || id);

    // 1. Delete associated sites
    const sitesTable = isLantana ? 'lantana_sites' : 'sites';
    if (isLantana) {
      await supabaseAdmin.from(sitesTable).delete().or(`project_id.eq."${safeId}",id.like."${safeId}_%"`);
    } else {
      await supabaseAdmin.from(sitesTable).delete().eq('project_id', id);
    }

    // 2. Delete associated detections
    const detectionsTable = isLantana ? 'lantana_detections' : 'pam_detections';
    if (isLantana) {
      await supabaseAdmin.from(detectionsTable).delete().or(`project_id.eq."${safeId}",project_name.eq."${safeProjName}"`);
    } else {
      await supabaseAdmin.from(detectionsTable).delete().or(`project_name.eq."${safeId}",project_name.eq."${safeProjName}"`);
    }

    // 3. Delete the project itself
    const { error } = await supabaseAdmin.from('projects').delete().eq('id', id);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
