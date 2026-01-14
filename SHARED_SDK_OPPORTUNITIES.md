# Shared SDK Opportunities Analysis

> **Analysis Date:** January 13, 2026  
> **Purpose:** Identify common functionality across applications for extraction to @aviation/shared-sdk

---

## 📊 Executive Summary

After analyzing all 6 applications and existing shared packages, I've identified **15 major opportunities** for shared SDK extraction, categorized by priority and impact.

### Current Status
✅ **Completed Extractions:**
- Airports (Aviation-o2d) - 100% complete
- Weather (Aviation-dx3) - 95% complete  
- Navigation (Aviation-n2k) - 30% complete (in progress)

📋 **Identified Opportunities:** 15 additional extractions

---

## 🎯 High-Priority Opportunities (P0)

### 1. **Terrain & Elevation Services** 🏔️

**Current State:** Duplicated in FlightPlanner  
**Usage:** FlightPlanner, future accident tracker integration  
**Effort:** 2-3 days  
**Value:** High - Critical for route planning, safety analysis

**Current Implementation:**
- `apps/flightplanner/backend/app/services/terrain_service.py` (~300 lines)
- OpenTopography API client (SRTM data)
- Open-Meteo elevation API (fallback)
- Elevation queries for route profiles
- Terrain clearance calculations

**API to Extract:**
```typescript
// TypeScript
interface ElevationResult {
  latitude: number;
  longitude: number;
  elevation_meters: number;
  elevation_feet: number;
  data_source: 'opentopography' | 'open-meteo';
}

async function getElevation(lat: number, lon: number): Promise<ElevationResult>
async function getElevationProfile(points: Coordinate[]): Promise<ElevationResult[]>
async function calculateTerrainClearance(route: Coordinate[], altitude_ft: number): Promise<number>
```

**Benefits:**
- Shared API keys (OpenTopography)
- Consistent elevation data across apps
- Safety calculations for accident analysis
- Route terrain profiles

---

### 2. **Database Utilities & ORM Patterns** 🗄️

**Current State:** Inconsistent across apps  
**Usage:** 4 applications (flightschool, foreflight-dashboard, aviation-missions, accident-tracker)  
**Effort:** 3-4 days  
**Value:** Very High - Reduces boilerplate, standardizes patterns

**Current Implementations:**
- **FlightSchool:** Flask-SQLAlchemy + Flask-Migrate
- **ForeFlight:** SQLAlchemy + FastAPI
- **Aviation Missions:** Clojure JDBC + H2
- **Accident Tracker:** SQLite with raw SQL

**Common Patterns:**
```python
# Database connection management
# Session lifecycle
# Migration utilities
# Common models (User, timestamps, soft deletes)
# Query helpers (pagination, filtering, sorting)
# Transaction management
```

**API to Extract:**
```python
# Python
from aviation.database import (
    DatabaseConnection,
    BaseModel,  # With created_at, updated_at
    Paginator,
    QueryBuilder,
    MigrationManager
)

class User(BaseModel):
    __tablename__ = 'users'
    # Auto-includes: id, created_at, updated_at
    email = Column(String, unique=True)
    
# Usage
db = DatabaseConnection('sqlite:///app.db')
users = db.query(User).paginate(page=1, per_page=20)
```

**Benefits:**
- Consistent database patterns
- Shared migration tooling
- Common models (User, audit fields)
- Pagination/filtering utilities
- Connection pooling

---

### 3. **Authentication & Authorization** 🔐

**Current State:** Implemented differently in each app  
**Usage:** 4 applications (all except flight-tracker, weather-briefing)  
**Effort:** 4-5 days  
**Value:** Very High - Security, consistency

**Current Implementations:**
- **FlightSchool:** Flask-Login + session management
- **ForeFlight:** FastAPI + JWT + bcrypt
- **Aviation Missions:** Custom JWT in Clojure
- **Accident Tracker:** Planned

