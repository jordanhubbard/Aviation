# Aviation Missions Schema Documentation

This document defines the complete data structure for aviation training missions in the Aviation Mission Management system.

## JSON Schema

The authoritative schema is defined in `mission-schema.json` using JSON Schema Draft 07:
- **Schema ID**: `https://aviation-missions.app/schemas/mission.json`
- **Title**: "Aviation Mission"
- **Type**: Object with strict validation (`additionalProperties: false`)

## Mission Data Structure

### Core Mission Fields

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | `BIGINT` | Auto | Unique mission identifier | `1` |
| `title` | `VARCHAR(255)` | ✅ | Mission title/name | `"Class B Ops: LAX Bravo Transition"`, `"Mountain Gateway: Truckee (KTRK)"`, `"Coastal Marine Layer Run: Half Moon Bay (KHAF)"` |
| `category` | `VARCHAR(100)` | ✅ | Mission category | `"Airspace Operations"` |
| `difficulty` | `INTEGER` | ✅ | Difficulty rating (1-10) | `7` |
| `objective` | `TEXT` | ✅ | Primary learning objective | `"Master Class B communication, clearances, and situational awareness"`, `"Practice overwater flight planning and engine-out decision-making"` |
| `mission_description` | `TEXT` | ✅ | Detailed mission description | `"Fly down the California coast, request the Coastal Route or Mini Route through LAX Bravo"`, `"Launch from KPAO, cross to KHAF on a less than ideal day, then continue down to KMRY"` |
| `why_description` | `TEXT` | ✅ | Educational rationale | `"Learn to fit GA ops into airline-dense airspace, sharpen radio skills"`, `"Coastal ops teach rapid weather evaluation and diversion decision-making"` |
| `notes` | `TEXT` | ❌ | Additional notes and tips | `"Study LAX VFR charts. Have alternates (e.g., Hawthorne)"` |
| `route` | `VARCHAR(500)` | ❌ | Primary route description | `"KPAO → coastal route south → LAX Bravo → KTOA"` |
| `suggested_route` | `VARCHAR(500)` | ❌ | Suggested waypoint route | `"KPAO KWVI KHHR KTOA"` |
| `pilot_experience` | `VARCHAR(50)` | ❌ | Target pilot experience level | `"Intermediate (100-500 hours)"` |
| `special_challenges` | `TEXT` | ❌ | Special challenges or requirements | `"Mountain Flying, High Altitude"` |

### Fields NOT in Database (UI should not display these)
- `aircraft` - Not stored in missions data
- `airport` - Not stored as separate field (included in route/description)
- `weather` - Not stored as separate field (included in description/notes)

### Computed/Aggregated Fields (API Response Only)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `comment_count` | `INTEGER` | Number of comments on this mission | `5` |
| `completion_count` | `INTEGER` | Number of pilots who completed this mission | `12` |
| `thumbs_up` | `INTEGER` | Number of positive ratings | `8` |
| `thumbs_down` | `INTEGER` | Number of negative ratings | `1` |

### Metadata Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `created_at` | `TIMESTAMP` | Mission creation timestamp | `"2025-09-15T21:00:05Z"` |
| `updated_at` | `TIMESTAMP` | Last modification timestamp | `"2025-09-15T21:00:05Z"` |

## Mission Categories

The system supports the following predefined mission categories (enum values):

| Category | Description |
|----------|-------------|
| `"Airspace Operations"` | Complex airspace navigation (Class B, Class C operations) |
| `"Terrain & Environment"` | Challenging terrain operations (mountain, island flying) |
| `"Weather & Atmospheric"` | Weather-related training (marine layer, fog, challenging conditions) |
| `"Navigation & Diversions"` | Navigation skills (cross-country, diversions, dead reckoning) |
| `"Airport Operations"` | Airport-specific procedures (pattern work, taxi operations) |
| `"Endurance & Planning"` | Long-distance flight planning and endurance missions |
| `"Advanced Adventures"` | Advanced/challenging missions (extreme conditions, remote locations) |
| `"General Training"` | General aviation training (default category) |

