-- ==============================================================================
-- PHASE 5: SURVEY RECORDINGS & DEPLOYMENT EFFORT TRACKING
-- PHASE 6: TIME-SERIES TELEMETRY & PARTITIONED LIVE STREAMS
-- ==============================================================================

-- 5a. Audio Recordings Effort Table (Captures both active and silent recordings)
CREATE TABLE IF NOT EXISTS public.recordings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES public.sites_new(id) ON DELETE CASCADE,
  recorder_id TEXT,
  file_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  duration_s INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('Asia/Kolkata', now()),
  UNIQUE (recorder_id, file_name)
);

-- 5b. Deployments Log
CREATE TABLE IF NOT EXISTS public.deployments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorder_id TEXT NOT NULL,
  site_id BIGINT NOT NULL REFERENCES public.sites_new(id) ON DELETE CASCADE,
  deployed_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('Asia/Kolkata', now())
);

-- 5c. Daily Effort View
CREATE OR REPLACE VIEW public.effort_daily AS
SELECT 
  site_id,
  (started_at AT TIME ZONE 'Asia/Kolkata')::DATE AS day,
  COUNT(*) AS total_files_recorded,
  ROUND((SUM(duration_s) / 3600.0)::NUMERIC, 2) AS hours_recorded
FROM public.recordings
GROUP BY site_id, (started_at AT TIME ZONE 'Asia/Kolkata')::DATE;

-- 6a. Time-Series Telemetry Table
CREATE TABLE IF NOT EXISTS public.recorder_telemetry (
  recorder_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  battery_level REAL,
  cpu_temperature REAL,
  storage_used_percent REAL,
  PRIMARY KEY (recorder_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_rec_time 
  ON public.recorder_telemetry (recorder_id, recorded_at DESC);

-- Dynamic Status View (Live online/offline from 15-minute ping window)
CREATE OR REPLACE VIEW public.recorder_status AS
SELECT DISTINCT ON (recorder_id)
  recorder_id,
  recorded_at AS last_ping,
  battery_level,
  cpu_temperature,
  storage_used_percent,
  CASE 
    WHEN recorded_at > now() - INTERVAL '15 minutes' THEN 'online' 
    ELSE 'offline' 
  END AS status
FROM public.recorder_telemetry
ORDER BY recorder_id, recorded_at DESC;
