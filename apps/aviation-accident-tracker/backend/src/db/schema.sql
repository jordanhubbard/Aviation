-- Aviation Accident Tracker Database Schema
-- Tracks aviation accidents/incidents >= year 2000 with provenance

-- Events table: core accident/incident records
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Core identifiers (uniqueness key)
    date_z TEXT NOT NULL CHECK(date(date_z) >= '2000-01-01'), -- UTC date, enforces >= 2000
    registration TEXT NOT NULL, -- Aircraft registration (N-number, etc)
    
    -- Aircraft details
    aircraft_type TEXT,
    operator TEXT,
    
    -- Classification
    category TEXT NOT NULL CHECK(category IN ('general', 'commercial', 'unknown')) DEFAULT 'unknown',
    
    -- Location
    airport_icao TEXT,
    airport_iata TEXT,
    latitude REAL,
    longitude REAL,
    country TEXT,
    region TEXT,
    
    -- Incident details
    fatalities INTEGER DEFAULT 0,
    injuries INTEGER DEFAULT 0,
    summary TEXT,
    narrative TEXT,
    status TEXT, -- e.g. 'preliminary', 'final', 'ongoing'
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Uniqueness constraint on dedupe key
    UNIQUE(date_z, registration)
);

-- Sources table: provenance tracking
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    
    -- Source metadata
    source_name TEXT NOT NULL, -- e.g. 'asn', 'avherald'
    url TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    checksum TEXT, -- Hash of raw content for change detection
    raw_fragment TEXT, -- Optional: store raw HTML/JSON snippet
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Indexes for performance

-- Primary query: recent events descending
CREATE INDEX IF NOT EXISTS idx_events_date_z_desc ON events(date_z DESC);

-- Lookup by registration and date range
CREATE INDEX IF NOT EXISTS idx_events_reg_date ON events(registration, date_z);

-- Geospatial queries
CREATE INDEX IF NOT EXISTS idx_events_geo ON events(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Airport filter
CREATE INDEX IF NOT EXISTS idx_events_airport ON events(airport_icao, airport_iata);

-- Category filter
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- Country/region filter
CREATE INDEX IF NOT EXISTS idx_events_location ON events(country, region);

-- Source lookup
CREATE INDEX IF NOT EXISTS idx_sources_event ON sources(event_id);
CREATE INDEX IF NOT EXISTS idx_sources_url ON sources(url);
