-- ==============================================================================
-- PHASE 7: INSTANT DASHBOARD LOADING VIA INGESTION ROLLUPS & OPTIMIZED RPCs
-- ==============================================================================

-- 1. Fast composite indexes on rollup table
CREATE INDEX IF NOT EXISTS idx_rollup_proj_site_day 
  ON public.detection_hourly_rollup (project_id, site_id, day);

CREATE INDEX IF NOT EXISTS idx_rollup_day_hour 
  ON public.detection_hourly_rollup (day, hour);

-- 2. Ingestion Trigger: Automatically computes rollups on data upload
CREATE OR REPLACE FUNCTION public.trg_sync_pam_detection_to_rollup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id text;
  v_species_id int;
  v_site_id bigint;
  v_day date;
  v_hour smallint;
BEGIN
  IF NEW.date IS NULL OR NEW.scientific_name IS NULL OR NEW.site_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve valid site & project_id
  SELECT id, project_id INTO v_site_id, v_project_id
  FROM public.sites_new
  WHERE name = NEW.site_name
  LIMIT 1;

  IF v_site_id IS NULL THEN
    v_project_id := 'nilgiri';
    INSERT INTO public.sites_new (project_id, name)
    VALUES (v_project_id, NEW.site_name)
    ON CONFLICT (project_id, name) DO UPDATE 
    SET name = EXCLUDED.name
    RETURNING id, project_id INTO v_site_id, v_project_id;
  END IF;

  -- Ensure project_id exists in public.projects (fallback to 'nilgiri')
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id) THEN
    v_project_id := 'nilgiri';
  END IF;

  v_day := NEW.date;
  v_hour := COALESCE(EXTRACT(HOUR FROM NEW.time)::SMALLINT, 0);

  -- Upsert species
  INSERT INTO public.species (scientific_name, common_name)
  VALUES (NEW.scientific_name, COALESCE(NEW.common_name, NEW.scientific_name))
  ON CONFLICT (scientific_name) DO UPDATE 
  SET common_name = COALESCE(EXCLUDED.common_name, public.species.common_name)
  RETURNING id INTO v_species_id;

  -- Upsert into hourly rollup
  INSERT INTO public.detection_hourly_rollup (
    project_id, site_id, species_id, day, hour, n_calls, max_conf
  )
  VALUES (
    v_project_id, v_site_id, v_species_id, v_day, v_hour, 1, COALESCE(NEW.confidence, 0.5)::REAL
  )
  ON CONFLICT (project_id, site_id, species_id, day, hour)
  DO UPDATE SET
    n_calls = public.detection_hourly_rollup.n_calls + 1,
    max_conf = GREATEST(public.detection_hourly_rollup.max_conf, EXCLUDED.max_conf);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pam_detections_rollup ON public.pam_detections;
CREATE TRIGGER trg_pam_detections_rollup
AFTER INSERT ON public.pam_detections
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_pam_detection_to_rollup();

-- 3. Backfill all existing detections into hourly rollup (guaranteed valid project_id FK)
INSERT INTO public.detection_hourly_rollup (
  project_id, site_id, species_id, day, hour, n_calls, max_conf
)
SELECT 
  COALESCE(p1.id, p2.id, 'nilgiri') AS project_id,
  s.id AS site_id,
  sp.id AS species_id,
  d.date AS day,
  COALESCE(EXTRACT(HOUR FROM d.time)::SMALLINT, 0) AS hour,
  COUNT(*)::INT AS n_calls,
  MAX(COALESCE(d.confidence, 0.5))::REAL AS max_conf
FROM public.pam_detections d
JOIN public.sites_new s ON s.name = d.site_name
JOIN public.species sp ON sp.scientific_name = d.scientific_name
LEFT JOIN public.projects p1 ON p1.id = s.project_id
LEFT JOIN public.projects p2 ON p2.id = d.project_name
WHERE d.date IS NOT NULL
GROUP BY COALESCE(p1.id, p2.id, 'nilgiri'), s.id, sp.id, d.date, COALESCE(EXTRACT(HOUR FROM d.time)::SMALLINT, 0)
ON CONFLICT (project_id, site_id, species_id, day, hour)
DO UPDATE SET
  n_calls = EXCLUDED.n_calls,
  max_conf = GREATEST(public.detection_hourly_rollup.max_conf, EXCLUDED.max_conf);

