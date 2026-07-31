# Comprehensive Website Analysis Report
## Birdsong Observatory Platform & PAM Bioacoustics Hub

---

## 1. PROJECT OVERVIEW

**Project Name:** Birdsong Observatory Platform & PAM Bioacoustics Hub  
**Organization:** IISER Tirupati Bird Ecology Lab  
**Primary Purpose:** A continuous, landscape-scale bioacoustic monitoring platform for biodiversity, avian community tracking, and ecological restoration evaluation across South Asian ecosystems (Western Ghats, Sheshachalam Biosphere Reserve, and Shola forest transects).

**Core Functionality:**
- Real-time bird species detection using AI-powered acoustic monitoring
- Live recording field nodes with cloud synchronization
- Passive Acoustic Monitoring (PAM) offline survey data processing
- Interactive dashboards for ecological data visualization
- Multi-user role-based access control system
- GIS mapping and spatial analysis of detection data

---

## 2. ARCHITECTURE & TECH STACK

### Frontend Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.6.2
- **UI Library:** React 18.3.1
- **Styling:** Tailwind CSS 3.4.12
- **Icons:** Lucide React 0.439.0
- **Charts:** Recharts 2.12.7, ECharts 6.1.0
- **Maps:** Leaflet 1.9.4, React-Leaflet 4.2.1
- **Animations:** Framer Motion 11.5.4
- **State Management:** React Context API

### Backend Stack
- **Cloud Platform:** Supabase (PostgreSQL + Storage + Realtime)
- **Database:** PostgreSQL with custom schema
- **Storage:** Supabase Storage for audio files and spectrograms
- **Real-time:** Supabase Realtime subscriptions
- **Authentication:** Custom implementation with role-based access

### Field Hardware Integration
- **Hardware:** Raspberry Pi 4
- **Software:** BirdNET-Pi with TensorFlow Lite CNN models
- **Sync Service:** Python daemon with SQLite integration
- **Audio Processing:** 48.0 kHz 16-bit PCM recording

---

## 3. DIRECTORY STRUCTURE

```
D:\Live_Recorder/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── admin/             # Admin consoles (PAM, Live)
│   │   ├── api/               # API routes (species info)
│   │   ├── dashboard/         # Dashboard variants (TST, Common, PAM)
│   │   ├── live/              # Live detections feed
│   │   ├── live_dashboard/    # Live dashboard view
│   │   ├── map/               # GIS mapping interface
│   │   ├── projects/          # Project management
│   │   ├── stations/          # Station/recorder telemetry
│   │   ├── species/           # Species catalog
│   │   ├── users/             # User management
│   │   ├── layout.tsx         # Root layout with providers
│   │   ├── page.tsx           # Homepage
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── audio/             # Audio player modal
│   │   ├── charts/            # Chart components (TopSpecies, Diurnal, etc.)
│   │   ├── layout/            # Layout components (Header, Sidebar, RoleContext)
│   │   └── map/               # Map components (LightMap, SatelliteMap)
│   ├── lib/
│   │   ├── birdEcologicalTraits.ts  # Species ecological data
│   │   ├── dbService.ts            # Database service layer
│   │   ├── emailService.ts         # Email notifications
│   │   ├── speciesMasterData.ts    # Master species catalog
│   │   ├── supabase.ts             # Supabase client & realtime
│   │   ├── supabaseClient.ts       # Supabase client configuration
│   │   └── utils.ts                # Utility functions
│   └── types/
│       └── database.ts        # TypeScript type definitions
├── python-sync/
│   ├── birdnet_sync.py       # Live recorder sync daemon
│   ├── pam_data_compiler.py  # PAM offline data compiler
│   └── requirements.txt       # Python dependencies
├── public/                    # Static assets (audio files, images)
├── supabase_schema.sql        # Database schema definition
├── package.json              # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
├── next.config.js            # Next.js configuration
└── tailwind.config.js        # Tailwind CSS configuration
```

---

## 4. CORE COMPONENTS ANALYSIS

### 4.1 Layout Components

