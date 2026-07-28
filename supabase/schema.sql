-- Wildlife Acoustic Monitoring Platform Database Schema (Supabase / PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. STATIONS TABLE
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_name VARCHAR(255),
    country VARCHAR(100) DEFAULT 'India',
    state VARCHAR(100) DEFAULT 'Karnataka',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    elevation INT DEFAULT 0,
    installation_date DATE DEFAULT CURRENT_DATE,
    firmware_version VARCHAR(50) DEFAULT 'v2.4.1',
    birdnet_version VARCHAR(50) DEFAULT 'BirdNET V2.4',
    status VARCHAR(50) DEFAULT 'online' CHECK (status IN ('online', 'idle', 'offline')),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    battery_level INT DEFAULT 100 CHECK (battery_level BETWEEN 0 AND 100),
    cpu_temperature DECIMAL(5,2) DEFAULT 42.5,
    disk_usage INT DEFAULT 35 CHECK (disk_usage BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SPECIES TABLE
CREATE TABLE IF NOT EXISTS species (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    common_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255) NOT NULL UNIQUE,
    family VARCHAR(255),
    "order" VARCHAR(255),
    genus VARCHAR(255),
    iucn_status VARCHAR(50) DEFAULT 'Least Concern' CHECK (iucn_status IN ('Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered', 'Data Deficient')),
    birdnet_label VARCHAR(255),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. USERS / PROFILES TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Researcher', 'Viewer')),
    organization VARCHAR(255) DEFAULT 'IISER Tirupati Bird Lab',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. DETECTIONS TABLE
CREATE TABLE IF NOT EXISTS detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    common_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255) NOT NULL,
    species_id UUID REFERENCES species(id) ON DELETE SET NULL,
    confidence DECIMAL(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    audio_path TEXT NOT NULL,
    spectrogram_path TEXT NOT NULL,
    duration DECIMAL(6, 2) DEFAULT 3.0,
    reviewed BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_detections_timestamp ON detections (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_detections_station_id ON detections (station_id);
CREATE INDEX IF NOT EXISTS idx_detections_common_name ON detections (common_name);
CREATE INDEX IF NOT EXISTS idx_detections_confidence ON detections (confidence);
CREATE INDEX IF NOT EXISTS idx_detections_verified ON detections (verified);
CREATE INDEX IF NOT EXISTS idx_stations_status ON stations (status);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE species ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE detections ENABLE ROW LEVEL SECURITY;

-- POLICIES (READ ALL FOR AUTHENTICATED/PUBLIC VIEWERS)
CREATE POLICY "Allow public read on projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow public read on stations" ON stations FOR SELECT USING (true);
CREATE POLICY "Allow public read on species" ON species FOR SELECT USING (true);
CREATE POLICY "Allow public read on detections" ON detections FOR SELECT USING (true);

-- ADMIN & RESEARCHER POLICIES FOR DETECTIONS
CREATE POLICY "Allow researchers and admins to update detections" ON detections
FOR UPDATE USING (
  auth.jwt() ->> 'role' IN ('Admin', 'Researcher') OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Admin', 'Researcher'))
);

CREATE POLICY "Allow admins to delete detections" ON detections
FOR DELETE USING (
  auth.jwt() ->> 'role' = 'Admin' OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
);

-- REALTIME PUBLICATION SETUP
ALTER PUBLICATION supabase_realtime ADD TABLE detections;
ALTER PUBLICATION supabase_realtime ADD TABLE stations;
