import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authGuard, escapePostgrestValue, canUserManageProject } from '@/lib/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get('limit') || '1000', 10);
    const detsLimit = isNaN(limitParam) ? 1000 : Math.min(Math.max(limitParam, 50), 5000);

    // Check optional authentication to determine if private Live projects can be returned
    const { user } = await authGuard(req);

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

    // Filter out private Live projects unless the caller is Admin or an assigned manager
    const visibleProjects = (projs || []).filter((p: any) => {
      if (p.public_visible !== false) return true;
      return Boolean(user) && (canUserManageProject(user, p.id) || canUserManageProject(user, p.name));
    });

    const visibleProjNames = new Set(visibleProjects.map((p: any) => String(p.name || '').toLowerCase().trim()));
    const visibleProjIds = new Set(visibleProjects.map((p: any) => String(p.id || '').toLowerCase().trim()));
    const hasPrivateFilteredOut = (projs || []).length > visibleProjects.length;

    const visibleRecorders = hasPrivateFilteredOut
      ? (recorders || []).filter((r: any) => {
          const rp = String(r.project_name || r.project_id || '').toLowerCase().trim();
          return visibleProjNames.has(rp) || visibleProjIds.has(rp);
        })
      : (recorders || []);

    const visibleDetections = hasPrivateFilteredOut
      ? (liveDets || []).filter((d: any) => {
          const dp = String(d.project_name || '').toLowerCase().trim();
          return visibleProjNames.has(dp) || visibleProjIds.has(dp);
        })
      : (liveDets || []);

    return NextResponse.json({
      success: true,
      projects: visibleProjects,
      recorders: visibleRecorders,
      telemetry: hasPrivateFilteredOut && visibleProjects.length === 0 ? [] : (teleData || []),
      models: modelsData || [],
      nodeModels: nodeModelsData || [],
      detections: visibleDetections
    });
  } catch (error: any) {
    console.error('API /api/live/admin GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager', 'Site Manager']);
  if (authError || !user) {
    return NextResponse.json({ success: false, error: authError || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Non-Admin users must be explicitly assigned to the Live project to perform Live admin mutations
    if (user.role !== 'Admin') {
      const targetProj = body.projectId || body.projectName || 'test';
      if (!canUserManageProject(user, targetProj) && !canUserManageProject(user, 'test_custom')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: You are not assigned to manage this Live Detector project.' },
          { status: 403 }
        );
      }
    }

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
        const rawNode = String(nodeId).trim();
        const cleanNode = rawNode.includes('::') ? rawNode.split('::').pop()! : rawNode;
        const safeRaw = escapePostgrestValue(rawNode);
        const safeClean = escapePostgrestValue(cleanNode);
        if (rawNode !== cleanNode) {
          q = q.or(`recorder_id.eq."${safeRaw}",station_id.eq."${safeRaw}",recorder_id.eq."${safeClean}",station_id.eq."${safeClean}"`);
        } else {
          q = q.or(`recorder_id.eq."${safeRaw}",station_id.eq."${safeRaw}"`);
        }
      }

      // Note: live_detections only has project_name, NOT project_id.
      // Resolve project name from projects table if an ID was passed.
      if (projectId && projectId !== 'All' && projectId !== 'ALL_PROJECTS') {
        let targetName = projectName;
        if (!targetName) {
          try {
            const safeProjId = escapePostgrestValue(projectId);
            const { data: projRecord } = await supabaseAdmin
              .from('projects')
              .select('name')
              .or(`id.eq."${safeProjId}",name.eq."${safeProjId}"`)
              .maybeSingle();
            targetName = projRecord?.name || projectId;
          } catch {
            targetName = projectId;
          }
        }
        q = q.ilike('project_name', targetName);
      } else if (projectName && projectName !== 'All') {
        q = q.ilike('project_name', projectName);
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'approved') {
          q = q.or('verification_status.eq.YES,verified.eq.true');
        } else if (statusFilter === 'rejected') {
          q = q.or('verification_status.eq.NO,verification_status.eq.rejected');
        } else if (statusFilter === 'pending') {
          q = q.is('verification_status', null);
        }
      }

      // PostgREST requires at least one filter on DELETE to prevent accidental full-table wipes
      q = q.gt('id', 0);

      const { error, count } = await q;
      if (error) throw error;

      // Also clean up matching records from window_summaries so triage stays synchronized
      try {
        let wq = supabaseAdmin.from('window_summaries').delete();
        if (nodeId && nodeId !== 'All' && nodeId !== 'ALL_SITES') {
          const rawNode = String(nodeId).trim();
          const cleanNode = rawNode.includes('::') ? rawNode.split('::').pop()! : rawNode;
          const safeRaw = escapePostgrestValue(rawNode);
          const safeClean = escapePostgrestValue(cleanNode);
          wq = wq.or(`node_id.eq."${safeRaw}",node_id.eq."${safeClean}"`);
        } else {
          wq = wq.not('window_id', 'is', null);
        }
        await wq;
      } catch (wErr) {
        console.warn('Non-fatal window_summaries purge notice:', wErr);
      }

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