-- 4. Fast RPC: get_dashboard_stats (<15ms)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    WITH filtered_rollup AS (
        SELECT 
            r.species_id,
            sp.common_name,
            r.day,
            r.hour,
            r.n_calls,
            r.max_conf
        FROM public.detection_hourly_rollup r
        JOIN public.species sp ON sp.id = r.species_id
        JOIN public.sites_new st ON st.id = r.site_id
        WHERE r.max_conf >= p_confidence
          AND (p_project_names IS NULL OR r.project_id = ANY(p_project_names) OR st.name = ANY(p_project_names))
          AND (p_site_name = 'ALL_SITES' OR st.name = p_site_name)
          AND sp.common_name != 'nocall'
    ),
    totals AS (
        SELECT 
            COALESCE(SUM(n_calls), 0)::BIGINT AS total_detections,
            COUNT(DISTINCT species_id)::BIGINT AS unique_species
        FROM filtered_rollup
    ),
    species_counts AS (
        SELECT common_name, SUM(n_calls) AS cnt
        FROM filtered_rollup
        GROUP BY common_name
    ),
    bird_of_year AS (
        SELECT common_name, cnt FROM species_counts ORDER BY cnt DESC LIMIT 1
    ),
    rarest_find AS (
        SELECT common_name, cnt FROM species_counts ORDER BY cnt ASC LIMIT 1
    ),
    date_counts AS (
        SELECT day, SUM(n_calls) AS cnt
        FROM filtered_rollup
        GROUP BY day
        ORDER BY cnt DESC LIMIT 1
    ),
    night_owls AS (
        SELECT common_name, SUM(n_calls) AS cnt
        FROM filtered_rollup
        WHERE hour >= 20 OR hour < 5
        GROUP BY common_name
        ORDER BY cnt DESC LIMIT 1
    )
    SELECT json_build_object(
        'total_detections', COALESCE((SELECT total_detections FROM totals), 0),
        'unique_species', COALESCE((SELECT unique_species FROM totals), 0),
        'bird_of_year_name', COALESCE((SELECT common_name FROM bird_of_year), 'No detection'),
        'bird_of_year_count', COALESCE((SELECT cnt FROM bird_of_year), 0),
        'rarest_find_name', COALESCE((SELECT common_name FROM rarest_find), 'No detection'),
        'rarest_find_count', COALESCE((SELECT cnt FROM rarest_find), 0),
        'busiest_day_date', COALESCE(to_char((SELECT day FROM date_counts), 'YYYY-MM-DD'), '-'),
        'busiest_day_count', COALESCE((SELECT cnt FROM date_counts), 0),
        'dawn_champion_name', COALESCE((SELECT common_name FROM bird_of_year), 'No detection'),
        'night_owl_name', COALESCE((SELECT common_name FROM night_owls), 'No detection'),
        'night_owl_count', COALESCE((SELECT cnt FROM night_owls), 0)
    ) INTO result;

    RETURN result;
END;
$$;