#### Header.tsx
- **Purpose:** Main navigation header with role-based menu
- **Features:**
  - Dynamic navigation based on user role
  - Admin console dropdown (PAM Admin, Live Recorder Admin, User Management)
  - User authentication status display
  - Mobile-responsive design
  - External links to Bird Lab website

#### Sidebar.tsx
- **Purpose:** Dashboard navigation sidebar
- **Features:**
  - Role-based navigation item visibility
  - Online station count display
  - System telemetry status
  - Active route highlighting
  - Collapsible design with role badges

#### RoleContext.tsx
- **Purpose:** Global state management for user authentication and roles
- **Features:**
  - User authentication (login/logout)
  - Role-based access control (Admin, Project Manager, Site Manager, Public)
  - User CRUD operations
  - Database synchronization with Supabase
  - One-time password generation
  - Session management

#### LoginModal.tsx
- **Purpose:** User authentication interface
- **Features:**
  - Email/password login
  - OTP generation and email dispatch
  - Password change functionality
  - Form validation
  - Error handling

### 4.2 Audio Components

#### AudioPlayerModal.tsx
- **Purpose:** Audio playback interface for bird call detections
- **Features:**
  - Audio playback with progress tracking
  - Spectrogram visualization (simulated)
  - Confidence score display
  - Verification controls for authenticated users
  - Download functionality
  - Fallback audio sources

### 4.3 Chart Components

#### TopSpeciesChart.tsx
- **Purpose:** Horizontal bar chart showing most detected species
- **Features:**
  - Recharts-based visualization
  - Responsive design
  - Empty state handling
  - Custom tooltips

#### DiurnalChart.tsx
- **Purpose:** 24-hour bird activity pattern visualization
- **Features:**
  - Time-based activity distribution
  - Circular visualization
  - Species-specific patterns

#### AccumulationChart.tsx
- **Purpose:** Species detection accumulation over time
- **Features:**
  - Temporal trend analysis
  - Cumulative detection counts

#### PolarDiurnalChart.tsx
- **Purpose:** Polar coordinate diurnal activity chart
- **Features:**
  - Circular time visualization
  - Activity intensity mapping

### 4.4 Map Components

#### LightMap.tsx
- **Purpose:** Light-themed GIS map for station visualization
- **Features:**
  - Leaflet-based mapping
  - Circle markers with species richness gradient
  - Popup information displays
  - Custom color schemes
  - Responsive design

#### SatelliteMap.tsx
- **Purpose:** Satellite imagery map interface
- **Features:**
  - Dark-themed satellite tiles
  - Station location markers
  - Real-time data integration
  - Dynamic loading

---

## 5. DATA MODELS & DATABASE SCHEMA

### 5.1 Database Tables

#### Users Table
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'Admin' | 'Project Manager' | 'Site Manager' | 'Public';
  organization: string;
  assignedProjectType?: 'PAM' | 'Live' | 'Both';
  projectScopePermissions?: string[];
  isOneTimePassword?: boolean;
  mustChangePassword?: boolean;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}
```

#### Projects Table
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  organization: string;
  manager_id: string;
  manager_name: string;
  project_type?: 'PAM' | 'Live';
  stations_count: number;
  species_count: number;
  total_detections: number;
  public_visible: boolean;
  created_at: string;
}
```

#### Recorders Registry Table
```typescript
interface Recorder {
  id: string;
  project_type: 'PAM' | 'Live';
  project_name: string;
  site_name: string;
  recorder_id: string;
  status: 'online' | 'offline';
  lat: number;
  long: number;
  elevation: string;
  battery_level: number;
  cpu_temperature: number;
  storage_used_percent: number;
  firmware_version: string;
  last_ping: string;
}
```

#### Live Detections Table
```typescript
interface Detection {
  id: string;
  project_name: string;
  site_name: string;
  recorder_id: string;
  common_name: string;
  scientific_name: string;
  confidence: number;
  timestamp: string;
  audio_url: string;
  spectrogram_url?: string;
  verified: boolean;
  verification_status: 'PENDING' | 'YES' | 'NO';
}
```

#### TST Detections Table (PAM Historical Data)
```typescript
interface TSTDetection {
  id: number;
  site_name: string;
  date: Date;
  time: string;
  common_name: string;
  scientific_name: string;
  threshold: number;
  file_name: string;
}
```