## Pilot Experience Levels

Enum values for the `pilot_experience` field:

| Level | Description | Hours |
|-------|-------------|-------|
| `"Beginner (< 100 hours)"` | New pilots, basic skills | 0-99 hours |
| `"Intermediate (100-500 hours)"` | Developing pilots | 100-499 hours |
| `"Advanced (500+ hours)"` | Experienced pilots | 500+ hours |
| `"Commercial/ATP"` | Professional pilots | Commercial/ATP rated |
| `null` | Unspecified (defaults to "Beginner (< 100 hours)") | - |

## Difficulty Scale

| Level | Description | Typical Characteristics |
|-------|-------------|------------------------|
| `1-2` | **Beginner** | Pattern work, basic navigation, familiar airports |
| `3-4` | **Novice** | Simple cross-country, Class C airports, basic weather |
| `5-6` | **Intermediate** | Complex airspace, moderate weather, longer flights |
| `7-8` | **Advanced** | Class B operations, mountain flying, challenging weather |
| `9-10` | **Expert** | Extreme conditions, overwater, high-risk operations |

## Related Data Structures

### Comments
```sql
CREATE TABLE comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mission_id BIGINT NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);
```

### Mission Ratings
```sql
CREATE TABLE mission_ratings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mission_id BIGINT NOT NULL,
    pilot_name VARCHAR(100) NOT NULL,
    rating VARCHAR(10) NOT NULL CHECK (rating IN ('up', 'down')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mission_id, pilot_name),
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);
```

### Mission Completions
```sql
CREATE TABLE mission_completions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mission_id BIGINT NOT NULL,
    pilot_name VARCHAR(100) NOT NULL,
    completion_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);
```

### Reviews
```sql
CREATE TABLE reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mission_id BIGINT NOT NULL,
    pilot_name VARCHAR(100) NOT NULL,
    review_text TEXT,
    flight_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES missions(id)
);
```

## API Endpoints

### GET /missions
Returns all missions with aggregated statistics.

**Response Format:**
```json
{
  "missions": [
    {
      "id": 1,
      "title": "Class B Ops: LAX Bravo Transition",
      "category": "Airspace Operations",
      "difficulty": 7,
      "objective": "Master Class B communication, clearances, and situational awareness",
      "mission_description": "Fly down the California coast, request the Coastal Route...",
      "why_description": "Learn to fit GA ops into airline-dense airspace",
      "notes": "Study LAX VFR charts. Have alternates",
      "route": "KPAO → coastal route south → LAX Bravo → KTOA",
      "suggested_route": "KPAO KWVI KHHR KTOA",
      "pilot_experience": "Intermediate (100-500 hours)",
      "special_challenges": "",
      "comment_count": 5,
      "completion_count": 12,
      "thumbs_up": 8,
      "thumbs_down": 1,
      "created_at": "2025-09-15T21:00:05Z",
      "updated_at": "2025-09-15T21:00:05Z"
    }
  ]
}
```

### GET /missions/:id
Returns a single mission by ID with the same structure as above.

### POST /missions (Admin Only)
Creates a new mission.

**Request Body:**
```json
{
  "title": "Mission Title",
  "category": "General Training",
  "difficulty": 5,
  "objective": "Learning objective",
  "mission_description": "Detailed description",
  "why_description": "Educational rationale",
  "notes": "Optional notes",
  "route": "Optional route",
  "suggested_route": "Optional waypoints",
  "pilot_experience": "Beginner (< 100 hours)",
  "special_challenges": "Optional challenges"
}
```

## Validation Rules

### Required Fields
- `title`: Non-empty string, min 1 character, max 255 characters
- `category`: Must be one of the predefined enum values (see Mission Categories above)
- `difficulty`: Integer between 1 and 10 (inclusive)
- `objective`: Non-empty text, min 1 character
- `mission_description`: Non-empty text, min 1 character
- `why_description`: Non-empty text, min 1 character