**Common Needs:**
- Password hashing (bcrypt)
- JWT token generation/validation
- Session management
- Role-based access control (RBAC)
- User authentication
- API key authentication

**API to Extract:**
```python
# Python
from aviation.auth import (
    hash_password,
    verify_password,
    create_jwt_token,
    verify_jwt_token,
    require_auth,
    require_role,
    RBACManager
)

@require_auth
@require_role('admin')
def admin_endpoint():
    pass

# TypeScript
import { AuthService, JWTManager, PasswordHasher } from '@aviation/shared-sdk';

const authService = new AuthService({
    secret: process.env.JWT_SECRET,
    expiresIn: '8h'
});

const token = await authService.createToken({ userId: 123, role: 'pilot' });
const user = await authService.verifyToken(token);
```

**Benefits:**
- Consistent security patterns
- Shared JWT secrets management
- Standard password policies
- Unified RBAC system
- Audit logging

---

### 4. **ForeFlight API Client** 📱

**Current State:** Only in foreflight-dashboard  
**Usage:** foreflight-dashboard, potential for flightschool, flightplanner  
**Effort:** 2 days  
**Value:** High - Enables ForeFlight integration across apps

**Current Implementation:**
- `apps/foreflight-dashboard/src/services/foreflight_client.py` (~150 lines)
- CSV import/export
- Logbook data parsing
- Flight record validation

**API to Extract:**
```typescript
interface ForeFlightLogEntry {
  date: string;
  aircraft_id: string;
  aircraft_type: string;
  from: string;  // ICAO
  to: string;    // ICAO
  route: string;
  total_time: number;
  pic: number;
  sic: number;
  night: number;
  xc: number;
  // ... more fields
}

class ForeFlightClient {
  parseCSV(csvData: string): ForeFlightLogEntry[]
  exportCSV(entries: ForeFlightLogEntry[]): string
  validateEntry(entry: ForeFlightLogEntry): boolean
  calculateCurrency(entries: ForeFlightLogEntry[], date: Date): Currency
}
```

**Benefits:**
- Import logbooks into any app
- Export flight school records to ForeFlight
- Standardized logbook format
- Currency calculations

---

### 5. **Google Calendar Integration** 📅

**Current State:** Only in flightschool  
**Usage:** flightschool, potential for aviation-missions, booking systems  
**Effort:** 2-3 days  
**Value:** High - Calendar sync for scheduling

**Current Implementation:**
- `apps/flightschool/app/calendar_service.py` (~200 lines)
- Google Calendar API v3
- OAuth2 authentication
- Event creation/update/delete
- Conflict detection

**API to Extract:**
```python
# Python
from aviation.integrations.google_calendar import (
    GoogleCalendarClient,
    CalendarEvent,
    create_event,
    update_event,
    delete_event,
    check_conflicts
)

calendar = GoogleCalendarClient(credentials)

event = CalendarEvent(
    summary='Flight Lesson',
    start_time=datetime.now(),
    end_time=datetime.now() + timedelta(hours=2),
    attendees=['student@example.com', 'instructor@example.com']
)

calendar.create_event(event)
conflicts = calendar.check_conflicts(start, end)
```

**Benefits:**
- Sync bookings to Google Calendar
- Conflict detection
- Instructor scheduling
- Mission planning calendar integration

---

## 📋 Medium-Priority Opportunities (P1)

### 6. **Form Validation & Sanitization** 📝

**Current State:** Inconsistent across apps  
**Usage:** All web applications  
**Effort:** 2 days  
**Value:** Medium-High - Data quality, security

**Current Implementations:**
- **FlightSchool:** Flask-WTF forms
- **ForeFlight:** Pydantic models
- **FlightPlanner:** Custom validation

**Common Needs:**
- Email validation
- Phone number validation
- ICAO/IATA code validation
- Registration number validation (N-numbers)
- Date/time validation
- Required fields
- Input sanitization (XSS prevention)

