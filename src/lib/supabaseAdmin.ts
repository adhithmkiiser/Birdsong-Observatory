import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ktihcjfxxxazohimtiav.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Set it in .env.local or deployment settings.');
}

// This client has admin privileges and bypasses Row-Level Security.
// Never expose this on the client-side.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key');
