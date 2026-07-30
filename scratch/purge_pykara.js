const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let url = "https://ktihcjfxxxazohimtiav.supabase.co";
let key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4";

const supabase = createClient(url, key);

async function purgePykara() {
  console.log('Purging Pykara and non-Live records from live_detections table...');
  const { data, error } = await supabase
    .from('live_detections')
    .delete()
    .or('station_name.ilike.Pykara%,station_name.ilike.TST%,station_id.ilike.str_%');

  if (error) {
    console.error('Error purging:', error);
  } else {
    console.log('Successfully purged Pykara & non-Live rows from live_detections!');
  }
}

purgePykara();
