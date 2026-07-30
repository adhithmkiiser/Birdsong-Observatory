const { createClient } = require('@supabase/supabase-js');

const url = "https://ktihcjfxxxazohimtiav.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4";

const supabase = createClient(url, key);

async function cleanLiveDetections() {
  console.log('Cleaning TST records out of live_detections table...');
  const { data, error } = await supabase
    .from('live_detections')
    .delete()
    .or('station_id.ilike.str_%,station_name.ilike.TST%');

  if (error) {
    console.error('Error cleaning live_detections:', error);
  } else {
    console.log('Successfully cleaned TST records from live_detections table!');
  }
}

cleanLiveDetections();
