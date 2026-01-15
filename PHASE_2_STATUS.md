# Phase 2: Database Utilities & ORM Patterns - Status

> **Started:** January 13, 2026  
> **Status:** Design Complete, Implementation Pending  
> **Priority:** P0 - Highest ROI Opportunity  

---

## 🎯 Phase 2 Scope

**Primary Goal:** Extract and unify database patterns across all applications

**Target Applications (4):**
1. ForeFlight Dashboard (Python + SQLAlchemy)
2. FlightSchool (Python + Flask-SQLAlchemy)
3. Accident Tracker (TypeScript + SQLite)
4. Aviation Missions (Clojure + H2)

**Estimated Effort:** 3-4 days (24-32 hours)  
**Estimated Value:** $18K-$25K  
**ROI:** Very High (affects 4 apps, foundational for other work)

---

## ✅ What's Complete (20%)

### 1. Analysis (100%)
- ✅ Analyzed all 4 database implementations
- ✅ Identified common patterns
- ✅ Documented current approaches
- ✅ Found pain points and duplication

### 2. Design (100%)
- ✅ Created comprehensive design document (`DATABASE_DESIGN.md` - 648 lines)
- ✅ Designed Python API (BaseModel, DatabaseConnection, Paginator, QueryBuilder)
- ✅ Designed TypeScript API (BaseRepository, ConnectionPool, QueryBuilder)
- ✅ Planned migration strategy for each app
- ✅ Defined success criteria and testing strategy

**Document Created:** `packages/shared-sdk/DATABASE_DESIGN.md`

---

## ⏳ What's Pending (80%)

### Phase 1: Core Functionality (3-4 days)

#### Day 1: Python BaseModel & Connection (8-10 hours)
- ⏳ Create `python/database/base.py` with BaseModel
- ⏳ Implement `python/database/connection.py`
- ⏳ Add `python/database/session.py` for session management
- ⏳ Test with SQLite & PostgreSQL

#### Day 2: Python Pagination & Query Builder (6-8 hours)
- ⏳ Implement `python/database/pagination.py`
- ⏳ Create `python/database/query_builder.py`
- ⏳ Add `python/database/mixins.py` (SoftDelete)
- ⏳ Write unit tests

#### Day 3: TypeScript BaseRepository (6-8 hours)
- ⏳ Create `src/database/repository.ts`
- ⏳ Implement `src/database/connection.ts`
- ⏳ Add `src/database/query-builder.ts`
- ⏳ Promisify SQLite operations

#### Day 4: Integration & Documentation (4-6 hours)
- ⏳ Write comprehensive API documentation
- ⏳ Create migration guides for each app
- ⏳ Add usage examples
- ⏳ Performance testing

---

## 📋 Detailed Design Highlights

### Python API

#### BaseModel with Automatic Timestamps
```python
from aviation.database import BaseModel
from sqlalchemy import Column, String

class User(BaseModel):
    """User model with automatic timestamps."""
    __tablename__ = 'users'
    
    email = Column(String(255), unique=True, nullable=False)
    first_name = Column(String(100))
    
    # Inherited from BaseModel:
    # - id (Integer, primary_key=True)
    # - created_at (DateTime, server_default=func.now())
    # - updated_at (DateTime, onupdate=func.now())
```

**Benefits:**
- ✅ Automatic ID generation
- ✅ Automatic timestamps (created_at, updated_at)
- ✅ Built-in `to_dict()` serialization
- ✅ Consistent across all models
- ✅ **5 lines removed per model**

#### Pagination
```python
from aviation.database import Paginator

paginator = Paginator(session.query(User), page=1, per_page=20)
result = paginator.paginate()

# Returns:
# {
#     'items': [...],
#     'page': 1,
#     'per_page': 20,
#     'total': 150,
#     'total_pages': 8,
#     'has_next': True,
#     'has_prev': False
# }
```

