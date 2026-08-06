import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// POST: Create a new project
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin.from('projects').insert([body]).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// PUT: Update an existing project
export async function PUT(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updateData } = body;
    
    // Non-admins can only edit projects they are assigned to
    if (user.role !== 'Admin') {
      const assignedProjects = user.assignedProjects || [];
      if (!assignedProjects.includes(id)) {
        return NextResponse.json({ error: 'Unauthorized to edit this project' }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin.from('projects').update(updateData).eq('id', id).select().single();
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

    // 1. Delete associated sites
    const sitesTable = isLantana ? 'lantana_sites' : 'sites';
    if (isLantana) {
      await supabaseAdmin.from(sitesTable).delete().or(`project_id.eq.${id},id.like.${id}_%`);
    } else {
      await supabaseAdmin.from(sitesTable).delete().eq('project_id', id);
    }

    // 2. Delete associated detections
    const detectionsTable = isLantana ? 'lantana_detections' : 'pam_detections';
    if (isLantana) {
      await supabaseAdmin.from(detectionsTable).delete().or(`project_id.eq.${id},project_name.eq.${projName || id}`);
    } else {
      await supabaseAdmin.from(detectionsTable).delete().or(`project_name.eq.${id},project_name.eq.${projName || id}`);
    }

    // 3. Delete the project itself
    const { error } = await supabaseAdmin.from('projects').delete().eq('id', id);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
