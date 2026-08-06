import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ALLOWED_TABLES = ['pam_detections', 'lantana_detections', 'live_detections', 'recorders_registry'];

// POST: Insert array of detections
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const { table, records } = body;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table specified' }, { status: 400 });
    }

    if (!Array.isArray(records)) {
      return NextResponse.json({ error: 'Records must be an array' }, { status: 400 });
    }

    // Insert records. For massive datasets, the frontend should chunk them (e.g. 500 at a time)
    const { data, error } = await supabaseAdmin.from(table).insert(records);
    if (error) throw error;
    
    return NextResponse.json({ success: true, inserted: records.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete detections
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const url = new URL(req.url);
    const table = url.searchParams.get('table');
    const id = url.searchParams.get('id'); // for single deletion
    
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table specified' }, { status: 400 });
    }

    // Single ID deletion
    if (id) {
      const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Batch deletion via payload (e.g., array of IDs, or specific query params)
    const bodyText = await req.text();
    if (bodyText) {
      const body = JSON.parse(bodyText);
      if (body.ids && Array.isArray(body.ids)) {
        const { error } = await supabaseAdmin.from(table).delete().in('id', body.ids);
        if (error) throw error;
        return NextResponse.json({ success: true });
      } else if (body.deleteByProject) {
        // Special case: delete all detections by project_id or project_name
        const { projectId, projectName } = body.deleteByProject;
        let query = supabaseAdmin.from(table).delete();
        if (projectId) query = query.eq('project_id', projectId);
        else if (projectName) query = query.eq('project_name', projectName);
        
        const { error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true });
      } else if (body.deleteByNode) {
        const { recorderId, projectName } = body.deleteByNode;
        const { error } = await supabaseAdmin.from(table).delete().eq('recorder_id', recorderId).eq('project_name', projectName);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Missing deletion criteria' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
