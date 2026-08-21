-- ==============================================================================
-- BIRDSONG OBSERVATORY - DASHBOARD AGGREGATION RPCs
-- Run this script in your Supabase SQL Editor to enable server-side aggregations.
-- ==============================================================================

-- 1. get_dashboard_stats
-- Returns overall statistics for the dashboard based on filters
CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    WITH filtered_detections AS (
        SELECT common_name, date, time
        FROM public.pam_detections
        WHERE confidence >= p_confidence
          AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
          AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
          AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
    ),
    totals AS (
        SELECT 
            count(*) as total_detections,
            count(DISTINCT CASE WHEN common_name != 'nocall' THEN common_name END) as unique_species
        FROM filtered_detections
    ),
    species_counts AS (
        SELECT common_name, count(*) as cnt
        FROM filtered_detections
        WHERE common_name != 'nocall'
        GROUP BY common_name
    ),
    bird_of_year AS (
        SELECT common_name, cnt FROM species_counts ORDER BY cnt DESC LIMIT 1
    ),
    rarest_find AS (
        SELECT common_name, cnt FROM species_counts ORDER BY cnt ASC LIMIT 1
    ),
    date_counts AS (
        SELECT date, count(*) as cnt
        FROM filtered_detections
        WHERE date IS NOT NULL
        GROUP BY date
        ORDER BY cnt DESC LIMIT 1
    ),
    dawn_champion AS (
        SELECT common_name FROM bird_of_year -- Simplified logic: most common bird is dawn champion
    ),
    night_owls AS (
        SELECT common_name, count(*) as cnt
        FROM filtered_detections
        WHERE time IS NOT NULL AND (extract(hour from time) >= 20 OR extract(hour from time) < 5)
        AND common_name != 'nocall'
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
        'busiest_day_date', COALESCE(to_char((SELECT date FROM date_counts), 'YYYY-MM-DD'), '-'),
        'busiest_day_count', COALESCE((SELECT cnt FROM date_counts), 0),
        'dawn_champion_name', COALESCE((SELECT common_name FROM dawn_champion), 'No detection'),
        'night_owl_name', COALESCE((SELECT common_name FROM night_owls), 'No detection'),
        'night_owl_count', COALESCE((SELECT cnt FROM night_owls), 0)
    ) INTO result;

    RETURN result;
END;
$$;

-- 2. get_map_sites_data
-- Returns detection and species counts grouped by site
CREATE OR REPLACE FUNCTION get_map_sites_data(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(site_name text, detections_count bigint, species_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        site_name, 
        count(*) as detections_count, 
        count(DISTINCT CASE WHEN common_name != 'nocall' THEN common_name END) as species_count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
    GROUP BY site_name;
$$;

-- 3. get_trend_data
-- Returns daily counts for given species over the last 30 days of data
CREATE OR REPLACE FUNCTION get_trend_data(
    p_species text[],
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(detection_date date, common_name text, detection_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT date as detection_date, common_name, count(*) as detection_count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
      AND common_name = ANY(p_species)
      AND date IS NOT NULL
    GROUP BY date, common_name
    ORDER BY date ASC;
$$;

-- 4. get_top_species
-- Returns the most common species to auto-populate charts
CREATE OR REPLACE FUNCTION get_top_species(
    p_limit integer DEFAULT 8,
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(common_name text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT common_name, count(*) as count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
      AND common_name != 'nocall'
    GROUP BY common_name
    ORDER BY count DESC
    LIMIT p_limit;
$$;

-- 4. get_diversity_data
CREATE OR REPLACE FUNCTION get_diversity_data(
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
AS $$
    SELECT 
        substring(date::text from 9 for 2) as day,
        count(distinct common_name) as unique_species_count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
      AND common_name != 'nocall'
      AND (p_year IS NULL OR substring(date::text from 1 for 4) = p_year)
      AND (p_month IS NULL OR substring(date::text from 6 for 2) = p_month)
    GROUP BY substring(date::text from 9 for 2)
    ORDER BY day;
$$;

-- 5. get_diurnal_data
CREATE OR REPLACE FUNCTION get_diurnal_data(
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
AS $$
    SELECT 
        common_name,
        extract(hour from time)::int as hour,
        count(*) as count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
      AND (p_species IS NULL OR common_name = ANY(p_species))
      AND (p_date IS NULL OR date::text = p_date)
    GROUP BY common_name, extract(hour from time)::int
    ORDER BY common_name, hour;
$$;

-- 6. get_monthly_abundance
CREATE OR REPLACE FUNCTION get_monthly_abundance(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(month text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        substring(date::text from 1 for 7) as month,
        count(*) as count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
    GROUP BY substring(date::text from 1 for 7)
    ORDER BY month;
$$;

-- 7. get_radial_activity
CREATE OR REPLACE FUNCTION get_radial_activity(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50,
    p_date text DEFAULT NULL
)
RETURNS TABLE(hour int, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        extract(hour from time)::int as hour,
        count(*) as count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
      AND (p_date IS NULL OR date::text = p_date)
    GROUP BY extract(hour from time)::int
    ORDER BY hour;
$$;

-- 8. get_species_hour_matrix
CREATE OR REPLACE FUNCTION get_species_hour_matrix(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(common_name text, hour int, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        common_name,
        extract(hour from time)::int as hour,
        count(*) as count
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
      AND common_name != 'nocall'
    GROUP BY common_name, extract(hour from time)::int
    ORDER BY common_name, hour;
$$;

-- 9. get_available_dates
CREATE OR REPLACE FUNCTION get_available_dates(
    p_project_names text[] DEFAULT NULL,
    p_site_name text DEFAULT 'ALL_SITES',
    p_recorder_name text DEFAULT 'ALL_RECORDERS',
    p_confidence double precision DEFAULT 0.50
)
RETURNS TABLE(date text)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT distinct date::text as date
    FROM public.pam_detections
    WHERE confidence >= p_confidence
      AND (p_project_names IS NULL OR project_name = ANY(p_project_names))
      AND (p_site_name = 'ALL_SITES' OR site_name = p_site_name)
      AND (p_recorder_name = 'ALL_RECORDERS' OR recorder_name = p_recorder_name)
      AND date IS NOT NULL
    ORDER BY date::text DESC;
$$;
