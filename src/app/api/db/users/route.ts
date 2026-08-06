import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// POST: Create a new user (Admin only)
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin.from('users').insert([body]).select().single();
    if (error) throw error;
    return NextResponse.json(data);
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

    // Non-admins cannot change their role or assigned projects/sites
    if (user.role !== 'Admin') {
      delete updateData.role;
      delete updateData.assignedProjects;
      delete updateData.assignedSites;
    }

    const { data, error } = await supabaseAdmin.from('users').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
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
