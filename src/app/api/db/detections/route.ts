import { NextRequest, NextResponse } from 'next/server';
import { authGuard, escapePostgrestValue, canUserManageProject, canUserManageSite } from '@/lib/authGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveSiteEntities, resolveRecorderAliases, normalizeStationCode } from '@/lib/siteResolver';

const ALLOWED_TABLES = ['pam_detections', 'lantana_detections', 'live_detections', 'recorders_registry', 'detections', 'detection_hourly_rollup'];

// POST: Insert array of detections
export async function POST(req: NextRequest) {
  const { user, error: authError } = await authGuard(req, ['Admin', 'Project Manager']);
  if (authError || !user) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { table, records } = body;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table specified' }, { status: 400 });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Records must be a non-empty array' }, { status: 400 });
    }

    if (user.role !== 'Admin') {
      const sample = records[0] || {};
      const targetProj =
        sample.project_id ||
        sample.project_name ||
        (table === 'lantana_detections' ? 'tst_lantana' : table === 'pam_detections' ? 'nilgiri' : table === 'live_detections' ? 'test' : '');
      if (targetProj && !canUserManageProject(user, targetProj)) {
        return NextResponse.json({ error: 'Unauthorized to insert detections into this project' }, { status: 403 });
      }
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

    // 1. DELETE ALL FOR SITE / RECORDER / PROJECT (across all related tables or specified table)
    if (body?.deleteAllForSite || body?.deleteAllForProject) {
      const payload = body.deleteAllForSite || body.deleteAllForProject;
      const { 
        siteName, 
        siteId, 
        recorderId, 
        projectName, 
        projectId, 
        table: targetTableParam 
      } = payload;

      const isAllSites = siteName === 'ALL_SITES' || siteId === 'ALL_SITES' || !!body.deleteAllForProject;

      if (!siteName && !siteId && !projectId && !projectName) {
        return NextResponse.json({ error: 'siteName, siteId, projectId, or projectName is required' }, { status: 400 });
      }

      // Authorization checks for non-admins
      if (user.role === 'Site Manager') {
        if (isAllSites) {
          return NextResponse.json({ error: 'Site Managers are not authorized to delete all project detections' }, { status: 403 });
        }
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

      const resolvedProjectId = projectId || (
        projectName === 'Studying The Role of Climate in Bird Species Distribution' || projectName === 'nilgiri' ? 'nilgiri' :
        projectName === 'Gudalur' || projectName === 'nbr' ? 'nbr' :
        projectName === 'tst_lantana' || (projectName && projectName.toLowerCase().includes('lantana')) ? 'tst_lantana' :
        undefined
      );
      const resolvedSiteName = siteName || siteId;
      const targetTable = targetTableParam || tableParam || 'all';
      const tablesToClean = (targetTable === 'all')
        ? ['pam_detections', 'lantana_detections', 'live_detections', 'detections', 'detection_hourly_rollup']
        : [targetTable];

      const results: Record<string, boolean> = {};

      // ── Project-Wide Deletion (All Sites in Project) ────────────────────────
      if (isAllSites) {
        // Fetch all site names & ids for this project from sites and sites_new
        let siteNames: string[] = [];
        let siteNewIds: number[] = [];
        if (resolvedProjectId) {
          const [sRes, snRes] = await Promise.all([
            supabaseAdmin.from('sites').select('name').eq('project_id', resolvedProjectId),
            supabaseAdmin.from('sites_new').select('id, name').eq('project_id', resolvedProjectId)
          ]);
          siteNames = Array.from(new Set([
            ...(sRes.data || []).map((s: any) => s.name),
            ...(snRes.data || []).map((s: any) => s.name)
          ]));
          siteNewIds = (snRes.data || []).map((s: any) => s.id);
        }

        for (const t of tablesToClean) {
          try {
            if (t === 'pam_detections') {
              if (resolvedProjectId === 'nilgiri' || siteNames.length > 0 || targetTable === 'pam_detections') {
                if (siteNames.length > 0) {
                  const { error } = await supabaseAdmin
                    .from('pam_detections')
                    .delete()
                    .in('site_name', siteNames);
                  if (error) console.error(`Error deleting project sites from pam_detections:`, error);
                } else {
                  const { error } = await supabaseAdmin.from('pam_detections').delete().gt('id', 0);
                  if (error) throw new Error(`Failed to delete pam_detections: ${error.message}`);
                }
                results['pam_detections'] = true;
              } else {
                results['pam_detections'] = true;
              }
            } else if (t === 'detection_hourly_rollup') {
              let q = supabaseAdmin.from('detection_hourly_rollup').delete();
              if (resolvedProjectId) {
                q = q.eq('project_id', resolvedProjectId);
              } else if (siteNewIds.length > 0) {
                q = q.in('site_id', siteNewIds);
              }
              const { error } = await q;
              if (error) console.error('Error deleting project from detection_hourly_rollup:', error);
              results['detection_hourly_rollup'] = !error;
            } else if (t === 'detections') {
              let q = supabaseAdmin.from('detections').delete();
              if (resolvedProjectId) {
                q = q.eq('project_id', resolvedProjectId);
              } else if (siteNewIds.length > 0) {
                q = q.in('site_id', siteNewIds);
              }
              const { error } = await q;
              if (error) console.error('Error deleting project from detections:', error);
              results['detections'] = !error;
            } else if (t === 'lantana_detections') {
              if (resolvedProjectId === 'tst_lantana' || resolvedProjectId?.includes('lantana') || targetTable === 'lantana_detections') {
                let q = supabaseAdmin.from('lantana_detections').delete();
                if (resolvedProjectId) {
                  q = q.eq('project_id', resolvedProjectId);
                } else if (projectName) {
                  q = q.eq('project_name', projectName);
                }
                const { error } = await q;
                if (error) console.error('Error deleting project from lantana_detections:', error);
                results['lantana_detections'] = !error;
              } else {
                results['lantana_detections'] = true;
              }
            } else if (t === 'live_detections') {
              let q = supabaseAdmin.from('live_detections').delete();
              if (resolvedProjectId) {
                q = q.eq('project_id', resolvedProjectId);
              } else if (projectName) {
                q = q.eq('project_name', projectName);
              }
              const { error } = await q;
              if (error) console.error('Error deleting project from live_detections:', error);
              results['live_detections'] = !error;
            }
          } catch (tblErr) {
            console.error(`Error deleting project detections from ${t}:`, tblErr);
            results[t] = false;
          }
        }

        return NextResponse.json({
          success: true,
          message: `All detections for project "${projectName || resolvedProjectId || 'Selected Project'}" were permanently deleted from observatory databases.`,
          results
        });
      }

      // ── Specific Site / Recorder Deletion ──────────────────────────────────
      const safeSiteName = siteName ? escapePostgrestValue(siteName) : '';
      const safeSiteId = siteId ? escapePostgrestValue(siteId) : '';
      const safeResolvedSiteName = resolvedSiteName ? escapePostgrestValue(resolvedSiteName) : '';
      const safeRecorderId = recorderId ? escapePostgrestValue(recorderId) : '';

      // Robustly resolve all candidate site names, station codes, and sites_new IDs
      const {
        matchedSiteNewIds,
        candidateSiteNames
      } = await resolveSiteEntities({
        siteName,
        siteId,
        projectId: resolvedProjectId
      });

      const candidateRecorderNames = resolveRecorderAliases(recorderId);

      for (const t of tablesToClean) {
        try {
          if (t === 'pam_detections') {
            let q = supabaseAdmin.from('pam_detections').delete();
            if (candidateSiteNames.length > 0) {
              q = q.in('site_name', candidateSiteNames);
            } else if (siteName && siteId && siteName !== siteId) {
              q = q.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}",project_name.eq."${safeSiteName}",project_name.eq."${safeSiteId}"`);
            } else {
              q = q.or(`site_name.eq."${safeResolvedSiteName}",project_name.eq."${safeResolvedSiteName}"`);
            }

            if (candidateRecorderNames.length > 0) {
              q = q.in('recorder_name', candidateRecorderNames);
            } else if (recorderId && recorderId !== 'All' && recorderId !== 'ALL_RECORDERS') {
              q = q.eq('recorder_name', recorderId);
            }

            const { error: pamErr } = await q;
            if (pamErr) {
              console.error('Error deleting from pam_detections:', pamErr);
              throw new Error(`Failed to delete from pam_detections: ${pamErr.message}`);
            }
            results['pam_detections'] = true;
          } else if (t === 'detection_hourly_rollup') {
            if (matchedSiteNewIds.length > 0) {
              // Check if remaining detections exist for this site (e.g. if only 1 recorder was deleted)
              let hasRemainingDetections = false;
              if (candidateRecorderNames.length > 0 || (recorderId && recorderId !== 'All' && recorderId !== 'ALL_RECORDERS')) {
                const { count: remCount } = await supabaseAdmin
                  .from('pam_detections')
                  .select('id', { count: 'exact', head: true })
                  .in('site_name', candidateSiteNames);
                hasRemainingDetections = (remCount || 0) > 0;
              }

              // Always delete existing rollup rows for matched site_ids
              const { error } = await supabaseAdmin
                .from('detection_hourly_rollup')
                .delete()
                .in('site_id', matchedSiteNewIds);
              if (error) console.error('Error deleting from detection_hourly_rollup:', error);

              // If remaining detections still exist for other recorders at this site, re-aggregate into rollup
              if (hasRemainingDetections) {
                try {
                  const { data: remDets } = await supabaseAdmin
                    .from('pam_detections')
                    .select('date, time, scientific_name, confidence')
                    .in('site_name', candidateSiteNames)
                    .not('date', 'is', null);

                  if (remDets && remDets.length > 0) {
                    const siteIdToUse = matchedSiteNewIds[0];
                    const projIdToUse = resolvedProjectId || 'nilgiri';

                    const rollupMap = new Map<string, { n_calls: number; max_conf: number; species_name: string; day: string; hour: number }>();
                    for (const d of remDets) {
                      const day = d.date;
                      const hour = d.time ? parseInt(String(d.time).split(':')[0] || '0', 10) : 0;
                      const key = `${day}_${hour}_${d.scientific_name}`;
                      const conf = Number(d.confidence) || 0.5;
                      if (!rollupMap.has(key)) {
                        rollupMap.set(key, { n_calls: 1, max_conf: conf, species_name: d.scientific_name, day, hour });
                      } else {
                        const existing = rollupMap.get(key)!;
                        existing.n_calls += 1;
                        if (conf > existing.max_conf) existing.max_conf = conf;
                      }
                    }

                    const specNames = Array.from(new Set(Array.from(rollupMap.values()).map(r => r.species_name)));
                    const { data: dbSpecies } = await supabaseAdmin
                      .from('species')
                      .select('id, scientific_name')
                      .in('scientific_name', specNames);
                    const spMap = new Map((dbSpecies || []).map((sp: any) => [sp.scientific_name, sp.id]));

                    const newRollupRows: any[] = [];
                    for (const r of Array.from(rollupMap.values())) {
                      const spId = spMap.get(r.species_name);
                      if (spId) {
                        newRollupRows.push({
                          project_id: projIdToUse,
                          site_id: siteIdToUse,
                          species_id: spId,
                          day: r.day,
                          hour: r.hour,
                          n_calls: r.n_calls,
                          max_conf: r.max_conf
                        });
                      }
                    }

                    for (let i = 0; i < newRollupRows.length; i += 500) {
                      await supabaseAdmin
                        .from('detection_hourly_rollup')
                        .upsert(newRollupRows.slice(i, i + 500), { onConflict: 'project_id,site_id,species_id,day,hour' });
                    }
                  }
                } catch (rebuildErr) {
                  console.warn('Could not re-aggregate remaining site detections into rollup:', rebuildErr);
                }
              }

              results['detection_hourly_rollup'] = !error;
            } else {
              results['detection_hourly_rollup'] = true;
            }
          } else if (t === 'detections') {
            if (matchedSiteNewIds.length > 0) {
              const { error } = await supabaseAdmin
                .from('detections')
                .delete()
                .in('site_id', matchedSiteNewIds);
              if (error) console.error('Error deleting from detections:', error);
              results['detections'] = !error;
            } else {
              results['detections'] = true;
            }
          } else if (t === 'lantana_detections') {
            let q = supabaseAdmin.from('lantana_detections').delete();
            if (candidateSiteNames.length > 0) {
              q = q.in('site_name', candidateSiteNames);
            } else if (siteName && siteId && siteName !== siteId) {
              q = q.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}"`);
            } else {
              q = q.eq('site_name', resolvedSiteName);
            }

            if (candidateRecorderNames.length > 0) {
              q = q.in('recorder_id', candidateRecorderNames);
            } else if (recorderId && recorderId !== 'All' && recorderId !== 'ALL_RECORDERS') {
              q = q.or(`recorder_id.eq."${safeRecorderId}",recorder_name.eq."${safeRecorderId}"`);
            }
            if (resolvedProjectId || projectId) {
              q = q.eq('project_id', resolvedProjectId || projectId);
            }
            const { error } = await q;
            if (error) console.error('Error deleting from lantana_detections:', error);
            results['lantana_detections'] = !error;
          } else if (t === 'live_detections') {
            // Collect audio URLs if any to clean storage
            let selQ = supabaseAdmin.from('live_detections').select('audio_url');
            if (candidateSiteNames.length > 0) {
              selQ = selQ.in('site_name', candidateSiteNames);
            } else if (siteName && siteId && siteName !== siteId) {
              selQ = selQ.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}",station_name.eq."${safeSiteName}"`);
            } else {
              selQ = selQ.or(`site_name.eq."${safeResolvedSiteName}",station_name.eq."${safeResolvedSiteName}"`);
            }
            if (candidateRecorderNames.length > 0) {
              selQ = selQ.in('recorder_id', candidateRecorderNames);
            } else if (recorderId && recorderId !== 'All' && recorderId !== 'ALL_RECORDERS') {
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
            if (candidateSiteNames.length > 0) {
              q = q.in('site_name', candidateSiteNames);
            } else if (siteName && siteId && siteName !== siteId) {
              q = q.or(`site_name.eq."${safeSiteName}",site_name.eq."${safeSiteId}",station_name.eq."${safeSiteName}"`);
            } else {
              q = q.or(`site_name.eq."${safeResolvedSiteName}",station_name.eq."${safeResolvedSiteName}"`);
            }
            if (candidateRecorderNames.length > 0) {
              q = q.in('recorder_id', candidateRecorderNames);
            } else if (recorderId && recorderId !== 'All' && recorderId !== 'ALL_RECORDERS') {
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

      const recLabel = recorderId && recorderId !== 'All' && recorderId !== 'ALL_RECORDERS' ? ` (recorder ${recorderId})` : '';
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

    // Verify table/project ownership for non-Admins before single/batch/project/node deletion
    if (user.role !== 'Admin') {
      const defaultProjForTable =
        table === 'lantana_detections' ? 'tst_lantana' :
        table === 'live_detections' ? 'test' :
        table === 'pam_detections' ? 'nilgiri' : '';
      const requestedProj = body?.deleteByProject?.projectId || body?.deleteByProject?.projectName || body?.deleteByNode?.projectName || defaultProjForTable;
      if (requestedProj && !canUserManageProject(user, requestedProj)) {
        return NextResponse.json({ error: 'Unauthorized to delete detections for this project' }, { status: 403 });
      }
      if (user.role === 'Site Manager' && body?.deleteByProject) {
        return NextResponse.json({ error: 'Site Managers cannot delete entire project detections' }, { status: 403 });
      }
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
        if (table === 'pam_detections') {
          // pam_detections doesn't have project_id column
          if (projectId) {
            const { data: pSites } = await supabaseAdmin.from('sites_new').select('name').eq('project_id', projectId);
            const names = (pSites || []).map((s: any) => s.name);
            if (names.length > 0) query = query.in('site_name', names);
            else query = query.gt('id', 0);
          } else {
            query = query.gt('id', 0);
          }
        } else {
          if (projectId) query = query.eq('project_id', projectId);
          else if (projectName) query = query.eq('project_name', projectName);
        }
        
        const { error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true });
      } else if (body.deleteByNode) {
        const { recorderId, projectName } = body.deleteByNode;
        let query = supabaseAdmin.from(table).delete();
        if (table === 'pam_detections') {
          query = query.eq('recorder_name', recorderId);
        } else {
          query = query.eq('recorder_id', recorderId);
          if (projectName) query = query.eq('project_name', projectName);
        }
        const { error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Missing deletion criteria' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
