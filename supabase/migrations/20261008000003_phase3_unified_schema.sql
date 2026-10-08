-- ==============================================================================
-- PHASE 3: UNIFIED RELATIONAL DATA MODEL & BACKFILL
-- ==============================================================================

-- 3a. Master Species Taxonomy Catalog
CREATE TABLE IF NOT EXISTS public.species (
  id SERIAL PRIMARY KEY,
  scientific_name TEXT UNIQUE NOT NULL,
  common_name TEXT NOT NULL,
  ebird_code TEXT,
  taxonomy_version TEXT DEFAULT 'Clements_v2023',
  created_at TIMESTAMPTZ DEFAULT timezone('Asia/Kolkata', now())
);

-- Seed species from existing detection datasets
INSERT INTO public.species (scientific_name, common_name)
SELECT scientific_name, min(common_name)
FROM (
  SELECT scientific_name, common_name FROM public.pam_detections WHERE scientific_name IS NOT NULL AND common_name IS NOT NULL
  UNION ALL
  SELECT scientific_name, common_name FROM public.lantana_detections WHERE scientific_name IS NOT NULL AND common_name IS NOT NULL
  UNION ALL
  SELECT scientific_name, common_name FROM public.live_detections WHERE scientific_name IS NOT NULL AND common_name IS NOT NULL
) s
GROUP BY scientific_name
ON CONFLICT (scientific_name) DO UPDATE 
SET common_name = EXCLUDED.common_name;

-- 3b. Unified Monitoring Stations Table
CREATE TABLE IF NOT EXISTS public.sites_new (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  elevation REAL,
  habitat_type TEXT,        -- LC / LI / CS for Lantana, NULL for standard PAM
  recorder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('Asia/Kolkata', now()),
  UNIQUE (project_id, name)
);

-- Populate sites_new from existing sites table (PAM)
INSERT INTO public.sites_new (project_id, name, latitude, longitude, elevation, habitat_type, recorder_id)
SELECT 
  project_id, 
  name, 
  latitude, 
  longitude, 
  CASE WHEN elevation ~ '^[0-9]+(\.[0-9]+)?$' THEN elevation::REAL ELSE NULL END, 
  habitat_type, 
  NULL
FROM public.sites
ON CONFLICT (project_id, name) DO NOTHING;

-- Populate sites_new from existing lantana_sites table
INSERT INTO public.sites_new (project_id, name, latitude, longitude, elevation, habitat_type, recorder_id)
SELECT 
  COALESCE(project_id, 'tst_lantana'), 
  site_name, 
  lat, 
  long, 
  NULL::REAL AS elevation, 
  CASE 
    WHEN UPPER(site_name) LIKE 'LC%' OR UPPER(recorder_id) LIKE 'LC%' THEN 'LC'
    WHEN UPPER(site_name) LIKE 'LI%' OR UPPER(recorder_id) LIKE 'LI%' THEN 'LI'
    WHEN UPPER(site_name) LIKE 'CS%' OR UPPER(recorder_id) LIKE 'CS%' THEN 'CS'
    ELSE NULL 
  END AS habitat_type, 
  recorder_id
FROM public.lantana_sites
ON CONFLICT (project_id, name) DO NOTHING;

-- 3c. Unified Detections Table
CREATE TABLE IF NOT EXISTS public.detections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_id BIGINT NOT NULL REFERENCES public.sites_new(id) ON DELETE CASCADE,
  species_id INT NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL,
  confidence REAL NOT NULL,
  file_name TEXT,
  start_offset_s REAL,
  source TEXT NOT NULL CHECK (source IN ('pam', 'lantana', 'live')),
  created_at TIMESTAMPTZ DEFAULT timezone('Asia/Kolkata', now())
);

-- 3d. Unique Ingest Index for Idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_detection
  ON public.detections (site_id, species_id, detected_at, file_name, COALESCE(start_offset_s, 0));

-- 3e. Unified Indexes for Sub-Millisecond Aggregations
CREATE INDEX IF NOT EXISTS idx_detections_proj_site_time 
  ON public.detections (project_id, site_id, detected_at);

CREATE INDEX IF NOT EXISTS idx_detections_proj_species_time 
  ON public.detections (project_id, species_id, detected_at);
