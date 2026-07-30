const { createClient } = require('@supabase/supabase-js');

let url = "https://ktihcjfxxxazohimtiav.supabase.co";
let key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4";

const supabase = createClient(url, key);

async function checkTables() {
  console.log("Checking existing tables in Supabase...");
  const { data: users, error: err1 } = await supabase.from('users').select('count', { count: 'exact' });
  const { data: liveDets, error: err2 } = await supabase.from('live_detections').select('count', { count: 'exact' });
  const { data: registry, error: err3 } = await supabase.from('recorders_registry').select('count', { count: 'exact' });
  
  console.log("Users count:", users);
  console.log("Live Detections count:", liveDets);
  console.log("Registry count:", registry);
}

checkTables();
