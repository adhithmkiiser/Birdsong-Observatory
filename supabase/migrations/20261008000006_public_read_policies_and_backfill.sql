-- ==============================================================================
-- PHASE 3e & 4: RLS READ POLICIES, BACKFILL & ROLLUP INITIALIZATION
-- ==============================================================================

-- 1. Add read policies on master reference tables
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on species" ON public.species;
CREATE POLICY "Allow public read on species" ON public.species FOR SELECT USING (true);

ALTER TABLE public.sites_new ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on sites_new" ON public.sites_new;
CREATE POLICY "Allow public read on sites_new" ON public.sites_new FOR SELECT USING (true);

ALTER TABLE public.detection_hourly_rollup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on detection_hourly_rollup" ON public.detection_hourly_rollup;
CREATE POLICY "Allow public read on detection_hourly_rollup" ON public.detection_hourly_rollup FOR SELECT USING (true);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on recordings" ON public.recordings;
CREATE POLICY "Allow public read on recordings" ON public.recordings FOR SELECT USING (true);

ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on detections" ON public.detections;
CREATE POLICY "Allow public read on detections" ON public.detections FOR SELECT USING (true);

-- 2. Seed Species Catalog from existing detections
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

-- 3. Populate Unified Sites Catalog
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

-- 4. Backfill Unified Detections from PAM Detections
INSERT INTO public.detections (
  project_id, site_id, species_id, detected_at, confidence, file_name, start_offset_s, source
)
SELECT 
  s.project_id,
  s.id AS site_id,
  sp.id AS species_id,
  (d.date + d.time) AT TIME ZONE 'Asia/Kolkata' AS detected_at,
  d.confidence::REAL,
  d.file_name,
  d.start_time::REAL AS start_offset_s,
  'pam' AS source
FROM public.pam_detections d
JOIN public.sites_new s ON s.name = d.site_name
JOIN public.species sp ON sp.scientific_name = d.scientific_name
WHERE d.date IS NOT NULL AND d.time IS NOT NULL
ON CONFLICT (site_id, species_id, detected_at, file_name, COALESCE(start_offset_s, 0)) DO NOTHING;

-- 5. Backfill Unified Detections from Lantana Detections
INSERT INTO public.detections (
  project_id, site_id, species_id, detected_at, confidence, file_name, start_offset_s, source
)
SELECT 
  s.project_id,
  s.id AS site_id,
  sp.id AS species_id,
  (d.date + d.time) AT TIME ZONE 'Asia/Kolkata' AS detected_at,
  COALESCE(d.threshold, 0.5)::REAL AS confidence,
  d.file_name,
  d.start_time::REAL AS start_offset_s,
  'lantana' AS source
FROM public.lantana_detections d
JOIN public.sites_new s ON s.name = d.site_name
JOIN public.species sp ON sp.scientific_name = d.scientific_name
WHERE d.date IS NOT NULL AND d.time IS NOT NULL
ON CONFLICT (site_id, species_id, detected_at, file_name, COALESCE(start_offset_s, 0)) DO NOTHING;

-- 6. Initialize Pre-Calculated Hourly Rollups for historical survey ranges
SELECT public.refresh_rollup('nilgiri', '2025-01-01', '2027-12-31');
SELECT public.refresh_rollup('tst_lantana', '2025-01-01', '2027-12-31');
