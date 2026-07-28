import { supabase } from './supabaseClient';
import { User, Project, Station, Detection, Species } from '@/types/database';

// ============================================================
// 1. USER ACCOUNTS, AUTH & LOGINS
// ============================================================

export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveUserRecord(user: Partial<User>) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      password_hash: user.password ? user.password : undefined,
      role: user.role,
      organization: user.organization,
      assigned_project_type: user.assignedProjectType,
      status: user.status || 'active'
    })
    .select();
  if (error) throw error;
  return data[0];
}

export async function recordUserLoginAudit(userId: string, email: string) {
  const { error } = await supabase
    .from('user_logins')
    .insert({
      user_id: userId,
      email: email,
      login_time: new Date().toISOString(),
      status: 'success'
    });
  if (error) console.error('Error logging audit:', error);
}

// ============================================================
// 2. PROJECTS & FIELD SITES DIRECTORY
// ============================================================

export async function fetchProjectsList() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createProjectRecord(project: Partial<Project>) {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: project.id,
      name: project.name,
      description: project.description,
      organization: project.organization,
      manager_id: project.manager_id,
      manager_name: project.manager_name,
      project_type: project.project_type || 'PAM',
      stations_count: project.stations_count || 0,
      species_count: project.species_count || 0,
      total_detections: project.total_detections || 0
    })
    .select();
  if (error) throw error;
  return data[0];
}

export async function registerSiteNode(site: Partial<Station>) {
  const { data, error } = await supabase
    .from('sites')
    .upsert({
      id: site.id,
      project_id: site.project_id,
      name: site.station_name,
      elevation: site.elevation ? `${site.elevation}m` : '1,200m',
      status: site.status || 'Active',
      latitude: site.latitude,
      longitude: site.longitude
    })
    .select();
  if (error) throw error;
  return data[0];
}

// ============================================================
// 3. TST & PAM DATASETS (HISTORICAL CSV & SPECIES MATRIX)
// ============================================================

export async function uploadPamBatchCsv(projectId: string, siteId: string, filename: string, recordCount: number) {
  const { data, error } = await supabase
    .from('pam_batch_files')
    .insert({
      project_id: projectId,
      site_id: siteId,
      filename: filename,
      record_count: recordCount,
      status: 'processed'
    })
    .select();
  if (error) throw error;
  return data[0];
}

// ============================================================
// 4. LIVE RECORDER DETECTIONS & AUDIO CLIPS
// ============================================================

export async function fetchLiveDetections(limit = 50) {
  const { data, error } = await supabase
    .from('live_detections')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function insertLiveDetectionRecord(detection: Partial<Detection>) {
  const { data, error } = await supabase
    .from('live_detections')
    .insert({
      station_name: detection.station_name,
      timestamp: detection.timestamp || new Date().toISOString(),
      time_str: detection.time,
      common_name: detection.common_name,
      scientific_name: detection.scientific_name,
      confidence: detection.confidence,
      audio_url: detection.audio_url,
      spectrogram_url: detection.spectrogram_url,
      verified: detection.verified || false
    })
    .select();
  if (error) throw error;
  return data[0];
}

export async function uploadLiveAudioClip(file: File, remotePath: string) {
  const { data, error } = await supabase.storage
    .from('birdnet-audio')
    .upload(remotePath, file, {
      contentType: 'audio/wav',
      upsert: true
    });
  if (error) throw error;
  
  const { data: publicUrlData } = supabase.storage
    .from('birdnet-audio')
    .getPublicUrl(remotePath);

  return publicUrlData.publicUrl;
}