#### Query Builder
```python
from aviation.database import QueryBuilder

qb = QueryBuilder(session, User)
qb.filter('email', 'like', '%@example.com')
qb.filter('is_active', '=', True)
qb.order_by('created_at', 'desc')
qb.limit(10)

users = qb.all()
```

### TypeScript API

#### BaseRepository for CRUD
```typescript
import { BaseRepository, DatabaseConnection } from '@aviation/shared-sdk';

interface User {
    id: number;
    email: string;
    createdAt: Date;
}

class UserRepository extends BaseRepository<User> {
    constructor(connection: DatabaseConnection) {
        super(connection, 'users');
    }
}

// Usage
const userRepo = new UserRepository(db);
const users = await userRepo.findAll({ limit: 20 });
const user = await userRepo.findById(1);
await userRepo.create({ email: 'test@example.com' });
```

**Benefits:**
- ✅ Type-safe operations
- ✅ **50+ lines of boilerplate removed**
- ✅ Built-in pagination
- ✅ Consistent CRUD API

---

## 💰 ROI Analysis

### Code Savings Per Application

| Application | Current Lines | After Migration | Savings |
|-------------|---------------|-----------------|---------|
| ForeFlight Dashboard | ~200 (models) | ~160 | 40 lines |
| FlightSchool | ~250 (models) | ~200 | 50 lines |
| Accident Tracker | ~350 (repo) | ~100 | 250 lines |
| **Total** | **~800 lines** | **~460 lines** | **340 lines** |

### Development Time Savings

**Before (per app):**
- Setting up database: 2-3 hours
- Creating base models: 1-2 hours
- Implementing CRUD: 3-4 hours
- Adding pagination: 1-2 hours
- **Total: 7-11 hours per app**

**After (per app):**
- Import shared utilities: 15 minutes
- Define models: 30 minutes
- Custom queries: 1-2 hours
- **Total: 2-3 hours per app**

**Time Saved: 5-8 hours per application**

### Maintenance Benefits

**Before:**
- Bugs fixed in 4 places
- Features added 4 times
- Different patterns in each app

**After:**
- ✅ Fix once, benefits all apps
- ✅ Feature once, available everywhere
- ✅ Consistent patterns across monorepo

---

## 🎯 Success Criteria

### Must Have (MVP) ✅
- ✅ Analysis complete
- ✅ Design complete
- ⏳ BaseModel with timestamps (Python)
- ⏳ Connection management
- ⏳ BaseRepository with CRUD (TypeScript)
- ⏳ Pagination helpers
- ⏳ Basic query builder

### Should Have
- ⏳ Soft delete mixin
- ⏳ Migration utilities
- ⏳ Transaction management
- ⏳ Comprehensive tests

### Nice to Have
- ⏳ Full-text search helpers
- ⏳ Bulk operations
- ⏳ Performance monitoring

---

## 📊 Progress Tracker

### Overall Progress: 20%

```
Analysis & Design    ████████████████████ 100%
Python BaseModel     ░░░░░░░░░░░░░░░░░░░░   0%
Python Utilities     ░░░░░░░░░░░░░░░░░░░░   0%
TypeScript Repo      ░░░░░░░░░░░░░░░░░░░░   0%
Testing             ░░░░░░░░░░░░░░░░░░░░   0%
Documentation       ░░░░░░░░░░░░░░░░░░░░   0%
Migration           ░░░░░░░░░░░░░░░░░░░░   0%
```

### Time Investment

| Phase | Estimated | Actual | Remaining |
|-------|-----------|--------|-----------|
| Analysis | 2-3 hrs | 2 hrs | - |
| Design | 2-3 hrs | 3 hrs | - |
| Python Impl | 14-18 hrs | - | 14-18 hrs |
| TypeScript Impl | 6-8 hrs | - | 6-8 hrs |
| Testing & Docs | 4-6 hrs | - | 4-6 hrs |
| **Total** | **24-32 hrs** | **5 hrs** | **24-32 hrs** |

---

## 🚧 Implementation Roadmap

