  -- ==============================================================================
  -- PHASE 1: SUPABASE AUTH, PROFILES & ROW LEVEL SECURITY (RLS)
  -- ==============================================================================

  -- 1a. Profiles Table linked to Supabase Auth
  CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'Public' CHECK (role IN ('Admin', 'Project Manager', 'Site Manager', 'Researcher', 'Public')),
    organization TEXT DEFAULT 'IISER Tirupati',
    project_scope TEXT[] NOT NULL DEFAULT '{}'
  );

  -- Enable RLS on profiles
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Allow users to read own profile or Admin reads all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

  CREATE POLICY "Allow users to update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

  -- 1b. Add is_public column to projects
  ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

  -- Update known open research projects to public
  UPDATE public.projects SET is_public = true WHERE id IN ('nilgiri', 'tst_lantana', 'test');

  -- 1c. Security Helper Functions
  CREATE OR REPLACE FUNCTION public.has_project_access(p_project text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'Admin' OR p_project = ANY(project_scope))
    );
  $$;

  CREATE OR REPLACE FUNCTION public.project_is_public(p_project text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT COALESCE((SELECT is_public FROM public.projects WHERE id = p_project), false);
  $$;

  -- 1d. Enable RLS on all detection and telemetry tables
  ALTER TABLE public.pam_detections ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.lantana_detections ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.live_detections ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.lantana_sites ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.live_sites ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.recorders_registry ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.lantana_species_ecology ENABLE ROW LEVEL SECURITY;

  -- 1e. Controlled read policies
  -- Public projects and tables allow read when public
  CREATE POLICY "Public read on public projects"
    ON public.projects FOR SELECT
    USING (is_public = true OR auth.role() = 'authenticated');

  CREATE POLICY "Public read on species ecology"
    ON public.lantana_species_ecology FOR SELECT
    USING (true);

  -- Direct table access from anon is restricted; all dashboard aggregations execute via SECURITY DEFINER RPCs.
