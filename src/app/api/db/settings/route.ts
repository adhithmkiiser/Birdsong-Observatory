import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const SYSTEM_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_SETTINGS_EMAIL = 'system_settings@birdlab.in';

// GET: Fetch current public visibility settings from Supabase
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('organization')
      .eq('id', SYSTEM_SETTINGS_ID)
      .single();

    if (error || !data || !data.organization) {
      return NextResponse.json({ settings: null });
    }

    const parsed = typeof data.organization === 'string' ? JSON.parse(data.organization) : data.organization;
    return NextResponse.json({ settings: parsed });
  } catch (error: any) {
    console.error('Error fetching visibility settings from Supabase:', error);
    return NextResponse.json({ settings: null });
  }
}

// PUT: Save updated public visibility settings into Supabase
export async function PUT(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);

    const { error } = await supabaseAdmin
      .from('users')
      .upsert({
        id: SYSTEM_SETTINGS_ID,
        email: SYSTEM_SETTINGS_EMAIL,
        full_name: 'System Visibility Settings',
        role: 'Admin',
        organization: serialized,
        project_scope_permissions: ['visibility_config']
      });

    if (error) {
      console.error('Failed to upsert visibility settings to Supabase:', error);
      throw error;
    }

    return NextResponse.json({ success: true, settings: body });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
