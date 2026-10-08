-- ==============================================================================
-- PHASE 2: HIGH-PERFORMANCE DATABASE INDEXING & QUERY OPTIMIZATION
-- Run in Supabase SQL Editor for sub-millisecond aggregation throughput
-- ==============================================================================

-- 2a. Composite indexes for PAM detections table (403k+ rows)
CREATE INDEX IF NOT EXISTS idx_pam_proj_site_date
  ON public.pam_detections (project_name, site_name, date);

CREATE INDEX IF NOT EXISTS idx_pam_species_date
  ON public.pam_detections (common_name, date);

CREATE INDEX IF NOT EXISTS idx_pam_confidence_proj
  ON public.pam_detections (confidence, project_name);

-- 2b. Composite indexes for Lantana detections table (418k+ rows)
CREATE INDEX IF NOT EXISTS idx_lantana_site_date
  ON public.lantana_detections (site_name, date);

CREATE INDEX IF NOT EXISTS idx_lantana_species_date
  ON public.lantana_detections (common_name, date);

CREATE INDEX IF NOT EXISTS idx_lantana_threshold_site
  ON public.lantana_detections (threshold, site_name);

-- 2c. Composite indexes for Live detections table
CREATE INDEX IF NOT EXISTS idx_live_proj_timestamp
  ON public.live_detections (project_name, timestamp DESC);

-- Refresh planner statistics
ANALYZE public.pam_detections;
ANALYZE public.lantana_detections;
ANALYZE public.live_detections;
ANALYZE public.sites;
ANALYZE public.lantana_sites;
ANALYZE public.projects;
