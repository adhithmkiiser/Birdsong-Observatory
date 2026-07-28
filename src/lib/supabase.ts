import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo-birdnet-cloud.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Realtime hook helper for subscribing to new BirdNET acoustic detections.
 */
export function subscribeToNewDetections(onNewDetection: (payload: any) => void) {
  const channel = supabase
    .channel('realtime_detections')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'detections' }, (payload) => {
      onNewDetection(payload.new);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Realtime hook helper for station telemetry updates.
 */
export function subscribeToStationHealth(onStationUpdate: (payload: any) => void) {
  const channel = supabase
    .channel('realtime_stations')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stations' }, (payload) => {
      onStationUpdate(payload.new);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
