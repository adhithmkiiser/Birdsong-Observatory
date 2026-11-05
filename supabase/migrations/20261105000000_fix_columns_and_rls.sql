-- ==============================================================================
-- BIRDSONG OBSERVATORY - SCHEMA FIX: COLUMNS & POLICIES
-- Adds missing columns (public_visible, lat, long, latitude, longitude, recorder_id)
-- and ensures station_telemetry public read RLS policy
-- ==============================================================================

-- 1. Ensure `public_visible` column exists on `projects`
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_visible BOOLEAN DEFAULT TRUE;

-- 2. Ensure both lat/long and latitude/longitude exist on `recorders_registry`
ALTER TABLE public.recorders_registry ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.recorders_registry ADD COLUMN IF NOT EXISTS long DOUBLE PRECISION;
ALTER TABLE public.recorders_registry ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.recorders_registry ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.recorders_registry ADD COLUMN IF NOT EXISTS storage_used_percent DOUBLE PRECISION;

-- 3. Backfill latitude/longitude from lat/long if populated
UPDATE public.recorders_registry SET latitude = lat WHERE latitude IS NULL AND lat IS NOT NULL;
UPDATE public.recorders_registry SET longitude = long WHERE longitude IS NULL AND long IS NOT NULL;
UPDATE public.recorders_registry SET lat = latitude WHERE lat IS NULL AND latitude IS NOT NULL;
UPDATE public.recorders_registry SET long = longitude WHERE long IS NULL AND longitude IS NOT NULL;

-- 4. Ensure station_telemetry table has public read RLS policy
ALTER TABLE public.station_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on station_telemetry" ON public.station_telemetry;
CREATE POLICY "Allow public read on station_telemetry" ON public.station_telemetry FOR SELECT USING (true);

-- 5. Ensure sites table supports recorder_id for multi-recorder deployment per site
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS recorder_id TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS long DOUBLE PRECISION;
