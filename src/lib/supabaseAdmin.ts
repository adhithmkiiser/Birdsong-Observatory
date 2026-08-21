import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ktihcjfxxxazohimtiav.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI2MDU4NiwiZXhwIjoyMTAwODM2NTg2fQ.idvkAZGKVtilS0NJ4PD9Lw9T__xz_10oAHLnoyIdZnA';

// This client has admin privileges and bypasses Row-Level Security.
// Never expose this on the client-side.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