**API to Extract:**
```python
from aviation.validation import (
    validate_email,
    validate_icao_code,
    validate_iata_code,
    validate_n_number,
    validate_date_range,
    sanitize_html,
    ValidationError
)

@dataclass
class BookingForm:
    student_email: str
    aircraft_registration: str
    start_time: datetime
    
    def validate(self):
        validate_email(self.student_email)
        validate_n_number(self.aircraft_registration)
        validate_date_range(self.start_time, min_future_hours=1)
```

---

### 7. **Date/Time Utilities & Timezone Handling** 🕐

**Current State:** Scattered across apps  
**Usage:** All applications  
**Effort:** 1-2 days  
**Value:** Medium - Consistency, correctness

**Common Needs:**
- UTC/Zulu time conversions
- Local to UTC
- Sunrise/sunset calculations
- Flight time calculations
- Duration formatting
- Timezone lookup by coordinates

**API to Extract:**
```typescript
import { 
  toZulu, 
  fromZulu, 
  calculateSunriseSunset,
  formatDuration,
  getTimezone 
} from '@aviation/shared-sdk';

const zuluTime = toZulu(localTime, 'America/Los_Angeles');
const { sunrise, sunset } = calculateSunriseSunset(lat, lon, date);
const duration = formatDuration(minutes); // "2h 30m"
const timezone = getTimezone(lat, lon); // "America/Los_Angeles"
```

---

### 8. **File Upload & Processing** 📤

**Current State:** Duplicated in multiple apps  
**Usage:** foreflight-dashboard (CSV), accident-tracker (data import)  
**Effort:** 2 days  
**Value:** Medium - Reusability

**Common Needs:**
- CSV parsing/generation
- File validation (size, type)
- Chunked upload (large files)
- Progress tracking
- Error handling
- Streaming processing

**API to Extract:**
```python
from aviation.files import (
    CSVProcessor,
    FileUploadHandler,
    validate_file_type,
    stream_large_file
)

processor = CSVProcessor()
data = processor.parse(file_path, required_columns=['Date', 'Aircraft ID'])
processor.export(data, output_path)

uploader = FileUploadHandler(max_size_mb=50)
uploader.upload(file, on_progress=lambda p: print(f'{p}%'))
```

---

### 9. **Email/Notification Service** 📧

**Current State:** Ad-hoc implementations  
**Usage:** flightschool (booking confirmations), future apps  
**Effort:** 2-3 days  
**Value:** Medium - Communication

**Common Needs:**
- Send transactional emails
- Email templates
- SMS notifications (Twilio)
- Push notifications
- Notification queue/batching

**API to Extract:**
```python
from aviation.notifications import (
    EmailService,
    SMSService,
    NotificationManager
)

email = EmailService()
email.send_template(
    to='pilot@example.com',
    template='booking_confirmation',
    data={
        'student_name': 'John Doe',
        'aircraft': 'N12345',
        'time': '2026-01-15 10:00'
    }
)

notifier = NotificationManager()
notifier.notify_booking_confirmed(booking)
```

---

### 10. **Pagination & Filtering Utilities** 📄

**Current State:** Reinvented in each app  
**Usage:** All apps with lists/tables  
**Effort:** 1-2 days  
**Value:** Medium - Consistency, UX

**Common Patterns:**
- Page-based pagination
- Cursor-based pagination
- Filter builder
- Sort utilities
- Search across columns

**API to Extract:**
```python
from aviation.pagination import Paginator, FilterBuilder

# Backend
paginator = Paginator(query, page=1, per_page=20)
result = paginator.paginate()

filters = FilterBuilder()
filters.add('status', 'equals', 'active')
filters.add('created_at', 'after', '2025-01-01')
filtered_query = filters.apply(query)

# Frontend TypeScript
import { usePagination, useFilters } from '@aviation/shared-sdk';

const { data, page, setPage } = usePagination<Flight>('/api/flights');
const { filters, addFilter } = useFilters();
```

