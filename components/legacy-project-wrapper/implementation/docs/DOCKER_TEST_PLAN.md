# Docker Deployment Test Plan

**Epic:** Aviation-1qg (P0)  
**Story:** Aviation-1qg.2 (Test existing Docker deployments)  
**Date:** January 15, 2026

---

## 🎯 Purpose

Test and validate all 7 aviation applications' Docker infrastructure:
- 3 apps with existing Docker (missions-app, flight-planner, foreflight-dashboard)
- 4 apps with newly created Docker (accident-tracker, flight-tracker, flightschool, weather-briefing)

---

## 📋 Test Checklist

### For Each Application

- [ ] **Docker Build**: `make docker-build` succeeds
- [ ] **Container Startup**: `make docker-up` starts services
- [ ] **Health Check**: Service reports healthy
- [ ] **API/Web Access**: Application accessible on expected port
- [ ] **Hot Reload**: Code changes reflect in running container (dev mode)
- [ ] **Logs**: `make docker-logs` shows application logs
- [ ] **Tests**: `make docker-test` runs tests successfully
- [ ] **Shutdown**: `make docker-down` stops cleanly
- [ ] **Data Persistence**: Volumes persist data across restarts

---

## 🧪 Test Procedures

### 1. Aviation Missions App (Clojure)

**Port:** 8080 (external) → 3000 (internal)  
**Tech:** Clojure/Ring  
**Docker:** ✅ Existing

#### Test Commands

```bash
cd apps/aviation-missions-app

# Build Docker image
docker-compose build

# Start service
docker-compose up -d

# Check health
curl http://localhost:8080/health

# View logs
docker-compose logs -f

# Test API endpoints
curl http://localhost:8080/api/missions

# Stop service
docker-compose down

# Test with custom port
PORT=9000 docker-compose up -d
curl http://localhost:9000/health
docker-compose down
```

#### Expected Results

- ✅ Build completes successfully
- ✅ Service starts on port 8080
- ✅ Health check returns 200 OK
- ✅ API responds with mission data
- ✅ Logs show "Server started"
- ✅ Data persists in `./data` volume

#### Known Issues

- None (deployed to Railway, sleeping)

---

### 2. FlightPlanner (Python/FastAPI + React)

**Ports:**  
- 3001 (React dev server - PRIMARY UI)
- 5051 (FastAPI backend)

**Tech:** Python/FastAPI, React/Vite  
**Docker:** ✅ Existing (multiple Dockerfiles)

#### Test Commands

```bash
cd apps/flight-planner

# Build Docker image
docker-compose build

# Start services
docker-compose up -d

# Check health
curl http://localhost:5051/health

# Check frontend
open http://localhost:3001

# View logs
docker-compose logs -f

# Test API
curl http://localhost:5051/api/airports/KSFO

# Stop services
docker-compose down
```

#### Expected Results

- ✅ Build completes for both frontend and backend
- ✅ FastAPI starts on port 5051
- ✅ React dev server starts on port 3001
- ✅ Health check returns 200 OK
- ✅ Frontend accessible and loads
- ✅ API responds with airport data
- ✅ Hot reload works for both frontend and backend

#### Known Issues

- **2 Railway warnings** (need investigation)
- May need to verify terrain data caching
- OpenWeatherMap API key required for full functionality

---

### 3. ForeFlight Dashboard (Python/FastAPI + React)

**Ports:**  
- 3001 (React dev server - PRIMARY UI)
- 5051 (FastAPI backend)

**Tech:** Python/FastAPI, React/Vite  
**Docker:** ✅ Existing

#### Test Commands

```bash
cd apps/foreflight-dashboard

# Build Docker image
docker-compose build

# Start services
docker-compose up -d

# Check health
curl http://localhost:5051/health

# Check frontend
open http://localhost:3001

# View logs
docker-compose logs -f

# Test API
curl http://localhost:5051/api/accounts

# Test file upload
curl -X POST -F "file=@sample.csv" http://localhost:5051/api/upload

# Stop services
docker-compose down
```

#### Expected Results

- ✅ Build completes for both frontend and backend
- ✅ FastAPI starts on port 5051
- ✅ React dev server starts on port 3001
- ✅ Health check returns 200 OK
- ✅ Frontend accessible and loads
- ✅ API responds with account data
- ✅ File uploads work
- ✅ CSV parsing works
- ✅ Data persists in `./data` volume

#### Known Issues

- **4 Railway warnings** (need investigation)
- May need to verify ForeFlight CSV parsing
- Ensure upload directory permissions are correct

---

### 4. Aviation Accident Tracker (TypeScript + React)

**Ports:**  
- 5173 (Vite dev server - PRIMARY UI)
- 3002 (Express API + GraphQL)

**Tech:** TypeScript/Express, React/Vite  
**Docker:** 🆕 Newly created

#### Test Commands

```bash
cd apps/aviation-accident-tracker

# Build Docker image
make docker-build

# Start services
make docker-up

# Check health
curl http://localhost:3002/health

# Check frontend
open http://localhost:5173

# View logs
make docker-logs

# Test REST API
curl http://localhost:3002/api/events

# Test GraphQL
curl -X POST http://localhost:3002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health { status } }"}'

# Test API docs
open http://localhost:3002/api-docs

# Stop services
make docker-down

# Run tests in Docker
make docker-test
```

#### Expected Results

