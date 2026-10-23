-- Database Optimization Script for Aviation Accident Tracker
-- SQLite Performance Tuning and Index Creation
--
-- Usage: sqlite3 data/accidents.db < scripts/optimize-database.sql

-- Enable performance analysis
.echo on
.timer on

-- ============================================================================
-- PERFORMANCE ANALYSIS
-- ============================================================================

.print "\n=== Database Statistics ==="
SELECT 
  'Total Events' as metric,
  COUNT(*) as value
FROM events;

SELECT 
  'Database Size (MB)' as metric,
  ROUND(page_count * page_size / 1024.0 / 1024.0, 2) as value
FROM pragma_page_count(), pragma_page_size();

SELECT
  'Unused Space (MB)' as metric,
  ROUND((freelist_count * page_size) / 1024.0 / 1024.0, 2) as value
FROM pragma_freelist_count(), pragma_page_size();

.print "\n=== Table Statistics ==="
SELECT 
  'Events' as table_name,
  COUNT(*) as row_count,
  AVG(LENGTH(narrative)) as avg_narrative_length,
  MIN(date_z) as earliest_date,
  MAX(date_z) as latest_date
FROM events;

-- ============================================================================
-- INDEX CREATION
-- ============================================================================

.print "\n=== Creating Performance Indexes ==="

-- Index for date range queries (most common filter)
CREATE INDEX IF NOT EXISTS idx_events_date_z 
ON events(date_z DESC);
.print "✓ Created index: idx_events_date_z"

-- Index for category filtering (GA vs Commercial)
CREATE INDEX IF NOT EXISTS idx_events_category 
ON events(category);
.print "✓ Created index: idx_events_category"

-- Index for country/region filtering
CREATE INDEX IF NOT EXISTS idx_events_country 
ON events(country);
.print "✓ Created index: idx_events_country"

-- Index for registration lookups (exact match)
CREATE INDEX IF NOT EXISTS idx_events_registration 
ON events(registration);
.print "✓ Created index: idx_events_registration"

-- Index for airport filtering
CREATE INDEX IF NOT EXISTS idx_events_airport 
ON events(airport_icao);
.print "✓ Created index: idx_events_airport"

-- Composite index for common query pattern: date + category
CREATE INDEX IF NOT EXISTS idx_events_date_category 
ON events(date_z DESC, category);
.print "✓ Created index: idx_events_date_category (composite)"

-- Composite index for geographic queries: country + date
CREATE INDEX IF NOT EXISTS idx_events_country_date 
ON events(country, date_z DESC);
.print "✓ Created index: idx_events_country_date (composite)"

-- Index for full-text search on narrative (if FTS not used)
-- Note: For true full-text search, consider FTS5 virtual table
CREATE INDEX IF NOT EXISTS idx_events_narrative_lower 
ON events(LOWER(narrative));
.print "✓ Created index: idx_events_narrative_lower (for text search)"

-- ============================================================================
-- QUERY PLAN ANALYSIS
-- ============================================================================

.print "\n=== Query Plan Analysis ==="

.print "\n--- Query 1: List recent events (paginated) ---"
EXPLAIN QUERY PLAN
SELECT id, date_z, registration, airport_icao, country, category, narrative_summary
FROM events
ORDER BY date_z DESC
LIMIT 50 OFFSET 0;

.print "\n--- Query 2: Filter by date range ---"
EXPLAIN QUERY PLAN
SELECT id, date_z, registration, airport_icao, country, category, narrative_summary
FROM events
WHERE date_z >= '2024-01-01' AND date_z <= '2024-12-31'
ORDER BY date_z DESC
LIMIT 50;

.print "\n--- Query 3: Filter by category ---"
EXPLAIN QUERY PLAN
SELECT id, date_z, registration, airport_icao, country, category, narrative_summary
FROM events
WHERE category = 'GA'
ORDER BY date_z DESC
LIMIT 50;

.print "\n--- Query 4: Filter by date and category (composite) ---"
EXPLAIN QUERY PLAN
SELECT id, date_z, registration, airport_icao, country, category, narrative_summary
FROM events
WHERE date_z >= '2024-01-01' 
  AND date_z <= '2024-12-31'
  AND category = 'GA'
ORDER BY date_z DESC
LIMIT 50;

.print "\n--- Query 5: Search by text (narrative) ---"
EXPLAIN QUERY PLAN
SELECT id, date_z, registration, airport_icao, country, category, narrative_summary
FROM events
WHERE LOWER(narrative) LIKE '%engine failure%'
ORDER BY date_z DESC
LIMIT 50;

.print "\n--- Query 6: Get event by ID ---"
EXPLAIN QUERY PLAN
SELECT *
FROM events
WHERE id = 'ASN_2024-01-01_N12345';

.print "\n--- Query 7: Filter by country ---"
EXPLAIN QUERY PLAN
SELECT id, date_z, registration, airport_icao, country, category, narrative_summary
FROM events
WHERE country = 'USA'
ORDER BY date_z DESC
LIMIT 50;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

.print "\n=== Running Performance Optimizations ==="

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;
.print "✓ Enabled WAL (Write-Ahead Logging) mode"

-- Set cache size to 10MB (default is 2MB)
PRAGMA cache_size = -10000;  -- Negative means KB
.print "✓ Set cache size to 10MB"

-- Set temp store to memory for faster sorting/grouping
PRAGMA temp_store = MEMORY;
.print "✓ Set temp store to memory"

-- Enable memory-mapped I/O (up to 256MB)
PRAGMA mmap_size = 268435456;
.print "✓ Enabled memory-mapped I/O (256MB)"

-- Set synchronous to NORMAL for better write performance
-- (FULL is safer but slower, NORMAL is good balance)
PRAGMA synchronous = NORMAL;
.print "✓ Set synchronous mode to NORMAL"

-- Optimize database by rebuilding indexes and reclaiming space
VACUUM;
.print "✓ Vacuumed database (reclaimed unused space)"

-- Update statistics for query optimizer
ANALYZE;
.print "✓ Analyzed database (updated optimizer statistics)"

-- ============================================================================
-- VERIFY INDEXES
-- ============================================================================

.print "\n=== Current Indexes ==="
SELECT 
  name as index_name,
  tbl_name as table_name,
  sql as definition
FROM sqlite_master
WHERE type = 'index'
  AND tbl_name = 'events'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name;

-- ============================================================================
-- PERFORMANCE RECOMMENDATIONS
-- ============================================================================

.print "\n=== Performance Recommendations ==="
.print ""
.print "✓ All recommended indexes have been created"
.print "✓ Database has been optimized (VACUUM + ANALYZE)"
.print "✓ WAL mode enabled for better concurrency"
.print "✓ Memory and cache settings optimized"
.print ""
.print "Additional recommendations:"
.print "  • Run ANALYZE periodically (weekly) to update statistics"
.print "  • Run VACUUM monthly to reclaim space and defragment"
.print "  • Monitor query performance with EXPLAIN QUERY PLAN"
.print "  • Consider FTS5 for full-text search if needed"
.print "  • Keep SQLite updated to latest version"
.print ""
.print "Query performance targets:"
.print "  • List queries: <100ms"
.print "  • Detail queries: <50ms"
.print "  • Filtered queries: <200ms"
.print "  • Text search queries: <500ms"
.print ""
.print "Optimization complete!"