---

## 🔧 Low-Priority Opportunities (P2)

### 11. **Logging & Monitoring** 📊

**Current State:** Basic logging in each app  
**Usage:** All applications  
**Effort:** 2-3 days  
**Value:** Low-Medium - Operations

**Common Needs:**
- Structured logging (JSON)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Request ID tracking
- Performance monitoring
- Error aggregation (Sentry integration)

**API to Extract:**
```python
from aviation.logging import get_logger, track_performance

logger = get_logger('my-service')
logger.info('User logged in', user_id=123, ip='192.168.1.1')

@track_performance
def expensive_operation():
    pass
```

---

### 12. **Caching Utilities** 💾

**Current State:** Basic TTL cache in weather module  
**Usage:** All applications  
**Effort:** 1-2 days  
**Value:** Low-Medium - Performance

**Common Needs:**
- In-memory cache (TTL)
- Redis cache (shared)
- Cache invalidation
- Cache warming
- Query result caching

**API to Extract:**
```python
from aviation.cache import cache, TTLCache

@cache(ttl=300)  # 5 minutes
def expensive_query():
    return db.query().all()

# Manual caching
cache = TTLCache()
cache.set('key', value, ttl=600)
result = cache.get('key')
```

---

### 13. **Rate Limiting** ⏱️

**Current State:** Only in foreflight-dashboard  
**Usage:** All APIs  
**Effort:** 1-2 days  
**Value:** Low-Medium - API protection

**Common Needs:**
- Request rate limiting
- API key quota management
- IP-based limiting
- User-based limiting

**API to Extract:**
```python
from aviation.ratelimit import rate_limit, RateLimiter

@rate_limit(requests=100, window=60)  # 100 requests per minute
def api_endpoint():
    pass

limiter = RateLimiter()
limiter.check_limit(user_id=123, limit=1000, window=3600)
```

---

### 14. **Background Jobs & Task Queue** ⚙️

**Current State:** Ad-hoc implementations  
**Usage:** Data ingestion, scheduled tasks  
**Effort:** 3-4 days  
**Value:** Low-Medium - Async processing

**Common Needs:**
- Job scheduling (cron-like)
- Task queue (Celery/RQ)
- Retry logic
- Job status tracking
- Priority queues

**API to Extract:**
```python
from aviation.jobs import scheduler, task_queue

@scheduler.every('1h')
def hourly_sync():
    pass

@task_queue.task(retry=3)
def process_data(data_id):
    pass

task_queue.enqueue(process_data, data_id=123, priority='high')
```

---

### 15. **Testing Utilities** 🧪

**Current State:** Each app has own test utils  
**Usage:** All applications  
**Effort:** 2 days  
**Value:** Low - Developer experience

**Common Needs:**
- Test fixtures (airports, users, flights)
- Mock API responses
- Database test helpers
- Fake data generators
- Test client utilities

**API to Extract:**
```python
from aviation.testing import (
    create_test_airport,
    create_test_user,
    create_test_flight,
    MockWeatherAPI,
    TestDatabase
)

# In tests
def test_booking():
    user = create_test_user(role='student')
    aircraft = create_test_aircraft(registration='N12345')
    booking = create_booking(user, aircraft)
    assert booking.is_valid()
```

---

## 📈 Impact vs. Effort Matrix

```
High Impact │ 1.Terrain      2.Database    3.Auth        5.GCal
            │ 4.ForeFlight
            │
            │                 6.Validation  7.DateTime
Medium      │                 8.FileUpload  9.Email      10.Pagination
            │
            │                               11.Logging   12.Caching
Low Impact  │                               13.RateLimit 14.Jobs     15.Testing
            │
            └─────────────────────────────────────────────────────────
              1-2 days      2-3 days      3-4 days      4-5 days
                            Effort Required
```

---

## 🎯 Recommended Extraction Order

Based on impact, effort, and dependencies:

