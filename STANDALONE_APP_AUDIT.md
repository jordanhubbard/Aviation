# Standalone Application Audit

**Epic:** Aviation-1qg (P0)  
**Date:** January 15, 2026  
**Purpose:** Audit all applications before meta-app integration

---

## 🎯 Audit Objectives

Before building the meta-app, ensure each application:

1. ✅ Has Docker Compose configuration
2. ✅ Can deploy to Railway.com independently
3. ✅ Has working containerized tests (`make test`)
4. ✅ Works correctly post-SDK migration
5. ✅ Has documented environment variables
6. ✅ Has health check endpoints

---

## 📊 Current State Summary

| App | Docker | docker-compose | Railway | Tests | Status |
|-----|--------|----------------|---------|-------|--------|
| aviation-accident-tracker | ❌ | ❌ | ❌ | ⚠️ | **NEEDS WORK** |
| aviation-missions-app | ✅ | ✅ | ✅ (sleeping) | ⚠️ | **MOSTLY READY** |
| flight-tracker | ❌ | ❌ | ❌ | ⚠️ | **NEEDS WORK** |
| flightplanner | ✅ | ✅ | ✅ (sleeping, 2 warnings) | ⚠️ | **MOSTLY READY** |
| flightschool | ❌ | ❌ | ❌ | ⚠️ | **NEEDS WORK** |
| foreflight-dashboard | ✅ | ✅ | ✅ (sleeping, 4 warnings) | ⚠️ | **MOSTLY READY** |
| weather-briefing | ❌ | ❌ | ❌ | ⚠️ | **NEEDS WORK** |

**Legend:**
- ✅ Present and working
- ⚠️ Present but needs testing
- ❌ Missing or broken

---

## 📋 Detailed App Audit

### 1. Aviation Accident Tracker

**Status:** 🔴 **CRITICAL - Missing Infrastructure**

**Current State:**
- Backend: TypeScript/Express (builds successfully)
- Frontend: React/Vite (builds successfully)
- Docker: ❌ **NO DOCKER FILES**
- Railway: ❌ **NOT DEPLOYED**
- Tests: Has Makefile target but not containerized

**Required Actions:**
- [ ] Create backend Dockerfile
- [ ] Create frontend Dockerfile
- [ ] Create docker-compose.yml
- [ ] Add Railway configuration
- [ ] Create containerized test target
- [ ] Document environment variables

**Priority:** P0 (Blocks meta-app)

---

### 2. Aviation Missions App (Clojure)

**Status:** 🟡 **MOSTLY READY**

**Current State:**
- Backend: Clojure/Ring
- Has: `Dockerfile`, `docker-compose.yml`
- Railway: ✅ **DEPLOYED** (sleeping)
- Tests: Has Makefile target

**Docker Files:**
```
apps/aviation-missions-app/
├── Dockerfile                 ✅
└── docker-compose.yml         ✅
```

**Required Actions:**
- [ ] Test docker-compose up locally
- [ ] Verify Railway deployment from monorepo
- [ ] Test containerized tests
- [ ] Check SDK integration (if any)
- [ ] Document environment variables

**Priority:** P1

---

### 3. Flight Tracker

**Status:** 🔴 **CRITICAL - Missing Infrastructure**

**Current State:**
- Backend: TypeScript/Node.js
- Docker: ❌ **NO DOCKER FILES**
- Railway: ❌ **NOT DEPLOYED**
- Tests: Has Makefile target but minimal

**Required Actions:**
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Add Railway configuration
- [ ] Implement tests
- [ ] Create containerized test target

**Priority:** P0 (Blocks meta-app)

---

### 4. FlightPlanner

**Status:** 🟡 **MOSTLY READY**

**Current State:**
- Backend: Python/FastAPI
- Frontend: React/Vite
- Has: Multiple Dockerfiles, `docker-compose.yml`, `docker-compose.prod.yml`
- Railway: ✅ **DEPLOYED** (sleeping, 2 warnings)
- Tests: Has pytest suite

**Docker Files:**
```
apps/flightplanner/
├── Dockerfile                      ✅ (root)
├── backend/Dockerfile              ✅
├── frontend/Dockerfile             ✅
├── docker-compose.yml              ✅
└── docker-compose.prod.yml         ✅
```

**Railway Warnings:**
- 2 warnings shown in dashboard (need investigation)

**Required Actions:**
- [ ] Test docker-compose up locally
- [ ] Investigate Railway warnings
- [ ] Verify Railway deployment from monorepo
- [ ] Test containerized tests
- [ ] Verify SDK integration (uses shared-sdk)

**Priority:** P1

---

### 5. FlightSchool

**Status:** 🔴 **CRITICAL - Missing Infrastructure**

**Current State:**
- Backend: Python/Flask
- Docker: ❌ **NO DOCKER FILES**
- Railway: ❌ **NOT DEPLOYED**
- Tests: Has pytest suite with Makefile targets

**Required Actions:**
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Add Railway configuration
- [ ] Create containerized test target
- [ ] Verify Google Calendar integration works in container

**Priority:** P0 (Blocks meta-app)

---

### 6. ForeFlight Dashboard

**Status:** 🟡 **MOSTLY READY**

