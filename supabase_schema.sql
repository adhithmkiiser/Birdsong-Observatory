-- ==============================================================================
-- BIRDSONG OBSERVATORY - MASTER SUPABASE DATABASE SCHEMA
-- Permanently Structured Architecture for Live Recorders & PAM Offline Surveys
-- ==============================================================================

-- 1. USER DETAILS & ROLE-BASED ACCESS CONTROL
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT 'pass123',
  role TEXT NOT NULL DEFAULT 'Researcher' CHECK (role IN ('Admin', 'Project Manager', 'Site Manager', 'Researcher', 'Public')),
  organization TEXT DEFAULT 'IISER Tirupati',
  project_scope_permissions JSONB DEFAULT '[]'::jsonb,
  assigned_project_type TEXT DEFAULT 'Both',
  is_one_time_password BOOLEAN DEFAULT FALSE,
  must_change_password BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Safe migration: add missing columns if they don't already exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT 'pass123';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS assigned_project_type TEXT DEFAULT 'Both';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_one_time_password BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. LANTANA PAM OFFLINE SURVEY PROJECT TABLES

-- Migration: rename the legacy tst_* tables to lantana_* if they still exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tst_detections')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lantana_detections') THEN
    ALTER TABLE public.tst_detections RENAME TO lantana_detections;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tst_sites')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lantana_sites') THEN
    ALTER TABLE public.tst_sites RENAME TO lantana_sites;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tst_species_ecology')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lantana_species_ecology') THEN
    ALTER TABLE public.tst_species_ecology RENAME TO lantana_species_ecology;
  END IF;
END $$;

-- a) Lantana Detections Stream
CREATE TABLE IF NOT EXISTS public.lantana_detections (
  id BIGSERIAL PRIMARY KEY,
  site_name TEXT NOT NULL,
  date DATE,
  time TIME,
  start_time DOUBLE PRECISION,
  end_time DOUBLE PRECISION,
  common_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  threshold DOUBLE PRECISION DEFAULT 0.5,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.lantana_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on lantana_detections" ON public.lantana_detections FOR SELECT USING (true);

-- b) Lantana Site Metadata & Recording Telemetry
CREATE TABLE IF NOT EXISTS public.lantana_sites (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  recorder_id TEXT,
  elevation TEXT,
  habitat_type TEXT,
  expected_files INTEGER DEFAULT 0,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  number_of_files INTEGER DEFAULT 0,
  number_of_hours DOUBLE PRECISION DEFAULT 0.0,
  total_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.lantana_sites ADD COLUMN IF NOT EXISTS recorder_id TEXT;
ALTER TABLE public.lantana_sites ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE public.lantana_sites ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE public.lantana_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on lantana_sites" ON public.lantana_sites FOR SELECT USING (true);

-- c) Common PAM project sites (kept separate from Lantana sites)
CREATE TABLE IF NOT EXISTS public.sites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  elevation TEXT,
  status TEXT DEFAULT 'Active',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  habitat_type TEXT,
  expected_files INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on sites" ON public.sites FOR SELECT USING (true);

-- d) Species Ecology Matrix
CREATE TABLE IF NOT EXISTS public.lantana_species_ecology (
  scientific_name TEXT PRIMARY KEY,
  common_name TEXT NOT NULL,
  iucn_status TEXT DEFAULT 'LC',
  guild TEXT,
  habitat TEXT,
  foraging_stratum TEXT,
  endemic_status TEXT DEFAULT 'Non-endemic',
  audio_link TEXT,
  image_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.lantana_species_ecology ADD COLUMN IF NOT EXISTS indicator_group TEXT;
ALTER TABLE public.lantana_species_ecology ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on lantana_species_ecology" ON public.lantana_species_ecology FOR SELECT USING (true);

-- 3. COMMON PAM OFFLINE SURVEY DETECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.pam_detections (
  id BIGSERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  recorder_name TEXT NOT NULL,
  date DATE,
  time TIME,
  start_time DOUBLE PRECISION,
  end_time DOUBLE PRECISION,
  common_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  confidence DOUBLE PRECISION DEFAULT 0.5,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.pam_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on pam_detections" ON public.pam_detections FOR SELECT USING (true);

-- 4. REALTIME LIVE RECORDER TABLE
CREATE TABLE IF NOT EXISTS public.live_detections (
  id BIGSERIAL PRIMARY KEY,
  project_name TEXT DEFAULT 'Bird_Lab_demo',
  site_name TEXT DEFAULT 'Inside BirdLab',
  recorder_id TEXT NOT NULL DEFAULT 'Test_Lab_1',
  station_id TEXT,
  station_name TEXT,
  common_name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  date_str TEXT,
  time_str TEXT,
  duration DOUBLE PRECISION DEFAULT 3.0,
  audio_url TEXT,
  reviewed BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'YES', 'NO')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.live_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on live_detections" ON public.live_detections FOR SELECT USING (true);

-- 4b) Live Recorder Sites (kept separate from PAM sites)
CREATE TABLE IF NOT EXISTS public.live_sites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  elevation TEXT,
  habitat_type TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.live_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on live_sites" ON public.live_sites FOR SELECT USING (true);

-- 5. MASTER SCOPE REGISTRY TABLE (Connecting PAM vs Live Projects, Sites, and Recorders)
CREATE TABLE IF NOT EXISTS public.recorders_registry (
  id TEXT PRIMARY KEY,
  project_type TEXT NOT NULL CHECK (project_type IN ('PAM', 'Live')),
  project_name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  recorder_id TEXT NOT NULL,
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline')),
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  elevation TEXT,
  battery_level DOUBLE PRECISION DEFAULT 100.0,
  cpu_temperature DOUBLE PRECISION,
  storage_used_percent DOUBLE PRECISION,
  firmware_version TEXT DEFAULT 'v2.4',
  last_ping TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.recorders_registry ADD COLUMN IF NOT EXISTS elevation TEXT;
ALTER TABLE public.recorders_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on recorders_registry" ON public.recorders_registry FOR SELECT USING (true);

ALTER TABLE public.lantana_detections ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE public.lantana_detections ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE public.lantana_detections ADD COLUMN IF NOT EXISTS recorder_name TEXT;
ALTER TABLE public.lantana_detections ADD COLUMN IF NOT EXISTS recorder_id TEXT;

-- 6. PROJECTS DIRECTORY TABLE (PAM & Live Projects Registry)
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'PAM',
  description TEXT,
  organization TEXT DEFAULT 'IISER Tirupati',
  manager_id UUID REFERENCES public.users(id),
  manager_name TEXT,
  image_url TEXT,
  stations_count INTEGER DEFAULT 0,
  species_count INTEGER DEFAULT 0,
  total_detections INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_project_type_check;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on projects" ON public.projects FOR SELECT USING (true);

-- Migration: move existing projects off the legacy 'TST' scope onto 'Lantana'
UPDATE public.projects SET project_type = 'Lantana' WHERE project_type = 'TST';
