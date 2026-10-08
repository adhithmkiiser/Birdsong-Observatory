# Birdsong Observatory — Master Backend Architecture, Security & Optimization Roadmap

## Overview
This roadmap establishes enterprise-grade database security, sub-millisecond query performance, a unified relational data model, automated aggregation rollups, and hardware telemetry tracking across the Birdsong Observatory platform.

---

## Phase 1: Security & Access Control (First Priority)
- [ ] **1a. Supabase Auth & Profiles Table**
  - Create `public.profiles` referencing `auth.users(id)` with `role`, `organization`, and `project_scope text[]`.
  - Link frontend `RoleContext.tsx` to native Supabase session auth.
- [ ] **1b. Row Level Security (RLS) Enforcement**
  - Enable RLS across all tables (`pam_detections`, `lantana_detections`, `live_detections`, `sites`, `lantana_sites`, `live_sites`, `recorders_registry`, `projects`, `profiles`).
  - Add `is_public boolean default false` to `public.projects`.
  - Create access helper functions: `public.has_project_access(p_project text)` and `public.project_is_public(p_project text)`.
- [ ] **1c. Secure RPC Stored Procedures**
  - Guard all 7 aggregation RPCs with `SECURITY DEFINER` and permission checks (`if not (project_is_public(p_project) or has_project_access(p_project)) then raise exception 'Access denied'; end if;`).
- [ ] **1d. Server-Side Admin Ingestion Verification**
  - Ensure service-role key is never exposed to the client.
  - Authenticate all batch upload API routes with server-side role validation.
- [ ] **1e. Hardware Node Authentication**
  - Issue secret tokens for live IoT nodes; store only sha256 hashes in `recorders_registry`.

---

## Phase 2: High-Performance Database Indexing
- [ ] **2a. Composite Index Creation**
  - `idx_pam_proj_site_date` on `public.pam_detections(project_name, site_name, date)`
  - `idx_pam_species_date` on `public.pam_detections(scientific_name, date)`
  - `idx_lantana_site_date` on `public.lantana_detections(site_name, date)`
  - `idx_lantana_species_date` on `public.lantana_detections(scientific_name, date)`
  - `idx_live_proj_timestamp` on `public.live_detections(project_name, timestamp)`
- [ ] **2b. Query Plan Optimization & Analyze**
  - Run `EXPLAIN (ANALYZE, BUFFERS)` on slow queries and eliminate sequential table scans.
- [ ] **2c. Dynamic Caching for Overview Metrics**
  - Implement fast caching for homepage and dashboard summary stats.

---

## Phase 3: Unified Relational Data Model
- [ ] **3a. Master Species Taxonomy (`public.species`)**
  - Create `public.species (id serial primary key, scientific_name unique, common_name, ebird_code)`.
  - Re-key `lantana_species_ecology` to reference `species_id`.
- [ ] **3b. Unified Monitoring Stations (`public.sites_new`)**
  - Unify `sites`, `lantana_sites`, and `live_sites` into `public.sites_new` with `project_id`, `name`, `latitude`, `longitude`, `elevation`, `habitat_type`.
- [ ] **3c. Unified Detections Table (`public.detections`)**
  - Create `public.detections (id, project_id, site_id, species_id, detected_at timestamptz, confidence, file_name, source)`.
- [ ] **3d. Indian Standard Time (`Asia/Kolkata`) Unification**
  - Store all detection timestamps as `timestamptz` in IST (`Asia/Kolkata`).
- [ ] **3e. Zero-Data-Loss Backfill Pipeline**
  - Migrate all 821,000+ detection records with mismatch verification scripts.
- [ ] **3f. Staging & Idempotent Ingestion Pipeline**
  - Unique index `uq_detection` on `(site_id, species_id, detected_at, file_name)` with `ON CONFLICT DO NOTHING`.

---

## Phase 4: Hourly Pre-Counted Rollups
- [ ] **4a. Rollup Table (`public.detection_hourly_rollup`)**
  - Store pre-counted hourly bins `(project_id, site_id, species_id, day, hour, n_calls, max_conf)`.
- [ ] **4b. Automated Rollup Refresh Function (`public.refresh_rollup`)**
  - Rebuild rollups per project date range upon data upload.
- [ ] **4c. Point RPCs to Rollup Table**
  - Switch `get_species_hour_matrix`, `get_trend_data`, `get_diurnal_data`, `get_diversity_data`, `get_map_sites_data`, and `get_dashboard_stats` to query the rollup table for sub-millisecond response times.

---

## Phase 5: Survey Effort & Recording Logs
- [ ] **5a. Audio Recordings Table (`public.recordings`)**
  - Track total audio effort, including silent recordings with 0 detections.
- [ ] **5b. Deployments Log (`public.deployments`)**
  - Record deployment intervals (`deployed_at`, `retrieved_at`) per logger.
- [ ] **5c. Effort Metrics**
  - Calculate calls per recorded hour for normalized ecological comparisons.

---

## Phase 6: Telemetry & Partitioned Live Stream
- [ ] **6a. Time-Series Telemetry Table (`public.recorder_telemetry`)**
  - Log battery level, CPU temperature, and disk usage over time.
  - Create `recorder_status` view computing live online/offline status from 15-minute ping thresholds.
- [ ] **6b. Range Partitioned Live Detections**
  - Partition `public.live_detections` by monthly ranges (`partition by range (timestamp)`).
