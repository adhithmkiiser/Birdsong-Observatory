import { NextRequest, NextResponse } from 'next/server';
import { authGuard, escapePostgrestValue, canUserManageProject, canUserManageSite } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveSiteEntities, resolveRecorderAliases } from '@/lib/siteResolver';

// Allowed tables to prevent SQL injection or targeting wrong tables
const ALLOWED_TABLES = ['sites', 'live_sites', 'lantana_sites'];

// POST: Upsert a new site
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError || !user) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { table, ...siteData } = body;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table specified' }, { status: 400 });
    }
    
    // Check project permission for non-admins
    if (user.role !== 'Admin') {
      const projectId = siteData.project_id || siteData.projectId || (table === 'lantana_sites' ? 'tst_lantana' : '');
      if (!projectId || !canUserManageProject(user, projectId)) {
        return NextResponse.json({ error: 'Unauthorized to add site to this project' }, { status: 403 });
      }
    }

    let { data, error } = await supabaseAdmin.from(table).upsert([siteData], { onConflict: 'id' }).select().single();
    if (error && String(error.message || '').includes('recorder_id')) {
      const { recorder_id: _ignored, ...fallbackData } = siteData;
      const retry = await supabaseAdmin.from(table).upsert([fallbackData], { onConflict: 'id' }).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// PUT: Update an existing site
export async function PUT(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager', 'Site Manager']);
  if (authError || !user) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { table, id, ...updateData } = body;

    if (!ALLOWED_TABLES.includes(table) || !id) {
      return NextResponse.json({ error: 'Invalid table or site ID specified' }, { status: 400 });
    }

    // Check project/site permission for non-admins by inspecting existing site if needed
    if (user.role !== 'Admin') {
      const { data: existingSite } = await supabaseAdmin.from(table).select('*').eq('id', id).maybeSingle();
      const targetProjId = updateData.project_id || updateData.projectId || existingSite?.project_id || (table === 'lantana_sites' ? 'tst_lantana' : '');
      const targetSiteName = existingSite?.site_name || existingSite?.name || id;

      if (user.role === 'Project Manager' && !canUserManageProject(user, targetProjId)) {
        return NextResponse.json({ error: 'Unauthorized to edit this site' }, { status: 403 });
      }
      if (user.role === 'Site Manager' && !canUserManageSite(user, targetSiteName, targetProjId) && !canUserManageSite(user, id, targetProjId)) {
        return NextResponse.json({ error: 'Unauthorized to edit this site' }, { status: 403 });
      }
    }

    let { data, error } = await supabaseAdmin.from(table).update(updateData).eq('id', id).select().single();
    if (error && String(error.message || '').includes('recorder_id')) {
      const { recorder_id: _ignored, ...fallbackData } = updateData;
      const retry = await supabaseAdmin.from(table).update(fallbackData).eq('id', id).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete a site and cascade delete all associated detections from ALL related databases
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const table = url.searchParams.get('table');

    if (!id || !table) {
      return NextResponse.json({ error: 'Site ID and table are required' }, { status: 400 });
    }

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table specified' }, { status: 400 });
    }

    // 1. Fetch site record first to get its name / site_name
    const { data: siteRecord } = await supabaseAdmin.from(table).select('*').eq('id', id).maybeSingle();
    
    if (siteRecord) {
      const siteName = siteRecord.site_name || siteRecord.name;
      const siteId = siteRecord.id;
      const recorderId = siteRecord.recorder_id;

      // Check permissions for non-admins
      if (user.role === 'Site Manager') {
        const assignedSites: string[] = [
          ...(user.assignedSites || []),
          ...(user.assigned_sites || [])
        ].map(s => String(s).toLowerCase().trim());

        const isAllowed = [siteName, siteId].some(
          s => s && assignedSites.includes(String(s).toLowerCase().trim())
        );
        if (!isAllowed) {
          return NextResponse.json({ error: 'Unauthorized to delete this site' }, { status: 403 });
        }
      } else if (user.role === 'Project Manager') {
        const assignedProjects: string[] = [
          ...(user.assignedProjects || []),
          ...(user.assigned_projects || [])
        ].map(p => String(p).toLowerCase().trim());

        const projId = siteRecord.project_id || siteRecord.projectId;
        if (projId && !assignedProjects.includes(String(projId).toLowerCase().trim())) {
          return NextResponse.json({ error: 'Unauthorized to delete site for this project' }, { status: 403 });
        }
      }

      // 2. Cascade delete all associated detections from ALL related databases
      const safeSiteName = siteName ? escapePostgrestValue(siteName) : '';
      const safeSiteId = siteId ? escapePostgrestValue(siteId) : '';

      const { matchedSiteNewIds, candidateSiteNames } = await resolveSiteEntities({
        siteName,
        siteId,
        projectId: siteRecord.project_id || siteRecord.projectId
      });
      const candidateRecorderNames = resolveRecorderAliases(recorderId);

      // Clean rollups and detection warehouse tables
      if (matchedSiteNewIds.length > 0) {
        await supabaseAdmin.from('detection_hourly_rollup').delete().in('site_id', matchedSiteNewIds);
        await supabaseAdmin.from('detections').delete().in('site_id', matchedSiteNewIds);
        await supabaseAdmin.from('sites_new').delete().in('id', matchedSiteNewIds);
      }

      // A. Lantana detections
      let lq = supabaseAdmin.from('lantana_detections').delete();
      if (candidateSiteNames.length > 0) {
        lq = lq.in('site_name', candidateSiteNames);
      } else if (siteName && siteId && siteName !== siteId) {
        lq = lq.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}"`);
      } else if (siteName) {
        lq = lq.eq('site_name', siteName);
      }
      if (candidateRecorderNames.length > 0) {
        lq = lq.in('recorder_id', candidateRecorderNames);
      } else if (recorderId) {
        lq = lq.eq('recorder_id', recorderId);
      }
      await lq;

      // B. PAM detections
      let pq = supabaseAdmin.from('pam_detections').delete();
      if (candidateSiteNames.length > 0) {
        pq = pq.in('site_name', candidateSiteNames);
      } else if (siteName && siteId && siteName !== siteId) {
        pq = pq.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}"`);
      } else if (siteName) {
        pq = pq.eq('site_name', siteName);
      }
      if (candidateRecorderNames.length > 0) {
        pq = pq.in('recorder_name', candidateRecorderNames);
      } else if (recorderId) {
        pq = pq.eq('recorder_name', recorderId);
      }
      await pq;

      // C. Live detections
      let livq = supabaseAdmin.from('live_detections').delete();
      if (candidateSiteNames.length > 0) {
        livq = livq.in('site_name', candidateSiteNames);
      } else if (siteName && siteId && siteName !== siteId) {
        livq = livq.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}",station_name.eq."${safeSiteName}"`);
      } else if (siteName) {
        livq = livq.or(`site_name.eq."${safeSiteName}",station_name.eq."${safeSiteName}"`);
      }
      if (candidateRecorderNames.length > 0) {
        livq = livq.in('recorder_id', candidateRecorderNames);
      } else if (recorderId) {
        livq = livq.eq('recorder_id', recorderId);
      }
      await livq;

      // D. Recorders registry
      let rq = supabaseAdmin.from('recorders_registry').delete();
      if (candidateSiteNames.length > 0) {
        rq = rq.in('site_name', candidateSiteNames);
      } else if (siteName && siteId && siteName !== siteId) {
        rq = rq.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}"`);
      } else if (siteName) {
        rq = rq.eq('site_name', siteName);
      }
      if (candidateRecorderNames.length > 0) {
        rq = rq.in('recorder_id', candidateRecorderNames);
      } else if (recorderId) {
        rq = rq.eq('recorder_id', recorderId);
      }
      await rq;
    }

    // 3. Delete the site entry from the sites table
    const { error } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (error) throw error;
    
    return NextResponse.json({ success: true, cascadeDeleted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