**Current State:**
- Backend: Python/FastAPI
- Frontend: React/Vite
- Has: `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`
- Railway: ✅ **DEPLOYED** (sleeping, 4 warnings)
- Tests: Has comprehensive test suite

**Docker Files:**
```
apps/foreflight-dashboard/
├── Dockerfile                      ✅
├── docker-compose.yml              ✅
└── docker-compose.prod.yml         ✅
```

**Railway Warnings:**
- 4 warnings shown in dashboard (need investigation)

**Required Actions:**
- [ ] Test docker-compose up locally
- [ ] Investigate Railway warnings (4)
- [ ] Verify Railway deployment from monorepo
- [ ] Test containerized tests
- [ ] Verify SDK integration (uses shared-sdk)

**Priority:** P1

---

### 7. Weather Briefing

**Status:** 🔴 **CRITICAL - Missing Infrastructure**

**Current State:**
- Backend: TypeScript/Node.js
- Docker: ❌ **NO DOCKER FILES**
- Railway: ❌ **NOT DEPLOYED**
- Tests: Has Makefile target but minimal

**Required Actions:**
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Add Railway configuration
- [ ] Implement tests
- [ ] Create containerized test target

**Priority:** P0 (Blocks meta-app)

---

## 🚀 Railway Deployment Status

**Current Railway Project:** https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd

**Currently Deployed (3 apps):**
1. ✅ **aviation-missions-app** - Sleeping
2. ✅ **flightplanner** - Sleeping (2 warnings)
3. ✅ **foreflight-dashboard** - Sleeping (4 warnings)

**Not Deployed (4 apps):**
4. ❌ **aviation-accident-tracker**
5. ❌ **flight-tracker**
6. ❌ **flightschool**
7. ❌ **weather-briefing**

**Railway CLI Installed:** ✅ `railway 4.15.1`

---

## 📦 Docker Compose Patterns

### Current Patterns Observed

**aviation-missions-app:**
- Single service (Clojure backend)
- Port 3000

**flightplanner:**
- Multi-service (backend + frontend)
- Backend: Python/FastAPI (port 8000)
- Frontend: React/Vite (port 5173)
- Separate prod configuration

**foreflight-dashboard:**
- Multi-service (backend + frontend)
- Backend: Python/FastAPI (port 8000)
- Frontend: React/Vite (port 5173)
- Separate prod configuration

### Recommended Standard Pattern

All apps should follow consistent structure:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./backend:/app
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:  # If applicable
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

---

## 🧪 Test Infrastructure

### Current Root Makefile Test Target

```makefile
test: test-node test-python test-clojure
```

**Issue:** Tests run locally, not in containers

### Required: Containerized Test Pattern

Each app should support:

```bash
# From app directory
make test          # Run tests locally
make test-docker   # Run tests in container

# From root
make test          # Run all apps' tests in containers
```

**Implementation Pattern:**

```makefile
test-docker:
	docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
	docker-compose -f docker-compose.test.yml down
```

---

## 🔧 Required Actions Summary

### P0 (Critical - Blocks Meta-App)

**4 Apps Need Complete Docker Infrastructure:**

1. **aviation-accident-tracker**
   - Create backend Dockerfile
   - Create frontend Dockerfile  
   - Create docker-compose.yml
   - Add Railway config

2. **flight-tracker**
   - Create Dockerfile
   - Create docker-compose.yml
   - Add Railway config

3. **flightschool**
   - Create Dockerfile
   - Create docker-compose.yml
   - Add Railway config

4. **weather-briefing**
   - Create Dockerfile
   - Create docker-compose.yml
   - Add Railway config

### P1 (Important - Validation)

**3 Apps Need Testing & Fixes:**

5. **aviation-missions-app**
   - Test docker-compose
   - Verify Railway deployment
   - Test containerized tests

6. **flightplanner**
   - Test docker-compose
   - Investigate 2 Railway warnings
   - Verify Railway deployment

7. **foreflight-dashboard**
   - Test docker-compose
   - Investigate 4 Railway warnings
   - Verify Railway deployment

---

## 📝 Next Steps

### Phase 1: Create Missing Docker Infrastructure (P0)
1. Create Dockerfiles for 4 apps
2. Create docker-compose.yml for 4 apps
3. Test locally with `docker-compose up`

### Phase 2: Railway Configuration (P0/P1)
1. Configure Railway to deploy from monorepo subdirectories
2. Deploy 4 new apps to Railway
3. Investigate warnings on 2 existing apps

### Phase 3: Containerized Tests (P1)
1. Create docker-compose.test.yml for each app
2. Add `make test-docker` targets
3. Update root Makefile to run containerized tests

### Phase 4: Validation (P1)
1. Verify each app works standalone
2. Verify SDK integration
3. Document deployment procedures

---

## ✅ Success Criteria

Before proceeding to meta-app:

- [ ] All 7 apps have Docker Compose configurations
- [ ] All 7 apps can deploy to Railway independently
- [ ] All 7 apps have working containerized tests
- [ ] Root `make test` runs all apps in containers
- [ ] Railway project configured for monorepo deployment
- [ ] All warnings/issues resolved
- [ ] Documentation complete

---

**Status:** In Progress  
**Blocking:** Aviation-6pc (Meta-App Epic)  
**Priority:** P0 (Highest)