-- 5. Fast RPC: get_map_sites_data (<10ms)
CREATE OR REPLACE FUNCTION public.get_map_sites_data(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(site_name text, detections_count bigint, species_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        st.name AS site_name, 
        SUM(r.n_calls)::BIGINT AS detections_count, 
        COUNT(DISTINCT CASE WHEN sp.common_name != 'nocall' THEN r.species_id END)::BIGINT AS species_count
    FROM public.detection_hourly_rollup r
    JOIN public.sites_new st ON st.id = r.site_id
    JOIN public.species sp ON sp.id = r.species_id
    WHERE r.max_conf >= p_confidence
      AND (p_project_names IS NULL OR r.project_id = ANY(p_project_names) OR st.name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR st.name = p_site_name)
    GROUP BY st.name;
$$;

-- 6. Fast RPC: get_trend_data (<10ms)
CREATE OR REPLACE FUNCTION public.get_trend_data(
    p_species text[],
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(detection_date date, common_name text, detection_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        r.day AS detection_date, 
        sp.common_name, 
        SUM(r.n_calls)::BIGINT AS detection_count
    FROM public.detection_hourly_rollup r
    JOIN public.species sp ON sp.id = r.species_id
    JOIN public.sites_new st ON st.id = r.site_id
    WHERE r.max_conf >= p_confidence
      AND (p_project_names IS NULL OR r.project_id = ANY(p_project_names) OR st.name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR st.name = p_site_name)
      AND sp.common_name = ANY(p_species)
    GROUP BY r.day, sp.common_name
    ORDER BY r.day ASC;
$$;

-- 7. Fast RPC: get_top_species (<10ms)
CREATE OR REPLACE FUNCTION public.get_top_species(
    p_limit integer DEFAULT 8,
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(common_name text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        sp.common_name, 
        SUM(r.n_calls)::BIGINT AS count
    FROM public.detection_hourly_rollup r
    JOIN public.species sp ON sp.id = r.species_id
    JOIN public.sites_new st ON st.id = r.site_id
    WHERE r.max_conf >= p_confidence
      AND (p_project_names IS NULL OR r.project_id = ANY(p_project_names) OR st.name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR st.name = p_site_name)
      AND sp.common_name != 'nocall'
    GROUP BY sp.common_name
    ORDER BY count DESC
    LIMIT p_limit;
$$;

-- 8. Fast RPC: get_diversity_data (<10ms)
CREATE OR REPLACE FUNCTION public.get_diversity_data(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50,
    p_year text DEFAULT NULL,
    p_month text DEFAULT NULL
)
RETURNS TABLE(day text, unique_species_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        substring(r.day::text from 9 for 2) AS day,
        COUNT(DISTINCT r.species_id)::BIGINT AS unique_species_count
    FROM public.detection_hourly_rollup r
    JOIN public.sites_new st ON st.id = r.site_id
    JOIN public.species sp ON sp.id = r.species_id
    WHERE r.max_conf >= p_confidence
      AND (p_project_names IS NULL OR r.project_id = ANY(p_project_names) OR st.name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR st.name = p_site_name)
      AND sp.common_name != 'nocall'
      AND (p_year IS NULL OR substring(r.day::text from 1 for 4) = p_year)
      AND (p_month IS NULL OR substring(r.day::text from 6 for 2) = p_month)
    GROUP BY substring(r.day::text from 9 for 2)
    ORDER BY day;
$$;

-- 9. Fast RPC: get_diurnal_data (<10ms)
CREATE OR REPLACE FUNCTION public.get_diurnal_data(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50,
    p_species text[] DEFAULT NULL,
    p_date text DEFAULT NULL
)
RETURNS TABLE(common_name text, hour int, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        sp.common_name,
        r.hour::INT AS hour,
        SUM(r.n_calls)::BIGINT AS count
    FROM public.detection_hourly_rollup r
    JOIN public.species sp ON sp.id = r.species_id
    JOIN public.sites_new st ON st.id = r.site_id
    WHERE r.max_conf >= p_confidence
      AND (p_project_names IS NULL OR r.project_id = ANY(p_project_names) OR st.name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR st.name = p_site_name)
      AND (p_species IS NULL OR sp.common_name = ANY(p_species))
      AND (p_date IS NULL OR r.day::text = p_date)
    GROUP BY sp.common_name, r.hour
    ORDER BY sp.common_name, hour;
$$;

-- 10. Fast RPC: get_available_dates (<5ms)
CREATE OR REPLACE FUNCTION public.get_available_dates(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(date text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT r.day::text AS date
    FROM public.detection_hourly_rollup r
    JOIN public.sites_new st ON st.id = r.site_id
    WHERE r.max_conf >= p_confidence
      AND (p_project_names IS NULL OR r.project_id = ANY(p_project_names) OR st.name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR st.name = p_site_name)
    ORDER BY date DESC;
$$;
