const { createClient } = require('@supabase/supabase-js');

const url = 'https://ktihcjfxxxazohimtiav.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4';
const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase
    .from('live_detections')
    .select('recorder_id, project_name, site_name')
    .limit(1000);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  const counts = {};
  (data || []).forEach((d) => {
    const key = `${d.project_name || 'Unknown'} / ${d.site_name || 'Unknown'} / ${d.recorder_id || 'Unknown'}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  console.log('Live detections by recorder:');
  Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([key, count]) => {
      console.log(`${count.toString().padStart(4, ' ')}  ${key}`);
    });
})();
