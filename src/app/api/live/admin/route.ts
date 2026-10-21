import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const [
      { data: projs, error: projsErr },
      { data: recorders, error: recErr },
      { data: teleData, error: teleErr },
      { data: modelsData, error: modelsErr },
      { data: nodeModelsData, error: nmErr },
      { data: liveDets, error: detsErr }
    ] = await Promise.all([
      supabaseAdmin.from('projects').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
      supabaseAdmin.from('recorders_registry').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
      supabaseAdmin.from('station_telemetry').select('*').order('ping_time', { ascending: false }).limit(100),
      supabaseAdmin.from('models').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('node_models').select('*, models(*)'),
      supabaseAdmin.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(100)
    ]);

    return NextResponse.json({
      success: true,
      projects: projs || [],
      recorders: recorders || [],
      telemetry: teleData || [],
      models: modelsData || [],
      nodeModels: nodeModelsData || [],
      detections: liveDets || []
    });
  } catch (error: any) {
    console.error('API /api/live/admin GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'update_gps') {
      const { nodeId, lat, long } = body;
      const { data, error } = await supabaseAdmin
        .from('recorders_registry')
        .update({
          lat,
          long,
          latitude: lat,
          longitude: long
        })
        .eq('recorder_id', nodeId)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === 'toggle_node_model') {
      const { nodeId, modelId, enabled, threshold } = body;
      const payload: any = {
        node_id: nodeId,
        model_id: modelId,
        enabled,
        updated_at: new Date().toISOString()
      };
      if (threshold !== undefined) {
        payload.threshold = threshold;
      }

      const { data, error } = await supabaseAdmin
        .from('node_models')
        .upsert(payload, { onConflict: 'node_id,model_id' })
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === 'create_model') {
      const { modelData } = body;
      const { data, error } = await supabaseAdmin
        .from('models')
        .insert(modelData)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === 'delete_node') {
      const { nodeId } = body;
      const { error } = await supabaseAdmin
        .from('recorders_registry')
        .delete()
        .eq('recorder_id', nodeId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'sync_now') {
      const { nodeId } = body;
      const { data, error } = await supabaseAdmin
        .from('recorders_registry')
        .update({
          last_ping: new Date().toISOString(),
          status: 'online'
        })
        .eq('recorder_id', nodeId)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/live/admin POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