### 5.2 TypeScript Type Definitions

All database interfaces are defined in `src/types/database.ts` with comprehensive type safety for:
- User roles and permissions
- Project metadata
- Station/recorder telemetry
- Detection records
- Species information
- System notifications

---

## 6. API INTEGRATION

### 6.1 Internal API Routes

#### Species List API (`/api/species/list`)
- **Purpose:** Fetch species data from iNaturalist API
- **Features:**
  - Pagination support
  - Search functionality
  - In-memory caching (12-hour TTL)
  - Ecological traits integration
  - Error handling with fallback

#### Species Info API (`/api/species/info`)
- **Purpose:** Get detailed species information
- **Features:**
  - Taxonomic data retrieval
  - Image URLs
  - Conservation status
  - Wikipedia integration
  - 24-hour caching

### 6.2 External API Integration

#### iNaturalist API
- **Endpoint:** `https://api.inaturalist.org/v1/`
- **Usage:** Species taxonomy, images, conservation data
- **Rate Limiting:** 2.5s timeout, caching strategy
- **Data Used:** Common names, scientific names, photos, IUCN status

#### Cornell Lab of Ornithology API
- **Usage:** Audio file references
- **Integration:** Fallback audio sources for species calls

#### Supabase Client
- **Tables:** users, projects, recorders_registry, live_detections, tst_detections
- **Storage:** birdnet-audio bucket for audio files
- **Realtime:** Postgres changes subscriptions for live updates

---

## 7. STATE MANAGEMENT

### 7.1 RoleContext Provider
- **Global State:**
  - `currentRole`: Active user role
  - `currentUser`: Current user session
  - `usersList`: All registered users
  - `visibilitySettings`: Public visibility controls

- **Actions:**
  - `loginUser()`: Authentication
  - `logoutUser()`: Session termination
  - `updateUserCredentials()`: User profile updates
  - `deleteUser()`: User removal
  - `addUser()`: New user creation
  - `updateVisibilitySetting()`: Public access controls

### 7.2 Component-Level State
- **Dashboard Pages:** Detection lists, filter states, loading states
- **Map Pages:** Location data, filter selections
- **Admin Pages:** Form states, modal states, success/error messages
- **Audio Player:** Playback state, progress tracking

### 7.3 Real-time Subscriptions
- **Live Detections:** Supabase realtime subscription to `live_detections` table
- **Station Health:** Telemetry updates from `recorders_registry` table
- **Automatic Updates:** UI refreshes on database changes without page reload

---

## 8. ROUTING & NAVIGATION STRUCTURE

### 8.1 Public Routes
- `/` - Homepage with project overview
- `/about` - About page
- `/projects` - Projects directory (public view)

### 8.2 Dashboard Routes
- `/dashboard` - Redirects to `/live_dashboard`
- `/live_dashboard` - Live recorder dashboard
- `/dashboard/tst` - TST format dashboard (historical PAM data)
- `/dashboard/common` - Common format dashboard (new projects)
- `/dashboard/pam` - PAM project dashboard

### 8.3 Functional Routes
- `/live` - Live detections feed with real-time updates
- `/stations` - Station telemetry and management
- `/map` - GIS mapping interface
- `/species` - Species catalog with search
- `/review` - Detection verification queue
- `/reports` - Analytics and reporting
- `/settings` - System settings (Admin only)
- `/users` - User management (Admin only)

### 8.4 Admin Routes
- `/admin/pam` - PAM data admin console
- `/admin/live` - Live recorder admin console

### 8.5 Navigation Logic
- **Role-Based:** Menu items filtered by user role
- **Context-Aware:** Sidebar only appears on dashboard routes
- **Dynamic:** Active state highlighting based on current path
- **Mobile-Responsive:** Collapsible navigation for mobile devices

---

## 9. STYLING & UI PATTERNS

### 9.1 Design System
- **Color Palette:**
  - Primary: Emerald/Indigo gradient
  - Success: Emerald green
  - Warning: Amber
  - Error: Rose
  - Neutral: Slate grays

