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
    is_test_data INTEGER NOT NULL DEFAULT 0 CHECK(is_test_data IN (0, 1)),
    test_run_id TEXT,
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    CHECK((is_test_data = 0 AND test_run_id IS NULL) OR (is_test_data = 1 AND test_run_id IS NOT NULL))
);

-- Test databases are separate files; these tags allow an independent residual audit.
CREATE TABLE IF NOT EXISTS e2e_runs (
    run_id TEXT PRIMARY KEY,
    is_test_data INTEGER NOT NULL DEFAULT 1 CHECK(is_test_data = 1),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Sources table: provenance tracking
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    
    -- Source metadata
    source_name TEXT NOT NULL, -- e.g. 'asn', 'avherald'
    title TEXT,
    url TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    checksum TEXT, -- Hash of raw content for change detection
    raw_fragment TEXT, -- Optional: store raw HTML/JSON snippet
    is_test_data INTEGER NOT NULL DEFAULT 0 CHECK(is_test_data IN (0, 1)),
    test_run_id TEXT,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CHECK((is_test_data = 0 AND test_run_id IS NULL) OR (is_test_data = 1 AND test_run_id IS NOT NULL))
);

-- Identity is independent of citation URL: one NTSB archive holds many events.
CREATE TABLE IF NOT EXISTS source_identities (
    source_name TEXT NOT NULL,
    record_id TEXT NOT NULL CHECK(length(trim(record_id)) > 0),
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    PRIMARY KEY (source_name, record_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_source_identities_event ON source_identities(event_id, source_name);

-- Each label retains the document that explicitly supports it.
CREATE TABLE IF NOT EXISTS causes (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    source_name TEXT NOT NULL,
    url TEXT NOT NULL,
    basis TEXT NOT NULL CHECK(basis IN ('official', 'occurrence', 'reported')),
    PRIMARY KEY (event_id, label, url)
);

-- Publisher searches are retried after seven days so later coverage appears.
CREATE TABLE IF NOT EXISTS media_checks (
    event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_status (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    last_attempt_at TEXT,
    last_success_at TEXT,
    last_error TEXT,
    inserted INTEGER,
    updated INTEGER
);

-- Indexes for performance

-- Primary query: recent events descending
CREATE INDEX IF NOT EXISTS idx_events_date_z_desc ON events(date_z DESC);
-- Adjacent-UTC-day ingest matching accepts both date-only and ISO timestamp rows.
CREATE INDEX IF NOT EXISTS idx_events_julian_date ON events(julianday(date_z));

-- Lookup by registration and date range
CREATE INDEX IF NOT EXISTS idx_events_reg_date ON events(registration, date_z);
-- Missing registrations must not collapse unrelated reports into one event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_known_identity ON events(date_z, registration)
WHERE upper(trim(registration)) NOT IN ('', 'UNKNOWN', 'N/A', 'NA', 'UNREGISTERED', '-');

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
CREATE INDEX IF NOT EXISTS idx_causes_event ON causes(event_id);
