import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function stripPasswordHash(u: any) {
  if (!u) return u;
  const { password_hash, ...safeUser } = u;
  return safeUser;
}

// GET: List all registered users (Admin only) without exposing password_hash
export async function GET(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin']);
  if (authError || !user) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .neq('email', 'system_settings@birdlab.in')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ users: (data || []).map(stripPasswordHash) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// POST: Create a new user (Admin only)
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin.from('users').insert([body]).select().single();
    if (error) throw error;
    return NextResponse.json(stripPasswordHash(data));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// PUT: Update an existing user
export async function PUT(req: NextRequest) {
  const { user, error: authError } = await authGuard(req); // Any logged in user
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    // Non-admins can only edit their own user
    if (user.role !== 'Admin' && user.id !== id) {
      return NextResponse.json({ error: 'Unauthorized to edit this user' }, { status: 403 });
    }

    // Non-admins cannot change their role or assigned projects/sites/status
    if (user.role !== 'Admin') {
      delete updateData.role;
      delete updateData.assignedProjects;
      delete updateData.assigned_projects;
      delete updateData.assignedSites;
      delete updateData.assigned_sites;
      delete updateData.projectScopePermissions;
      delete updateData.project_scope_permissions;
      delete updateData.status;
    }

    const { data, error } = await supabaseAdmin.from('users').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json(stripPasswordHash(data));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete a user (Admin only)
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
