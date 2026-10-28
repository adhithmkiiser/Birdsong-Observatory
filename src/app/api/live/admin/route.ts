import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get('limit') || '1000', 10);
    const detsLimit = isNaN(limitParam) ? 1000 : Math.min(Math.max(limitParam, 50), 5000);

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
      supabaseAdmin.from('live_detections').select('*').order('timestamp', { ascending: false }).limit(detsLimit)
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

    if (action === 'verify_detection') {
      const { id, status } = body;
      const { data, error } = await supabaseAdmin
        .from('live_detections')
        .update({
          verification_status: status,
          reviewed: true,
          verified: status === 'YES'
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === 'delete_detection') {
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
      
      // Attempt to clean associated audio file if present
      try {
        const { data: rec } = await supabaseAdmin
          .from('live_detections')
          .select('audio_url')
          .eq('id', id)
          .single();
        if (rec?.audio_url) {
          const urlPath = new URL(rec.audio_url).pathname;
          if (urlPath.includes('/clips/')) {
            const rel = urlPath.split('/clips/')[1];
            if (rel) await supabaseAdmin.storage.from('clips').remove([rel]).catch(() => {});
          } else if (urlPath.includes('/bird-audio/')) {
            const rel = urlPath.split('/bird-audio/')[1];
            if (rel) await supabaseAdmin.storage.from('bird-audio').remove([rel]).catch(() => {});
          }
        }
      } catch (e) {
        // audio cleanup failure is non-fatal
      }

      const { error } = await supabaseAdmin
        .from('live_detections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (action === 'delete_detections_bulk') {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ success: false, error: 'ids array required' }, { status: 400 });
      }

      // Attempt to clean associated audio files
      try {
        const { data: recs } = await supabaseAdmin
          .from('live_detections')
          .select('audio_url')
          .in('id', ids);
        const clipPaths: string[] = [];
        const birdAudioPaths: string[] = [];
        (recs || []).forEach(r => {
          if (!r.audio_url) return;
          try {
            const p = new URL(r.audio_url).pathname;
            if (p.includes('/clips/')) {
              const rel = p.split('/clips/')[1];
              if (rel) clipPaths.push(rel);
            } else if (p.includes('/bird-audio/')) {
              const rel = p.split('/bird-audio/')[1];
              if (rel) birdAudioPaths.push(rel);
            }
          } catch {}
        });
        if (clipPaths.length > 0) await supabaseAdmin.storage.from('clips').remove(clipPaths).catch(() => {});
        if (birdAudioPaths.length > 0) await supabaseAdmin.storage.from('bird-audio').remove(birdAudioPaths).catch(() => {});
      } catch (e) {
        // non-fatal
      }

      const { error } = await supabaseAdmin
        .from('live_detections')
        .delete()
        .in('id', ids);

      if (error) throw error;
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === 'purge_detections') {
      const { nodeId, statusFilter, projectId, projectName } = body;
      let q = supabaseAdmin.from('live_detections').delete();

      if (nodeId && nodeId !== 'All' && nodeId !== 'ALL_SITES') {
        q = q.or(`recorder_id.eq.${nodeId},station_id.eq.${nodeId}`);
      }

      if (projectId && projectId !== 'All' && projectId !== 'ALL_PROJECTS') {
        q = q.eq('project_id', projectId);
      } else if (projectName && projectName !== 'All') {
        q = q.eq('project_name', projectName);
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'approved') {
          q = q.or('verification_status.eq.YES,verified.eq.true');
        } else if (statusFilter === 'rejected') {
          q = q.or('verification_status.eq.NO,verification_status.eq.rejected');
        } else if (statusFilter === 'pending') {
          q = q.is('verification_status', null);
        }
      } else {
        q = q.gt('id', 0);
      }

      const { error, count } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, count });
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