### Optional Fields
- `notes`: String or null
- `route`: String up to 500 characters or null
- `suggested_route`: String up to 500 characters or null, must match pattern `^([A-Z0-9]{3,4}\s*)*$` (ICAO codes)
- `pilot_experience`: Must be one of the predefined enum values or null (max 50 characters)
- `special_challenges`: String or null

### Auto-Generated Fields
- `id`: Integer, minimum 1 (auto-generated)
- `comment_count`: Integer, minimum 0 (computed, read-only)
- `completion_count`: Integer, minimum 0 (computed, read-only)
- `thumbs_up`: Integer, minimum 0 (computed, read-only)
- `thumbs_down`: Integer, minimum 0 (computed, read-only)
- `created_at`: ISO 8601 date-time string (read-only)
- `updated_at`: ISO 8601 date-time string (read-only)

### Business Rules
- Mission titles should be descriptive and include airport codes where relevant
- Difficulty should reflect actual pilot skill requirements
- Routes should use standard aviation notation (airport codes, waypoints)
- Categories are auto-assigned but can be overridden
- All text fields support full UTF-8 character set

## Frontend Challenge Detection

The UI automatically analyzes mission content to identify flight challenges:

| Challenge | Keywords | Icon | Description |
|-----------|----------|------|-------------|
| Weather | weather, wind, turbulence, fog, visibility, cloud | 🌤️ | Weather-related challenges |
| Navigation | navigation, gps, vor, ils, approach, departure | 🧭 | Navigation system usage |
| Communications | radio, communication, atc, tower, ground, clearance | 📻 | Radio communication skills |
| Traffic | traffic, busy, crowded, multiple, aircraft, sequence | ✈️ | High-traffic environments |
| Emergency | emergency, malfunction, failure, problem, issue | 🚨 | Emergency procedures |
| Night Ops | night, dark, lighting, beacon, strobe | 🌙 | Night flying operations |
| Precision | precision, accuracy, exact, careful, tight | 🎯 | Precision flying skills |
| Time Pressure | time, pressure, quick, fast, urgent, deadline | ⏱️ | Time-critical operations |

## Data Sources

### Primary Source: missions.txt
The system parses a structured text file with the following format:

```
Mission Title (difficulty: X/10)
Objective: Learning objective here
Mission: Detailed mission description
Route: Flight route description
Suggested Route: ICAO codes and waypoints
Why: Educational rationale
Notes: Additional tips and considerations
```

### Database Storage
All parsed missions are stored in the H2 database with proper normalization and indexing for performance.

### API Responses
The REST API provides JSON responses with computed aggregations (comments, ratings, completions) joined from related tables.

## Usage Examples

### Creating a New Mission
```clojure
(create-mission! {
  :title "Pattern Practice at Busy Airport"
  :category "Airport Operations"
  :difficulty 3
  :objective "Improve pattern work in high-traffic environment"
  :mission_description "Fly pattern at KRHV during peak training hours"
  :why_description "Builds confidence in busy airport operations"
  :notes "Monitor CTAF carefully, announce intentions clearly"
  :pilot_experience "Beginner (< 100 hours)"
})
```

### Querying Missions by Difficulty
```sql
SELECT * FROM missions WHERE difficulty BETWEEN 1 AND 3 ORDER BY title;
```

### Getting Mission Statistics
```sql
SELECT 
  m.title,
  COUNT(DISTINCT c.id) as comments,
  COUNT(DISTINCT mc.id) as completions,
  AVG(CASE WHEN mr.rating = 'up' THEN 1.0 ELSE 0.0 END) as approval_rate
FROM missions m
LEFT JOIN comments c ON m.id = c.mission_id
LEFT JOIN mission_completions mc ON m.id = mc.mission_id  
LEFT JOIN mission_ratings mr ON m.id = mr.mission_id
GROUP BY m.id, m.title;
```

---

*This schema documentation is maintained alongside the codebase and should be updated when the data structure changes.*