- ✅ Build completes for both frontend and backend
- ✅ Express API starts on port 3002
- ✅ Vite dev server starts on port 5173
- ✅ Health check returns 200 OK
- ✅ Frontend accessible and loads
- ✅ REST API responds with event data
- ✅ GraphQL API responds
- ✅ Swagger docs accessible
- ✅ SQLite database created in `./data` volume
- ✅ Hot reload works

#### Known Issues

- None (newly created, not yet deployed)
- Needs ingestion cron job testing
- Verify graphql subscription functionality

---

### 5. Flight Tracker (TypeScript)

**Port:** 3001  
**Tech:** TypeScript/Node.js (background service)  
**Docker:** 🆕 Newly created

#### Test Commands

```bash
cd apps/flight-tracker

# Build Docker image
make docker-build

# Start service
make docker-up

# View logs (should show flight tracking)
make docker-logs

# Check if process is running
docker-compose exec flight-tracker pgrep -f "node.*flight-tracker"

# Stop service
make docker-down

# Run tests in Docker
make docker-test
```

#### Expected Results

- ✅ Build completes successfully
- ✅ Service starts and runs in background
- ✅ Logs show "Flight Tracker Service is now monitoring flights"
- ✅ Logs show weather updates for tracked airports
- ✅ Process remains running (not crashed)
- ✅ Health check passes

#### Known Issues

- None (newly created, not yet deployed)
- Requires flight API keys for real data (optional)
- Currently runs in demo mode with sample flights

---

### 6. FlightSchool (Python/Flask)

**Port:** 5000  
**Tech:** Python/Flask  
**Docker:** 🆕 Newly created

#### Test Commands

```bash
cd apps/flightschool

# Build Docker image
make docker-build

# Start service
make docker-up

# Check health
curl http://localhost:5000/

# Open in browser
open http://localhost:5000

# View logs
make docker-logs

# Test login
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Stop service
make docker-down

# Run tests in Docker
make docker-test
```

#### Expected Results

- ✅ Build completes successfully
- ✅ Flask starts on port 5000
- ✅ Home page loads
- ✅ Database migrations run
- ✅ Static files served correctly
- ✅ Authentication works
- ✅ SQLite database created in `./instance` volume
- ✅ Upload directory works

#### Known Issues

- None (newly created, not yet deployed)
- Google Calendar integration requires OAuth credentials
- Email functionality requires SMTP configuration

---

### 7. Weather Briefing (TypeScript)

**Port:** 3003  
**Tech:** TypeScript/Node.js (background service)  
**Docker:** 🆕 Newly created

#### Test Commands

```bash
cd apps/weather-briefing

# Build Docker image
make docker-build

# Start service
make docker-up

# View logs (should show weather briefing updates)
make docker-logs

# Check if process is running
docker-compose exec weather-briefing pgrep -f "node.*weather-briefing"

# Stop service
make docker-down

# Run tests in Docker
make docker-test
```

#### Expected Results

- ✅ Build completes successfully
- ✅ Service starts and runs in background
- ✅ Logs show "Weather Briefing Service started"
- ✅ Logs show weather data fetching
- ✅ Process remains running (not crashed)
- ✅ Health check passes

#### Known Issues

- None (newly created, not yet deployed)
- Requires weather API keys for full functionality
- AI-powered analysis requires OpenAI API key (optional)

---

## 🔍 Railway Deployment Investigation

### FlightPlanner (2 Warnings)

**Need to investigate:**
1. Check Railway dashboard for warning details
2. Verify environment variables are set correctly
3. Check build logs for any errors
4. Verify deployment configuration

**Commands to investigate:**

```bash
cd apps/flight-planner
railway status
railway logs
railway vars
```

### ForeFlight Dashboard (4 Warnings)

**Need to investigate:**
1. Check Railway dashboard for warning details
2. Verify environment variables are set correctly
3. Check build logs for any errors
4. Verify deployment configuration
5. Check if warnings are related to file upload permissions
6. Verify database migration status

**Commands to investigate:**

```bash
cd apps/foreflight-dashboard
railway status
railway logs
railway vars
```

---

## 🚀 Next Steps

### Immediate Actions

1. **Start Docker Daemon** (if testing locally)
   ```bash
   # macOS
   open -a Docker
   
   # Linux
   sudo systemctl start docker
   ```

2. **Test Each Application** using the procedures above

3. **Document Issues** found during testing

4. **Fix Any Issues** discovered

### Story 3: Railway Configuration

After local Docker testing is complete:

1. **Log in to Railway**
   ```bash
   railway login
   ```

2. **Link to project**
   ```bash
   railway link
   ```

3. **Configure monorepo deployments**
   - Determine if Railway supports subdirectory deployments
   - Configure each service to deploy from `apps/<app-name>`
   - Set environment variables per service

### Story 4: Containerized Testing

After all apps are validated:

1. **Update root Makefile** to run all tests in containers
2. **Verify CI/CD** picks up containerized tests
3. **Document** test procedures

---

## ✅ Success Criteria

- [ ] All 7 apps build successfully with Docker
- [ ] All 7 apps start and run in Docker
- [ ] All health checks pass
- [ ] All APIs/UIs accessible on expected ports
- [ ] Hot reload works in development mode
- [ ] Tests run successfully in Docker
- [ ] Data persists across container restarts
- [ ] Railway warnings investigated and resolved
- [ ] Documentation complete

---

## 📝 Notes

**Docker Daemon Status:** Not running (expected in current environment)  
**Testing Environment:** Local development machine  
**Next Test Session:** When Docker daemon is available

**Manual Testing Required:**
- Actual docker-compose up/down cycles
- Health check verification
- API/UI accessibility
- Data persistence testing
- Railway deployment testing
