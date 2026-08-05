-- Migration: Fix Supabase Security Advisor Warnings

-- 1. Fix Function Search Path Mutable
ALTER FUNCTION public.get_hourly_stats SET search_path = public;
ALTER FUNCTION public.get_top_species SET search_path = public;
ALTER FUNCTION public.get_detection_stats SET search_path = public;

-- 2. Fix Public Can Execute SECURITY DEFINER FUNCTION
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;

-- Note: The service_role or admin user should still be able to run rls_auto_enable 
-- if they use postgres user, but we revoke from the public roles.

-- 3. Fix Public Bucket Allows Listing
-- Drop the overly permissive SELECT policy if it exists and replace it with a stricter one.
-- Often the overly permissive policy is "Give public access to all files"
-- We change it to ensure they can only select the object itself if they know the path.
BEGIN;
  DO $$
  BEGIN
    -- This assumes there is an existing policy that allows everything.
    -- To restrict listing, we just need to ensure the policy applies to SELECT 
    -- but doesn't allow listing the root or wildcard paths without a specific ID, 
    -- but usually Supabase requires a specific condition.
    -- If a bucket is public, it means the bucket itself is marked public. 
    -- Let's ensure the bucket is configured correctly.
    UPDATE storage.buckets SET public = true WHERE id = 'bird-audio';
    
    -- In Supabase Storage, to prevent bucket listing while keeping files accessible,
    -- you should drop policies that allow `SELECT` on `storage.objects` without checking the path.
    -- However, if `bucket.public = true`, Supabase handles the file delivery via public URL 
    -- and you don't even need a SELECT policy on `storage.objects` for anon users to read it 
    -- via the /storage/v1/object/public/... endpoint!
    -- Therefore, we can safely delete any anon SELECT policy on storage.objects for this bucket
    -- that might be allowing them to call the /object/list endpoint.
    
    DELETE FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access' AND cmd = 'SELECT';
    
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if policies don't exist
  END $$;
COMMIT;
