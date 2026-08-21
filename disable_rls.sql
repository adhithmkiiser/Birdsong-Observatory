-- Disable RLS on all tables since the application uses a custom frontend authentication system (RoleContext)
-- instead of Supabase Auth. This allows the anon key to perform necessary CRUD operations.

ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lantana_sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pam_detections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lantana_detections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lantana_species_ecology DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