### Week 1 (This Week)

**Day 1: Monday** ✅
- ✅ Analysis complete
- ✅ Design complete
- ✅ Document created

**Day 2-3: Tuesday-Wednesday**
- ⏳ Python BaseModel
- ⏳ Python ConnectionManagement
- ⏳ Python Pagination
- ⏳ Python QueryBuilder

**Day 4-5: Thursday-Friday**
- ⏳ TypeScript BaseRepository
- ⏳ TypeScript ConnectionPool
- ⏳ TypeScript QueryBuilder
- ⏳ Integration testing

### Week 2 (Next Week)

**Day 1: Monday**
- ⏳ Comprehensive documentation
- ⏳ Migration guides
- ⏳ Usage examples

**Day 2-3: Tuesday-Wednesday**
- ⏳ Migrate ForeFlight Dashboard
- ⏳ Migrate FlightSchool

**Day 4-5: Thursday-Friday**
- ⏳ Migrate Accident Tracker
- ⏳ Final testing & validation

---

## ⚠️ Considerations & Risks

### Technical Considerations

1. **SQLite vs PostgreSQL**
   - Different connection parameters
   - SQLite: `check_same_thread=False`
   - PostgreSQL: Connection pooling

2. **Flask-SQLAlchemy vs Pure SQLAlchemy**
   - FlightSchool uses Flask-SQLAlchemy
   - Need compatibility layer

3. **TypeScript ORM Limitations**
   - No mature ORM like SQLAlchemy
   - Must implement repository pattern manually

### Migration Risks

1. **Breaking Changes**
   - Existing code may need updates
   - Database migrations may be required
   - **Mitigation:** Thorough testing, gradual rollout

2. **Learning Curve**
   - Developers need to learn new APIs
   - **Mitigation:** Comprehensive documentation, examples

3. **Performance Impact**
   - Additional abstraction layer
   - **Mitigation:** Performance testing, benchmarks

---

## 📚 Resources

### Design Document
- **File:** `packages/shared-sdk/DATABASE_DESIGN.md`
- **Lines:** 648
- **Sections:**
  - Current state analysis
  - Unified design
  - API reference
  - Migration guides
  - Implementation plan

### Referenced Code
- `apps/foreflight-dashboard/src/core/database.py`
- `apps/flightschool/app/models.py`
- `apps/aviation-accident-tracker/backend/src/db/repository.ts`
- `apps/aviation-missions-app/backend/src/aviation_missions/db.clj`

---

## 🎯 Next Steps

### Immediate (Next Session)

**Option A: Continue with Implementation** (24-32 hours)
- Start Day 1: Python BaseModel & Connection
- Implement core database utilities
- Complete Phase 1 of database extraction

**Option B: Finish Navigation First** (14-20 hours)
- Complete Navigation Python wrappers
- Write Navigation tests
- Document Navigation API
- Then return to Database utilities

**Option C: Quick Wins** (4-6 hours)
- Extract ForeFlight Client (2 days)
- Extract Date/Time Utilities (1-2 days)
- Then tackle Database utilities

### Recommendation

**Option A** is recommended if you want to maximize ROI immediately. Database Utilities has the highest impact (4 apps) and is foundational for other work (Auth, which depends on User models).

However, this is a **large undertaking** (24-32 hours of focused work). If you prefer to complete smaller pieces first, **Option B** (finish Navigation) or **Option C** (quick wins) are valid alternatives.

---

## ✅ Current Git Status

- **Branch:** `accident-tracker-review`
- **Status:** Up to date with origin
- **Uncommitted:** None
- **Last Commit:** Database design document (7b43fa8)

---

**Phase 2 Status:** **Design Complete (20%)**  
**Ready For:** Implementation (80% remaining)  
**Estimated Time:** 24-32 hours  
**Estimated Value:** +$18K-$25K

Would you like to proceed with database implementation, or would you prefer to complete Navigation or pursue quick wins first? 🚁