### Phase 1 (Current Sprint - Week 1-2)
1. ✅ **Airports** (o2d) - Complete
2. ✅ **Weather** (dx3) - Complete  
3. 🚧 **Navigation** (n2k) - In Progress

### Phase 2 (Sprint 2 - Week 3-4)
4. **Database Utilities** (P0) - 3-4 days
   - High impact across all apps
   - Foundational for other extractions

5. **Authentication & Authorization** (P0) - 4-5 days
   - Security critical
   - Enables RBAC across apps

### Phase 3 (Sprint 3 - Week 5-6)
6. **Terrain & Elevation** (P0) - 2-3 days
   - Critical for route planning
   - Accident analysis integration

7. **Google Calendar** (P0) - 2-3 days
   - High value for scheduling apps
   - Limited to specific use cases

8. **ForeFlight Client** (P0) - 2 days
   - Enables logbook integration
   - Quick win

### Phase 4 (Sprint 4 - Week 7-8)
9. **Form Validation** (P1) - 2 days
10. **Date/Time Utilities** (P1) - 1-2 days
11. **File Upload** (P1) - 2 days
12. **Email/Notifications** (P1) - 2-3 days

### Phase 5 (Ongoing)
13. **Pagination** (P1) - 1-2 days
14. **Logging** (P2) - 2-3 days
15. **Caching** (P2) - 1-2 days
16. **Rate Limiting** (P2) - 1-2 days
17. **Background Jobs** (P2) - 3-4 days
18. **Testing Utilities** (P2) - 2 days

---

## 💰 ROI Analysis

### High-ROI Extractions (Do First)
1. **Database Utilities** - Used in 4+ apps, massive time savings
2. **Authentication** - Security critical, affects all apps
3. **Terrain** - Enables new features, safety-critical
4. **Navigation** - In progress, completes core aviation utilities

### Medium-ROI Extractions (Do Next)
5. **ForeFlight Client** - Quick win, high user value
6. **Google Calendar** - Scheduling apps benefit significantly
7. **Form Validation** - Reduces bugs, improves UX
8. **Date/Time** - Correctness is critical in aviation

### Lower-ROI Extractions (Do Later)
9. **Logging, Caching, Rate Limiting** - Nice to have, not urgent
10. **Background Jobs** - Only needed when scaling
11. **Testing Utilities** - Developer convenience

---

## 🚀 Quick Wins (< 2 days, High Value)

1. **Date/Time Utilities** (1-2 days)
   - Immediate impact across all apps
   - Prevents timezone bugs

2. **ForeFlight Client** (2 days)
   - Already well-contained in one app
   - High user value

3. **Pagination** (1-2 days)
   - Every app needs it
   - Simple to extract

---

## ⚠️ Considerations

### Language Support
- **TypeScript + Python:** Airports, Weather, Navigation, Terrain, Database
- **Python Only:** Auth (FastAPI/Flask specific), Google Calendar
- **TypeScript Only:** Background Service base class
- **Mixed:** Consider dual implementation for high-value items

### Breaking Changes
- Extracting database utilities may require migration
- Auth extraction needs careful planning (existing users)
- Consider deprecation periods for existing implementations

### Dependencies
- Some extractions depend on others:
  - Database → Auth → RBAC
  - Terrain → Navigation (distance calculations)
  - Email → Auth (user lookup)

---

## 📝 Conclusion

**Total Opportunities Identified:** 15

**Recommended Next Steps:**
1. Complete Navigation (n2k) - 70% remaining
2. Start Database Utilities extraction
3. Plan Authentication extraction
4. Extract Terrain services
5. Continue with P1 items

**Estimated Total Effort:** 35-45 days of development

**Expected Value:** $40K-$60K in engineering value

**Risk:** Low - All extractions are well-understood patterns

---

*Generated: January 13, 2026*  
*Analysis based on codebase snapshot*  
*Priority rankings subject to business needs*
