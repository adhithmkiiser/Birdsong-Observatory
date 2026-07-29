-- ============================================================
-- BIRDSONG OBSERVATORY SUPABASE DATABASE SCHEMA (SAFE RUN)
-- Handles existing tables, RLS policies, and Realtime publications
-- ============================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization TEXT DEFAULT 'IISER Tirupati Bird Lab',
  manager_id TEXT,
  manager_name TEXT,
  project_type TEXT DEFAULT 'PAM',
  stations_count INT DEFAULT 0,
  species_count INT DEFAULT 0,
  total_detections INT DEFAULT 0,
  public_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sites Directory Table
CREATE TABLE IF NOT EXISTS public.sites (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  elevation TEXT DEFAULT '1,200m',
  status TEXT DEFAULT 'Active',
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  habitat_type TEXT,
  expected_files INT DEFAULT 48,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Live Detections Table
CREATE TABLE IF NOT EXISTS public.live_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id TEXT,
  station_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_str TEXT,
  time_str TEXT,
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  confidence NUMERIC(5,4) NOT NULL,
  audio_url TEXT,
  spectrogram_url TEXT,
  duration NUMERIC(4,2) DEFAULT 3.0,
  reviewed BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  verifier_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Species Ecology Table
CREATE TABLE IF NOT EXISTS public.species (
  id TEXT PRIMARY KEY,
  common_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  birdnet_label TEXT UNIQUE NOT NULL,
  iucn_status TEXT DEFAULT 'Least Concern',
  family TEXT,
  order_name TEXT,
  foraging_guild TEXT,
  foraging_stratum TEXT,
  vocal_activity TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Users Directory Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT 'pass123',
  role TEXT NOT NULL DEFAULT 'Site Manager',
  organization TEXT DEFAULT 'IISER Tirupati Bird Lab',
  assigned_project_type TEXT DEFAULT 'Both',
  status TEXT DEFAULT 'active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Stations / Hardware Telemetry Table
CREATE TABLE IF NOT EXISTS public.stations (
  id TEXT PRIMARY KEY,
  station_name TEXT NOT NULL UNIQUE,
  description TEXT,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name TEXT,
  country TEXT DEFAULT 'India',
  state TEXT DEFAULT 'Karnataka',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  elevation INT DEFAULT 0,
  installation_date DATE DEFAULT CURRENT_DATE,
  firmware_version TEXT DEFAULT 'v2.4.1',
  birdnet_version TEXT DEFAULT 'BirdNET V2.4',
  status TEXT DEFAULT 'online',
  last_seen TEXT DEFAULT 'Just now',
  battery_level INT DEFAULT 100,
  cpu_temperature NUMERIC(5,2) DEFAULT 42.5,
  storage_used_percent INT DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely Add Realtime Publication (Prevents duplicate relation error)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'live_detections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_detections;
  END IF;
END $$;

-- Disable Row Level Security (RLS) for seamless development
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_detections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.species DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations DISABLE ROW LEVEL SECURITY;

-- Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('birdnet-audio', 'birdnet-audio', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('observatory-data', 'observatory-data', true)
ON CONFLICT (id) DO NOTHING;
