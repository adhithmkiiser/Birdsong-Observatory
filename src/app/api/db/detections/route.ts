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
// DELETE: Delete detections
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager', 'Site Manager']);
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const url = new URL(req.url);
    const tableParam = url.searchParams.get('table');
    const id = url.searchParams.get('id'); // for single deletion
    
    // Check if body contains deletion criteria
    let body: any = null;
    const bodyText = await req.text();
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch (e) {
        // body not valid JSON
      }
    }

    // 1. DELETE ALL FOR SITE / RECORDER (across all related tables or specified table)
    if (body?.deleteAllForSite) {
      const { 
        siteName, 
        siteId, 
        recorderId, 
        projectName, 
        projectId, 
        table: targetTableParam 
      } = body.deleteAllForSite;

      if (!siteName && !siteId) {
        return NextResponse.json({ error: 'siteName or siteId is required to delete site detections' }, { status: 400 });
      }

      // Authorization checks for non-admins
      if (user.role === 'Site Manager') {
        const assignedSites: string[] = [
          ...(user.assignedSites || []),
          ...(user.assigned_sites || [])
        ].map(s => String(s).toLowerCase().trim());

        const isAllowed = [siteName, siteId].some(
          s => s && assignedSites.includes(String(s).toLowerCase().trim())
        );
        if (!isAllowed) {
          return NextResponse.json({ error: 'Unauthorized to delete detections for this site' }, { status: 403 });
        }
      } else if (user.role === 'Project Manager') {
        const assignedProjects: string[] = [
          ...(user.assignedProjects || []),
          ...(user.assigned_projects || [])
        ].map(p => String(p).toLowerCase().trim());

        if (projectId || projectName) {
          const isAllowed = [projectId, projectName].some(
            p => p && assignedProjects.includes(String(p).toLowerCase().trim())
          );
          if (!isAllowed) {
            return NextResponse.json({ error: 'Unauthorized to delete detections for this project' }, { status: 403 });
          }
        }
      }

      const resolvedSiteName = siteName || siteId;
      const targetTable = targetTableParam || tableParam || 'all';
      const tablesToClean = (targetTable === 'all')
        ? ['pam_detections', 'lantana_detections', 'live_detections']
        : [targetTable];

      const results: Record<string, boolean> = {};

      for (const t of tablesToClean) {
        try {
          if (t === 'pam_detections') {
            let q = supabaseAdmin.from('pam_detections').delete();
            if (siteName && siteId && siteName !== siteId) {
              q = q.or(`site_name.eq."${siteName}",site_name.eq."${siteId}"`);
            } else {
              q = q.eq('site_name', resolvedSiteName);
            }

            if (recorderId && recorderId !== 'All') {
              q = q.or(`recorder_name.eq."${recorderId}",recorder_id.eq."${recorderId}"`);
            }
            if (projectName) {
              q = q.eq('project_name', projectName);
            }
            const { error } = await q;
            if (error) console.error('Error deleting from pam_detections:', error);
            results['pam_detections'] = !error;
          } else if (t === 'lantana_detections') {
            let q = supabaseAdmin.from('lantana_detections').delete();
            if (siteName && siteId && siteName !== siteId) {
              q = q.or(`site_name.eq."${siteName}",site_name.eq."${siteId}"`);
            } else {
              q = q.eq('site_name', resolvedSiteName);
            }

            if (recorderId && recorderId !== 'All') {
              q = q.or(`recorder_id.eq."${recorderId}",recorder_name.eq."${recorderId}"`);
            }
            if (projectId) {
              q = q.eq('project_id', projectId);
            } else if (projectName) {
              q = q.eq('project_name', projectName);
            }
            const { error } = await q;
            if (error) console.error('Error deleting from lantana_detections:', error);
            results['lantana_detections'] = !error;
          } else if (t === 'live_detections') {
            // Collect audio URLs if any to clean storage
            let selQ = supabaseAdmin.from('live_detections').select('audio_url');
            if (siteName && siteId && siteName !== siteId) {
              selQ = selQ.or(`site_name.eq."${siteName}",site_name.eq."${siteId}",station_name.eq."${siteName}"`);
            } else {
              selQ = selQ.or(`site_name.eq."${resolvedSiteName}",station_name.eq."${resolvedSiteName}"`);
            }
            if (recorderId && recorderId !== 'All') {
              selQ = selQ.eq('recorder_id', recorderId);
            }
            if (projectName) {
              selQ = selQ.eq('project_name', projectName);
            }
            const { data: liveDets } = await selQ;
            if (liveDets && liveDets.length > 0) {
              const audioPaths = liveDets
                .map((d: any) => d.audio_url)
                .filter(Boolean)
                .map((url: string) => {
                  try {
                    return new URL(url).pathname.replace('/storage/v1/object/public/bird-audio/', '');
                  } catch {
                    return '';
                  }
                })
                .filter(Boolean);
              if (audioPaths.length > 0) {
                await supabaseAdmin.storage.from('bird-audio').remove(audioPaths).catch(() => {});
              }
            }

            let q = supabaseAdmin.from('live_detections').delete();
            if (siteName && siteId && siteName !== siteId) {
              q = q.or(`site_name.eq."${siteName}",site_name.eq."${siteId}",station_name.eq."${siteName}"`);
            } else {
              q = q.or(`site_name.eq."${resolvedSiteName}",station_name.eq."${resolvedSiteName}"`);
            }
            if (recorderId && recorderId !== 'All') {
              q = q.eq('recorder_id', recorderId);
            }
            if (projectName) {
              q = q.eq('project_name', projectName);
            }
            const { error } = await q;
            if (error) console.error('Error deleting from live_detections:', error);
            results['live_detections'] = !error;
          }
        } catch (tblErr) {
          console.error(`Error deleting from ${t}:`, tblErr);
          results[t] = false;
        }
      }

      const recLabel = recorderId && recorderId !== 'All' ? ` (recorder ${recorderId})` : '';
      return NextResponse.json({
        success: true,
        message: `All detections for site "${resolvedSiteName}"${recLabel} were permanently deleted from observatory databases.`,
        results
      });
    }

    const table = tableParam;
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
    if (body) {
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
