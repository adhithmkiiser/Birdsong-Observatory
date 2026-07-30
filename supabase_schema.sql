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
  is_one_time_password BOOLEAN DEFAULT FALSE,
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TST PAM OFFLINE SURVEY PROJECT TABLES

-- a) TST Detections Stream
CREATE TABLE IF NOT EXISTS public.tst_detections (
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

-- b) TST Site Metadata & Recording Telemetry
CREATE TABLE IF NOT EXISTS public.tst_sites (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  lat DOUBLE PRECISION,
  long DOUBLE PRECISION,
  number_of_files INTEGER DEFAULT 0,
  number_of_hours DOUBLE PRECISION DEFAULT 0.0,
  total_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- c) Species Ecology Matrix
CREATE TABLE IF NOT EXISTS public.tst_species_ecology (
  scientific_name TEXT PRIMARY KEY,
  common_name TEXT NOT NULL,
  iucn_status TEXT DEFAULT 'LC',
  guild TEXT,
  habitat TEXT,
  foraging_stratum TEXT,
  endemic_status TEXT DEFAULT 'Non-endemic',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
