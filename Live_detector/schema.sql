-- ==============================================================================
-- BirdSong Observatory: Live Detector & Multi-Model Engine Database Schema
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. MODEL REGISTRY
-- Stores model metadata, storage paths, and input/output manifest configurations
create table if not exists models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text default 'v1.0',
  description text,
  runtime text check (runtime in ('birdnet_tflite', 'tflite', 'onnx')) not null,
  storage_path text not null,      -- Supabase storage: models/<id>/model.onnx
  labels_path text not null,       -- Supabase storage: models/<id>/labels.txt
  manifest jsonb not null default '{}'::jsonb, -- sample_rate, window_sec, n_mels, n_fft, hop_length, output_activation
  sha256 text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. NODE-MODEL ASSIGNMENTS
-- Maps which models run on which physical edge nodes with per-model confidence thresholds
create table if not exists node_models (
  node_id text not null,           -- Station name (e.g. 'WesternGhats_Node_01')
  model_id uuid references models(id) on delete cascade,
  enabled boolean default true,
  threshold real default 0.65,
  updated_at timestamptz default now(),
  primary key (node_id, model_id)
);

-- 3. WINDOW SUMMARIES & ACTIVE LEARNING TRIAGE
-- Stores physical DSP activity metrics, event counters, and triage flags per 3-second window
create table if not exists window_summaries (
  id uuid primary key default gen_random_uuid(),
  window_id text unique not null,              -- Unique window key: {station}_{timestamp}_{ms}
  node_id text not null,
  timestamp timestamptz not null,
  
  -- Classical DSP Activity Metrics
  event_count int default 0,                   -- Distinct spectro-temporal acoustic blobs
  occupied_area_ratio real default 0.0,        -- Fraction of time-frequency area above noise
  low_band_energy real default 0.0,            -- 150 - 1200 Hz (mammals/herpetofauna)
  mid_band_energy real default 0.0,            -- 1200 - 8000 Hz (avian vocal range)
  snr_db real default 0.0,                     -- Signal-to-noise ratio in dB
  is_ambient_noise boolean default false,      -- Rain / wind broadband flag
  
  -- Multi-Model Evaluation
  species_detected text[] default '{}',        -- Unique species detected across models
  model_count int default 0,                   -- Number of models evaluated
  explained_ratio real default 0.0,            -- Detected species area ÷ acoustic activity
  
  -- Discrepancy & Active Learning Flags
  -- e.g. ['UNDER_DETECTED', 'MODEL_DISAGREEMENT', 'BAND_MISMATCH', 'POSSIBLE_OVERLAP', 'UNCOVERED_TAXA', 'LOW_SNR']
  review_flags text[] default '{}',
  review_status text check (review_status in ('unreviewed', 'confirmed', 'corrected', 'discarded')) default 'unreviewed',
  
  -- Deduplicated Audio Clip Reference (shared across models)
  clip_path text,                              -- Supabase storage: clips/<window_id>.opus
  created_at timestamptz default now()
);

-- 4. SOLAR, BATTERY & HARDWARE TELEMETRY
-- Tracks solar powerbank voltage, battery level, CPU temp, and SD card space
create table if not exists station_telemetry (
  id bigserial primary key,
  node_id text not null,
  timestamp timestamptz not null,
  cpu_temp_c real,
  disk_free_gb real,
  disk_percent_free real,
  is_low_space boolean default false,
  battery_capacity_percent real,
  battery_voltage_v real,
  power_status text,                           -- e.g. 'Stable Solar Powerbank Supply', 'Low Voltage Warning'
  under_voltage_flag boolean default false,    -- True if powerbank dipped below 4.63V
  throttling_flag boolean default false,
  cpu_percent real,
  ram_percent real,
  uptime_hours real,
  created_at timestamptz default now()
);

-- Ensure all modern telemetry columns exist if table was previously created with older schema:
alter table if exists station_telemetry add column if not exists node_id text;
alter table if exists station_telemetry add column if not exists cpu_temp_c real;
alter table if exists station_telemetry add column if not exists disk_free_gb real;
alter table if exists station_telemetry add column if not exists disk_percent_free real;
alter table if exists station_telemetry add column if not exists is_low_space boolean default false;
alter table if exists station_telemetry add column if not exists battery_capacity_percent real;
alter table if exists station_telemetry add column if not exists battery_voltage_v real;
alter table if exists station_telemetry add column if not exists power_status text;
alter table if exists station_telemetry add column if not exists under_voltage_flag boolean default false;
alter table if exists station_telemetry add column if not exists throttling_flag boolean default false;
alter table if exists station_telemetry add column if not exists cpu_percent real;
alter table if exists station_telemetry add column if not exists ram_percent real;
alter table if exists station_telemetry add column if not exists uptime_hours real;

-- 5. ENHANCE EXISTING DETECTIONS TABLE
-- Links individual predictions to window_id and model_id for side-by-side comparison
alter table if exists detections add column if not exists model_id uuid references models(id);
alter table if exists detections add column if not exists window_id text;

-- 6. INDEXES FOR LIGHTNING FAST QUERIES
create index if not exists idx_detections_window_id on detections (window_id);
create index if not exists idx_detections_station_ts on detections (station_name, timestamp desc);
create index if not exists idx_window_summaries_flags on window_summaries using gin(review_flags);
create index if not exists idx_window_summaries_status on window_summaries (review_status, timestamp desc);
create index if not exists idx_station_telemetry_node_ts on station_telemetry (node_id, timestamp desc);

-- 7. SUPABASE STORAGE BUCKETS SETUP
-- Ensure 'models' and 'clips' buckets exist in Supabase Dashboard -> Storage
insert into storage.buckets (id, name, public) 
values ('models', 'models', true), ('clips', 'clips', true)
on conflict (id) do nothing;

-- 8. ROW LEVEL SECURITY & PUBLIC READ ACCESS POLICIES
alter table if exists public.station_telemetry enable row level security;
drop policy if exists "Allow public read on station_telemetry" on public.station_telemetry;
create policy "Allow public read on station_telemetry" on public.station_telemetry for select using (true);

alter table if exists public.models enable row level security;
drop policy if exists "Allow public read on models" on public.models;
create policy "Allow public read on models" on public.models for select using (true);

alter table if exists public.node_models enable row level security;
drop policy if exists "Allow public read on node_models" on public.node_models;
create policy "Allow public read on node_models" on public.node_models for select using (true);

alter table if exists public.window_summaries enable row level security;
drop policy if exists "Allow public read on window_summaries" on public.window_summaries;
create policy "Allow public read on window_summaries" on public.window_summaries for select using (true);

-- 9. DEFAULT MODEL SEED (BirdNET v2.4)
insert into public.models (id, name, version, description, runtime, storage_path, labels_path, manifest, is_active)
values (
  'ece0a4c8-5c85-475d-8001-79248995663b',
  'BirdNET-Pi v2.4 (Official)',
  'v2.4',
  'Default Cornell BirdNET acoustic classifier with geographic species filtering for Tirupati',
  'birdnet_tflite',
  'models/birdnet_default/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite',
  'models/birdnet_default/labels.txt',
  '{"target_sample_rate": 48000, "window_sec": 3.0, "use_geo_filter": true, "input_type": "raw_waveform", "output_activation": "sigmoid"}'::jsonb,
  true
)
on conflict (id) do nothing;

