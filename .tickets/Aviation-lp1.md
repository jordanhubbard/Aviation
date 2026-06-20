---
id: Aviation-lp1
status: closed
deps: []
links: []
created: 2026-01-17T22:25:51.118673-08:00
type: bug
priority: 0
mac-task-id: task_4d4593aa842e43e7b6c41f7915d61fb2
---
# PROD: Flight Planner airports endpoint crashes with layerPointToLatLng error

## Critical Production Error

**Application:** flight-planner  
**Environment:** Production (flight-planner-production.up.railway.app)  
**Endpoint:** /airports  
**Severity:** P0 - Service Down

### Error Details
```
TypeError: Cannot read properties of undefined (reading 'layerPointToLatLng')
```

### Impact
- Airports endpoint completely unavailable in production
- Users cannot access airport search/lookup functionality
- Core feature of the flight planner is broken

### Steps to Reproduce
1. Navigate to https://flight-planner-production.up.railway.app/airports
2. Page crashes with TypeError

### Expected Behavior
Airports endpoint should load and display airport search/lookup interface

### Actual Behavior
Application crashes with undefined reference error related to Leaflet map layer point conversion

### Investigation Needed
- Check if Leaflet map is properly initialized before layerPointToLatLng is called
- Verify map container exists and is mounted
- Check for race conditions in map initialization
- Review recent changes to airports page/component

### Priority Justification
P0 because this breaks a core feature in production and affects all users trying to access the airports endpoint.

## Close Reason

Fixed Leaflet map initialization race condition with null checks and error handling
