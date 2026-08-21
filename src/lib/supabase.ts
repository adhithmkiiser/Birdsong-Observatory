import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ktihcjfxxxazohimtiav.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Realtime hook helper for subscribing to new Live BirdNET acoustic detections.
 */
export function subscribeToLiveDetections(onNewDetection: (payload: any) => void) {
  const channel = supabase
    .channel('realtime_live_detections')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_detections' }, (payload) => {
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
    .channel('realtime_recorders_registry')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recorders_registry' }, (payload) => {
      onStationUpdate(payload.new);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
