-- ==============================================================================
-- BSO-005 & BSO-010: ROW LEVEL SECURITY (RLS) LOCKDOWN & ANON DELETE REVOCATION
-- ==============================================================================

-- 1. Drop overly permissive anonymous DELETE policies on detection tables
DROP POLICY IF EXISTS "Allow public delete on lantana_detections" ON public.lantana_detections;
DROP POLICY IF EXISTS "Allow public delete on pam_detections" ON public.pam_detections;
DROP POLICY IF EXISTS "Allow public delete on live_detections" ON public.live_detections;

-- 2. Lock down public.users so anonymous/client keys cannot read or modify user accounts or password_hash
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert on users" ON public.users;
DROP POLICY IF EXISTS "Allow public update on users" ON public.users;
DROP POLICY IF EXISTS "Allow public delete on users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;

REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.users FROM authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- 3. Restrict direct DELETE / UPDATE / INSERT on core tables from anon role
-- (All legitimate mutations go through authenticated Next.js /api/db/* and /api/live/admin routes using service_role)
REVOKE DELETE, UPDATE, INSERT ON TABLE public.pam_detections FROM anon;
REVOKE DELETE, UPDATE, INSERT ON TABLE public.lantana_detections FROM anon;
REVOKE DELETE ON TABLE public.live_detections FROM anon;
REVOKE DELETE, UPDATE, INSERT ON TABLE public.projects FROM anon;
REVOKE DELETE, UPDATE, INSERT ON TABLE public.sites FROM anon;
REVOKE DELETE, UPDATE, INSERT ON TABLE public.lantana_sites FROM anon;
REVOKE DELETE, UPDATE, INSERT ON TABLE public.sites_new FROM anon;
REVOKE DELETE, UPDATE, INSERT ON TABLE public.detections FROM anon;
REVOKE DELETE, UPDATE, INSERT ON TABLE public.detection_hourly_rollup FROM anon;

