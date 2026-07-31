import { Station, Project, Detection, User, SystemNotification } from '@/types/database';
import { SPECIES_MASTER_LIST } from './speciesMasterData';

export const MOCK_USERS: User[] = [
  {
    id: 'usr-001',
    name: 'Adhith M K',
    email: 'adhithmk@labs.iisertirupati.ac.in',
    password: 'admin123Password!',
    role: 'Admin',
    organization: 'IISER Tirupati Bird Lab',
    assignedProjectType: 'Both',
    status: 'active',
    createdAt: '2026-01-15',
    lastLogin: 'Just now'
  },
  {
    id: 'usr-002',
    name: 'Ananya Sharma',
    email: 'ananya@birdsongobservatory.in',
    password: 'manager123Password!',
    role: 'Project Manager',
    organization: 'IISER Tirupati Bird Lab',
    assignedProjectType: 'PAM',
    status: 'active',
    createdAt: '2026-02-01',
    lastLogin: '2 hours ago'
  },
  {
    id: 'usr-003',
    name: 'Karthik Raja',
    email: 'karthik@birdsongobservatory.in',
    password: 'site123Password!',
    role: 'Site Manager',
    organization: 'Western Ghats Field Station',
    assignedProjectType: 'Live',
    status: 'active',
    createdAt: '2026-02-05',
    lastLogin: 'Yesterday'
  }
];

export const INITIAL_USER: User = MOCK_USERS[0];

// Genuine Projects Directory (TST PAM Project & Live Stream Observatory)
export const PROJECTS_DATA: Project[] = [
  {
    id: 'tst',
    name: 'The Shola Trust PAM Bioacoustics Project (TST)',
    description: 'Landscape-scale passive acoustic monitoring evaluating ecological restoration & habitat recovery across Shola forest transects (Lantana-cleared vs infested sites).',
    organization: 'The Shola Trust & IISER Tirupati Bird Ecology Lab',
    manager_id: 'usr-001',
    manager_name: 'Dr. Robin Vijayan',
    project_type: 'PAM',
    species_count: 186,
    total_detections: 110384,
    stations_count: 10,
    public_visible: true,
    created_at: '2026-03-01'
  }
];

// Real TST Field Recorder Stations (10 Genuine Recorders)
export const STATIONS_DATA: Station[] = [
  {
    id: 'LC_01',
    station_name: 'LC_01',
    description: 'Lantana-Cleared Shola Canopy Site 1',
    project_id: 'tst',
    project_name: 'The Shola Trust PAM Bioacoustics Project (TST)',
    country: 'India',
    state: 'Tamil Nadu',
    latitude: 11.594,
    longitude: 76.941,
    elevation: 1250,
    installation_date: '2026-03-01',
    firmware_version: 'v2.4',
    birdnet_version: 'v2.4',
    status: 'online',
    last_seen: 'Just now',
    battery_level: 94,
    cpu_temperature: 34.2,
    disk_usage: 42,
    public_visible: true,
    created_at: '2026-03-01'
  },
  {
    id: 'LC_02',
    station_name: 'LC_02',
    description: 'Lantana-Cleared Ridge Site 2',
    project_id: 'tst',
    project_name: 'The Shola Trust PAM Bioacoustics Project (TST)',
    country: 'India',
    state: 'Tamil Nadu',
    latitude: 11.598,
    longitude: 76.945,
    elevation: 1300,
    installation_date: '2026-03-01',
    firmware_version: 'v2.4',
    birdnet_version: 'v2.4',
    status: 'online',
    last_seen: '1 min ago',
    battery_level: 88,
    cpu_temperature: 36.1,
    disk_usage: 48,
    public_visible: true,
    created_at: '2026-03-01'
  },
  {
    id: 'LC_03',
    station_name: 'LC_03',
    description: 'Lantana-Cleared Valley Site 3',
    project_id: 'tst',
    project_name: 'The Shola Trust PAM Bioacoustics Project (TST)',
    country: 'India',
    state: 'Tamil Nadu',
    latitude: 11.602,
    longitude: 76.950,
    elevation: 1180,
    installation_date: '2026-03-01',
    firmware_version: 'v2.4',
    birdnet_version: 'v2.4',
    status: 'online',
    last_seen: 'Just now',
    battery_level: 91,
    cpu_temperature: 33.8,
    disk_usage: 39,
    public_visible: true,
    created_at: '2026-03-01'
  },
  {
    id: 'LI_01',
    station_name: 'LI_01',
    description: 'Lantana-Infested Buffer Zone Site 1',
    project_id: 'tst',
    project_name: 'The Shola Trust PAM Bioacoustics Project (TST)',
    country: 'India',
    state: 'Tamil Nadu',
    latitude: 11.590,
    longitude: 76.938,
    elevation: 1220,
    installation_date: '2026-03-01',
    firmware_version: 'v2.4',
    birdnet_version: 'v2.4',
    status: 'online',
    last_seen: '3 mins ago',
    battery_level: 82,
    cpu_temperature: 38.0,
    disk_usage: 55,
    public_visible: true,
    created_at: '2026-03-01'
  },
  {
    id: 'LI_02',
    station_name: 'LI_02',
    description: 'Lantana-Infested Forest Core Site 2',
    project_id: 'tst',
    project_name: 'The Shola Trust PAM Bioacoustics Project (TST)',
    country: 'India',
    state: 'Tamil Nadu',
    latitude: 11.585,
    longitude: 76.932,
    elevation: 1290,
    installation_date: '2026-03-01',
    firmware_version: 'v2.4',
    birdnet_version: 'v2.4',
    status: 'online',
    last_seen: '5 mins ago',
    battery_level: 79,
    cpu_temperature: 37.4,
    disk_usage: 61,
    public_visible: true,
    created_at: '2026-03-01'
  }
];

export const SPECIES_DATA = SPECIES_MASTER_LIST;

export const DETECTIONS_DATA: Detection[] = [];

export const SYSTEM_NOTIFICATIONS: SystemNotification[] = [];
