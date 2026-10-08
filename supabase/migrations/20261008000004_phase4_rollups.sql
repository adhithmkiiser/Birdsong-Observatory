-- ==============================================================================
-- PHASE 4: PRE-CALCULATED HOURLY ROLLUPS & REFRESH STORED PROCEDURE
-- ==============================================================================

-- 4a. Rollup Table
CREATE TABLE IF NOT EXISTS public.detection_hourly_rollup (
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_id BIGINT NOT NULL REFERENCES public.sites_new(id) ON DELETE CASCADE,
  species_id INT NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  hour SMALLINT NOT NULL,
  n_calls INT NOT NULL DEFAULT 0,
  max_conf REAL,
  PRIMARY KEY (project_id, site_id, species_id, day, hour)
);

CREATE INDEX IF NOT EXISTS idx_rollup_proj_day 
  ON public.detection_hourly_rollup (project_id, day);

CREATE INDEX IF NOT EXISTS idx_rollup_proj_species 
  ON public.detection_hourly_rollup (project_id, species_id, day);

-- 4b. Automated Rollup Refresh Function
CREATE OR REPLACE FUNCTION public.refresh_rollup(
  p_project text, 
  p_from date, 
  p_to date
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  -- Clear existing range to allow idempotent updates
  DELETE FROM public.detection_hourly_rollup
  WHERE project_id = p_project 
    AND day BETWEEN p_from AND p_to;

  -- Re-aggregate hourly bins
  INSERT INTO public.detection_hourly_rollup (
    project_id, site_id, species_id, day, hour, n_calls, max_conf
  )
  SELECT 
    project_id, 
    site_id, 
    species_id,
    (detected_at AT TIME ZONE 'Asia/Kolkata')::DATE AS day,
    EXTRACT(HOUR FROM detected_at AT TIME ZONE 'Asia/Kolkata')::SMALLINT AS hour,
    COUNT(*)::INT AS n_calls, 
    MAX(confidence)::REAL AS max_conf
  FROM public.detections
  WHERE project_id = p_project
    AND (detected_at AT TIME ZONE 'Asia/Kolkata')::DATE BETWEEN p_from AND p_to
  GROUP BY project_id, site_id, species_id, day, hour;
END;
$$;
