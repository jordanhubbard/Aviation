# Database Utilities Design Document

> **Bead:** Database Utilities & ORM Patterns (Phase 2)  
> **Priority:** P0 - Highest ROI  
> **Estimated Effort:** 3-4 days  
> **Impact:** 4 applications (FlightSchool, ForeFlight, Aviation Missions, Accident Tracker)

---

## Current State Analysis

### Applications Using Databases

#### 1. **ForeFlight Dashboard** (Python + SQLAlchemy)
```python
# Pattern:
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, server_default=func.now())
    
# Session management
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Features:**
- ✅ Declarative base model
- ✅ Timestamp fields (created_at)
- ✅ FastAPI dependency injection
- ✅ to_dict() serialization
- ✅ Relationships

#### 2. **FlightSchool** (Python + Flask-SQLAlchemy)
```python
# Pattern:
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
# Session management
# Handled automatically by Flask-SQLAlchemy
```

**Features:**
- ✅ Flask-Login integration
- ✅ Timestamp fields (created_at)
- ✅ Password hashing utilities
- ✅ Role-based fields

#### 3. **Accident Tracker** (TypeScript + SQLite)
```typescript
// Pattern:
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

class EventRepository {
    private db: sqlite3.Database;
    private dbRun: (sql: string, params?: any[]) => Promise<any>;
    
    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.dbRun = promisify(this.db.run.bind(this.db));
    }
}
```

**Features:**
- ✅ Promisified SQLite
- ✅ Repository pattern
- ✅ Schema initialization from SQL
- ✅ snake_case ↔ camelCase conversion
- ✅ Upsert logic

#### 4. **Aviation Missions** (Clojure + H2)
```clojure
;; Pattern:
(ns aviation-missions.db
  (:require [clojure.java.jdbc :as jdbc]))

(def db-spec
  {:classname "org.h2.Driver"
   :subprotocol "h2"
   :subname "./data/aviation-missions"})

(defn init-db! []
  (jdbc/execute! db-spec
    ["CREATE TABLE IF NOT EXISTS missions (...)"]))
```

**Features:**
- ✅ JDBC abstraction
- ✅ SQL-based schema management
- ✅ Timestamp management

---

## Common Patterns Identified

### 1. Connection Management
- Database URL configuration from environment
- Engine/connection creation
- Session/connection pooling
- SQLite-specific settings (check_same_thread)

### 2. Base Models
- Primary key (id)
- Timestamps (created_at, updated_at)
- Soft deletes (is_active, deleted_at)
- Serialization (to_dict)

### 3. Session Management
- Context managers
- Dependency injection (FastAPI)
- Automatic cleanup

### 4. Common Operations
- CRUD operations
- Pagination
- Filtering
- Sorting
- Bulk operations

### 5. Migrations
- Schema initialization
- Schema updates
- Rollback capabilities

---

## Unified Design

### Package Structure

```
packages/shared-sdk/
├── src/database/
│   ├── index.ts                    # Main exports
│   ├── connection.ts               # Connection management
│   ├── repository.ts               # Base repository class
│   ├── pagination.ts               # Pagination utilities
│   ├── query-builder.ts            # Query builder (TypeScript)
│   └── types.ts                    # Type definitions
└── python/database/
    ├── __init__.py
    ├── base.py                     # Base model with timestamps
    ├── connection.py               # Connection management
    ├── pagination.py               # Pagination helpers
    ├── query_builder.py            # Query builder utilities
    ├── session.py                  # Session management
    └── mixins.py                   # Common mixins (timestamps, soft delete)
```

---

## API Design

### Python (SQLAlchemy)

#### Base Model with Timestamps
```python
from aviation.database import BaseModel
from sqlalchemy import Column, String, Integer