- **Typography:**
  - Font: Inter, system-ui
  - Weights: Black (900), Bold (700), Medium (500)
  - Sizes: 10px (small) to 24px (headings)

### 9.2 Component Patterns
- **Cards:** Premium rounded cards (1.25rem border-radius)
- **Buttons:** Gradient backgrounds with hover effects
- **Inputs:** Rounded borders with focus states
- **Modals:** Backdrop blur with smooth animations
- **Loaders:** Skeleton screens and pulse animations

### 9.3 Custom CSS Features
- **Gradient Borders:** Top accent lines for cards
- **Soundwave Animation:** Equalizer-style animation for audio
- **Custom Scrollbars:** Thin, styled scrollbars
- **TST Dashboard CSS:** Specialized styling for TST format

### 9.4 Responsive Design
- **Breakpoints:** Mobile, tablet, desktop
- **Grid Systems:** Responsive grid layouts
- **Flexible Components:** adaptable to different screen sizes

---

## 10. BACKEND INTEGRATION

### 10.1 Python Sync Services

#### BirdNET Sync Daemon (`python-sync/birdnet_sync.py`)
- **Purpose:** Sync BirdNET-Pi data to Supabase
- **Features:**
  - SQLite database reading
  - Audio file upload to Supabase Storage
  - Metadata insertion to PostgreSQL
  - Offline queue management
  - Retry logic for failed uploads
  - Configurable sync intervals

#### PAM Data Compiler (`python-sync/pam_data_compiler.py`)
- **Purpose:** Process offline PAM survey data
- **Features:**
  - Raven selection table parsing
  - Site code extraction from filenames
  - Bulk data insertion
  - Progress tracking
  - Chunk-based uploads (500 records per batch)

### 10.2 Database Service Layer (`src/lib/dbService.ts`)
- **User Operations:** CRUD operations for user management
- **Project Operations:** Project creation, deletion, listing
- **Site Registration:** Site node registration
- **Detection Management:** Live detection queries and insertion
- **Audio Upload:** Supabase Storage integration

### 10.3 Email Service (`src/lib/emailService.ts`)
- **Purpose:** Send OTP emails for password reset
- **Features:**
  - One-time password generation
  - Email dispatch
  - User notification

---

## 11. KEY FEATURES

### 11.1 Real-Time Capabilities
- **Live Feed:** Instant detection updates via Supabase Realtime
- **Station Telemetry:** Real-time hardware health monitoring
- **Audio Streaming:** Direct playback from cloud storage
- **Dynamic Dashboards:** Auto-updating visualizations

### 11.2 Data Visualization
- **Species Charts:** Top species, diurnal patterns, accumulation trends
- **GIS Mapping:** Station locations with species richness indicators
- **Temporal Analysis:** 24-hour activity patterns
- **KPI Cards:** Summary statistics with trends

### 11.3 User Management
- **Role-Based Access:** Admin, Project Manager, Site Manager, Public
- **Project Permissions:** PAM-only, Live-only, or Both access
- **Authentication:** Email/password with OTP support
- **Session Management:** Login tracking and audit logs

### 11.4 Data Processing
- **AI Detection:** BirdNET-Pi TensorFlow Lite models
- **Offline Processing:** PAM survey data compilation
- **Quality Control:** Verification workflow for detections
- **Bulk Operations:** CSV parsing and batch uploads

### 11.5 Project Management
- **Dual Dashboard Formats:** TST (historical) and Common (new projects)
- **Project Classification:** PAM vs Live project types
- **3-Level Hierarchy:** Project → Site → Recorder
- **GPS Registration:** Station location mapping
- **Telemetry Integration:** Hardware health monitoring

---

## 12. DEPLOYMENT & INFRASTRUCTURE

### 12.1 Environment Configuration
- **Supabase:** URL and anon key configuration
- **Database:** PostgreSQL schema management
- **Storage:** Audio file bucket configuration
- **Environment Variables:** `.env.local` for sensitive data

### 12.2 Build Configuration
- **Next.js:** App Router with strict mode
- **TypeScript:** Strict type checking
- **Image Optimization:** Remote pattern configuration
- **Performance:** Static generation where possible

