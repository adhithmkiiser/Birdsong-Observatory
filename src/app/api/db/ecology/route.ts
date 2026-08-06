import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// POST: Upsert species ecology
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from('lantana_species_ecology')
      .upsert([body], { onConflict: 'scientific_name' })
      .select()
      .single();

    if (error) {
      // Fallback if missing image_link / audio_link columns
      if (error.message.includes('column')) {
        const { image_link, audio_link, ...coreRecord } = body;
        const { data: coreData, error: coreErr } = await supabaseAdmin
          .from('lantana_species_ecology')
          .upsert([coreRecord], { onConflict: 'scientific_name' })
          .select()
          .single();
        
        if (coreErr) throw coreErr;
        return NextResponse.json(coreData);
      }
      throw error;
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