class User(BaseModel):
    """User model with automatic timestamps."""
    __tablename__ = 'users'
    
    email = Column(String(255), unique=True, nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    
    # Inherited from BaseModel:
    # - id (Integer, primary_key=True)
    # - created_at (DateTime, server_default=func.now())
    # - updated_at (DateTime, onupdate=func.now())
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
```

#### Connection Management
```python
from aviation.database import DatabaseConnection

# Initialize connection
db = DatabaseConnection('sqlite:///./data/app.db')

# Get session
with db.session() as session:
    users = session.query(User).all()

# Or use as FastAPI dependency
from fastapi import Depends

def get_db():
    return db.get_session_dependency()

@app.get("/users")
def list_users(session: Session = Depends(get_db)):
    return session.query(User).all()
```

#### Pagination
```python
from aviation.database import Paginator

# Paginate query results
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

# Build complex queries
qb = QueryBuilder(session, User)
qb.filter('email', 'like', '%@example.com')
qb.filter('is_active', '=', True)
qb.filter('created_at', '>', '2025-01-01')
qb.order_by('created_at', 'desc')
qb.limit(10)

users = qb.all()
```

#### Soft Delete Mixin
```python
from aviation.database import BaseModel, SoftDeleteMixin

class User(BaseModel, SoftDeleteMixin):
    __tablename__ = 'users'
    
    email = Column(String(255))
    
    # Inherited from SoftDeleteMixin:
    # - deleted_at (DateTime, nullable=True)
    # - is_deleted property
    # - soft_delete() method
    # - restore() method

# Usage
user.soft_delete()  # Sets deleted_at
user.restore()      # Clears deleted_at

# Query only active records
active_users = session.query(User).filter_by(deleted_at=None).all()
```

---

### TypeScript (Node.js)

#### Base Repository
```typescript
import { BaseRepository, DatabaseConnection } from '@aviation/shared-sdk';

interface User {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
}

class UserRepository extends BaseRepository<User> {
    constructor(connection: DatabaseConnection) {
        super(connection, 'users');
    }
    
    async findByEmail(email: string): Promise<User | null> {
        return this.findOne({ email });
    }
}

// Usage
const db = new DatabaseConnection('sqlite:///./data/app.db');
const userRepo = new UserRepository(db);

const users = await userRepo.findAll({ limit: 20, offset: 0 });
const user = await userRepo.findById(1);
await userRepo.create({ email: 'test@example.com', ... });
await userRepo.update(1, { firstName: 'Updated' });
await userRepo.delete(1);
```

#### Connection Pool
```typescript
import { createConnectionPool } from '@aviation/shared-sdk';

const pool = createConnectionPool({
    type: 'sqlite',
    database: './data/app.db',
    maxConnections: 10,
    idleTimeout: 30000
});

// Get connection from pool
const connection = await pool.getConnection();
try {
    // Use connection
    const result = await connection.query('SELECT * FROM users');
} finally {
    pool.releaseConnection(connection);
}
```

#### Query Builder
```typescript
import { QueryBuilder } from '@aviation/shared-sdk';

const qb = new QueryBuilder<User>('users');
qb.where('email', 'like', '%@example.com')
  .where('is_active', '=', true)
  .orderBy('created_at', 'desc')
  .limit(10)
  .offset(0);

const users = await qb.execute(connection);
```

---

## Migration from Current Implementations

### ForeFlight Dashboard Migration

**Before:**
```python
from sqlalchemy import create_engine, Column, Integer, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**After:**
```python
from aviation.database import BaseModel

class User(BaseModel):
    __tablename__ = "users"
    # id, created_at, updated_at inherited from BaseModel
```

**Benefits:**
- ✅ 5 lines removed per model
- ✅ Consistent timestamp handling
- ✅ Automatic updated_at on changes
- ✅ Built-in to_dict() serialization

### FlightSchool Migration

**Before:**
```python
from app import db
from datetime import datetime, timezone

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
```

**After:**
```python
from aviation.database import BaseModel, db

class User(BaseModel):
    __tablename__ = 'users'
    # id, created_at, updated_at inherited
```

**Benefits:**
- ✅ Consistent with ForeFlight
- ✅ No manual timestamp management
- ✅ Shared base class

### Accident Tracker Migration

**Before:**
```typescript
class EventRepository {
    private db: sqlite3.Database;
    private dbRun: (sql: string, params?: any[]) => Promise<any>;
    
    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.dbRun = promisify(this.db.run.bind(this.db));
    }
    
    async create(event: Event): Promise<number> {
        const result = await this.dbRun(
            'INSERT INTO events (...) VALUES (...)',
            [...]
        );
        return result.lastID;
    }
}
```

**After:**
```typescript
import { BaseRepository } from '@aviation/shared-sdk';

class EventRepository extends BaseRepository<Event> {
    constructor(connection: DatabaseConnection) {
        super(connection, 'events');
    }
    
    // CRUD operations inherited:
    // - findAll, findById, create, update, delete
    // - findOne, exists, count
}
```

**Benefits:**
- ✅ 50+ lines of boilerplate removed
- ✅ Consistent API
- ✅ Built-in pagination
- ✅ Type-safe operations

---

## Features Roadmap

### Phase 1 (3-4 days) - Core Functionality
- ✅ BaseModel with timestamps (Python)
- ✅ BaseRepository (TypeScript)
- ✅ Connection management
- ✅ Session management (Python)
- ✅ Basic CRUD operations
- ✅ Pagination helpers
- ✅ Query builder basics

### Phase 2 (2-3 days) - Advanced Features
- ⏳ Soft delete mixin
- ⏳ Full-text search helpers
- ⏳ Bulk operations
- ⏳ Transaction management
- ⏳ Migration utilities

### Phase 3 (2-3 days) - Testing & Migration
- ⏳ Comprehensive test suite
- ⏳ Migration scripts for existing apps
- ⏳ Documentation & examples
- ⏳ Performance benchmarks

---

## Success Criteria

### Must Have (MVP)
- ✅ BaseModel with id, created_at, updated_at
- ✅ Connection management (SQLite, PostgreSQL)
- ✅ Session management (Python)
- ✅ BaseRepository with CRUD (TypeScript)
- ✅ Pagination helpers
- ✅ Basic query builder

### Should Have
- ⏳ Soft delete mixin
- ⏳ Migration utilities
- ⏳ Transaction management
- ⏳ Bulk operations

### Nice to Have
- ⏳ Full-text search
- ⏳ Database seeding utilities
- ⏳ Performance monitoring

---

## Implementation Plan

### Day 1: Python BaseModel & Connection
- Create BaseModel with timestamps
- Implement DatabaseConnection class
- Add session management
- Test with SQLite & PostgreSQL

### Day 2: Python Pagination & Query Builder
- Implement Paginator class
- Create QueryBuilder for filters/sorting
- Add soft delete mixin
- Write unit tests

### Day 3: TypeScript BaseRepository
- Create BaseRepository class
- Implement CRUD operations
- Add connection management
- Promisify SQLite operations

### Day 4: Integration & Documentation
- Write comprehensive docs
- Create migration guides
- Add examples for each app
- Performance testing

---

## Testing Strategy

### Unit Tests
```python
# test_base_model.py
def test_base_model_timestamps():
    user = User(email='test@example.com')
    session.add(user)
    session.commit()
    
    assert user.created_at is not None
    assert user.updated_at is not None

def test_base_model_to_dict():
    user = User(email='test@example.com')
    data = user.to_dict()
    
    assert 'id' in data
    assert 'created_at' in data
    assert 'updated_at' in data
```

### Integration Tests
```python
# test_pagination.py
def test_paginator():
    # Create 50 users
    for i in range(50):
        session.add(User(email=f'user{i}@example.com'))
    session.commit()
    
    paginator = Paginator(session.query(User), page=2, per_page=10)
    result = paginator.paginate()
    
    assert result['page'] == 2
    assert len(result['items']) == 10
    assert result['total'] == 50
    assert result['total_pages'] == 5
```

---

## Performance Considerations

### Connection Pooling
- Use connection pooling for high-traffic apps
- Configure pool size based on load
- Monitor active connections

### Query Optimization
- Use indexes on frequently queried columns
- Avoid N+1 queries with eager loading
- Use pagination for large datasets

### Caching
- Cache frequently accessed data
- Invalidate cache on updates
- Use Redis for distributed caching

---

## Security Considerations

### SQL Injection Prevention
- Always use parameterized queries
- Never concatenate user input into SQL
- Validate and sanitize inputs

### Password Security
- Never log passwords
- Use strong hashing (bcrypt, argon2)
- Store only hashed passwords

### Access Control
- Implement row-level security
- Use database roles and permissions
- Audit sensitive operations

---

## Documentation Requirements

### API Reference
- Full API documentation for each class/function
- Parameter descriptions
- Return value specifications
- Usage examples

### Migration Guides
- Step-by-step migration instructions
- Before/after code examples
- Common pitfalls and solutions

### Best Practices
- Database design patterns
- Performance optimization tips
- Security recommendations

---

**Created:** January 13, 2026  
**Status:** Design complete, implementation ready  
**Next:** Start Phase 1 implementation