### 12.3 Field Deployment
- **Hardware:** Raspberry Pi 4 with USB microphone
- **Software:** BirdNET-Pi installation
- **Sync Service:** Python daemon with systemd
- **Connectivity:** Offline-first with retry logic

---

## 13. SECURITY & ACCESS CONTROL

### 13.1 Authentication
- **Custom Implementation:** Role-based login system
- **Password Management:** Hash storage with OTP reset
- **Session Management:** Last login tracking
- **Account Status:** Active/suspended/inactive states

### 13.2 Authorization
- **Role-Based UI:** Different interfaces per role
- **Project Scope:** Users assigned to specific project types
- **Public Access:** Configurable public visibility settings
- **Admin Controls:** Full system access for administrators

### 13.3 Data Protection
- **Row Level Security:** Disabled for application queries
- **API Keys:** Service role keys for server operations
- **Environment Variables:** Sensitive data in `.env.local`
- **Secure Storage:** Supabase Storage with access controls

---

## 14. PERFORMANCE OPTIMIZATION

### 14.1 Caching Strategies
- **API Caching:** 12-hour in-memory cache for species data
- **Image Optimization:** Next.js Image component with remote patterns
- **Database Indexing:** Optimized queries for frequent operations
- **Realtime Subscriptions:** Efficient change detection

### 14.2 Code Splitting
- **Dynamic Imports:** Map components loaded on demand
- **Route-Based Splitting:** Automatic code splitting by Next.js
- **Component Lazy Loading:** Heavy components loaded when needed

### 14.3 Data Loading
- **Parallel Queries:** Concurrent database requests
- **Pagination:** Large datasets loaded in chunks
- **Optimistic UI:** Immediate feedback with background updates

---

## 15. CONCLUSION

The Birdsong Observatory Platform represents a sophisticated bioacoustic monitoring system that integrates:

1. **Edge Computing:** Raspberry Pi field nodes with AI-powered bird detection
2. **Cloud Infrastructure:** Supabase backend with real-time capabilities
3. **Modern Web Technologies:** Next.js frontend with responsive design
4. **Data Science:** Ecological analysis and visualization tools
5. **User Management:** Comprehensive role-based access control

The system successfully bridges the gap between field bioacoustic monitoring and cloud-based analytics, providing researchers with real-time insights into avian biodiversity patterns across South Asian ecosystems.

The architecture supports both live monitoring deployments and historical PAM survey analysis, making it a versatile platform for ornithological research and conservation efforts.

---

## 16. FILE REFERENCES

### Key Files Analyzed:
- **Configuration:** package.json, tsconfig.json, next.config.js, tailwind.config.js
- **Layout:** src/app/layout.tsx, src/app/page.tsx, src/app/globals.css
- **Components:** src/components/layout/*.tsx, src/components/audio/*.tsx, src/components/charts/*.tsx, src/components/map/*.tsx
- **Library:** src/lib/*.ts
- **Types:** src/types/database.ts
- **API Routes:** src/app/api/species/*.ts
- **Pages:** src/app/*/*.tsx
- **Database:** supabase_schema.sql
- **Python Scripts:** python-sync/*.py

### Component Mapping:
- **Header** → src/components/layout/Header.tsx
- **Sidebar** → src/components/layout/Sidebar.tsx
- **RoleContext** → src/components/layout/RoleContext.tsx
- **LoginModal** → src/components/layout/LoginModal.tsx
- **AudioPlayerModal** → src/components/audio/AudioPlayerModal.tsx
- **TopSpeciesChart** → src/components/charts/TopSpeciesChart.tsx
- **DiurnalChart** → src/components/charts/DiurnalChart.tsx
- **AccumulationChart** → src/components/charts/AccumulationChart.tsx
- **PolarDiurnalChart** → src/components/charts/PolarDiurnalChart.tsx
- **LightMap** → src/components/map/LightMap.tsx
- **SatelliteMap** → src/components/map/SatelliteMap.tsx

---

**Report Generated:** 2026-07-31  
**Analysis Scope:** Complete codebase across all directories and files  
**Platform:** Birdsong Observatory Platform & PAM Bioacoustics Hub  
**Organization:** IISER Tirupati Bird Ecology Lab