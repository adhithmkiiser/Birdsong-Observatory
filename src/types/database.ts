export type UserRole = 'Admin' | 'Project Manager' | 'Site Manager' | 'Public';

export interface PublicVisibilitySettings {
  showUnverifiedDetections: boolean;
  allowAudioDownloads: boolean;
  showExactGPSCoordinates: boolean;
  showTelemetryMetrics: boolean;
  allowPublicReports: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  organization: string;
  assignedProject?: string;
  assignedSite?: string;
  assignedProjectType?: 'PAM' | 'Live' | 'Both'; // Admin assigned project type access
  status: 'active' | 'suspended' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  organization: string;
  manager_id: string;
  manager_name: string;
  project_type?: 'PAM' | 'Live'; // Project classification
  stations_count: number;
  species_count: number;
  total_detections: number;
  public_visible: boolean;
  created_at: string;
}

export interface Station {
  id: string;
  station_name: string;
  description: string;
  project_id: string;
  project_name: string;
  country: string;
  state: string;
  latitude: number;
  longitude: number;
  elevation: number;
  installation_date: string;
  firmware_version: string;
  birdnet_version: string;
  status: 'online' | 'offline' | 'maintenance' | 'idle';
  last_seen: string;
  battery_level: number;
  cpu_temperature: number;
  disk_usage: number;
  public_visible: boolean;
  created_at: string;
}

export interface Species {
  id: string;
  common_name: string;
  scientific_name: string;
  birdnet_label: string;
  iucn_status: 'Least Concern' | 'Near Threatened' | 'Vulnerable' | 'Endangered' | 'Critically Endangered' | 'Data Deficient';
  family: string;
  order: string;
  image_url: string;
}

export interface Detection {
  id: string;
  time: string;
  timestamp: string;
  common_name: string;
  scientific_name: string;
  confidence: number;
  station_id: string;
  station_name: string;
  project_name: string;
  audio_url: string;
  spectrogram_url?: string;
  verified: boolean;
  verifier_name?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  time: string;
  read: boolean;
}
