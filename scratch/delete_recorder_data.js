const { createClient } = require('@supabase/supabase-js');

const url = 'https://ktihcjfxxxazohimtiav.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4';
const supabase = createClient(url, key);

const RECORDER_ID = process.argv[2];

if (!RECORDER_ID) {
  console.error('Usage: node delete_recorder_data.js <recorder_id>');
  process.exit(1);
}

(async () => {
  console.log(`Deleting data for recorder: ${RECORDER_ID}`);

  const { data: dets, error: e1 } = await supabase
    .from('live_detections')
    .select('audio_url')
    .eq('recorder_id', RECORDER_ID);

  if (e1) {
    console.error('Failed to select live_detections:', e1);
    process.exit(1);
  }

  const audioPaths = (dets || [])
    .map(d => d.audio_url)
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u).pathname.replace('/storage/v1/object/public/bird-audio/', '');
      } catch {
        return '';
      }
    })
    .filter(Boolean);

  console.log(`Found ${dets?.length || 0} detections, ${audioPaths.length} audio files`);

  if (audioPaths.length > 0) {
    const { error: e2 } = await supabase.storage.from('bird-audio').remove(audioPaths);
    if (e2) {
      console.error('Failed to delete audio files:', e2);
    } else {
      console.log(`Deleted ${audioPaths.length} audio files`);
    }
  }

  const { error: e3 } = await supabase
    .from('live_detections')
    .delete()
    .eq('recorder_id', RECORDER_ID);

  if (e3) {
    console.error('Failed to delete live_detections:', e3);
  } else {
    console.log('Deleted live_detections rows');
  }

  const { error: e4 } = await supabase
    .from('recorders_registry')
    .delete()
    .eq('recorder_id', RECORDER_ID);

  if (e4) {
    console.error('Failed to delete recorders_registry:', e4);
  } else {
    console.log('Deleted recorders_registry row');
  }
})();
