---
id: Aviation-0ch
status: closed
deps: []
links: []
created: 2026-01-16T22:49:57.99692-08:00
type: feature
priority: 1
mac-task-id: task_b4c55c609399469f8ccd2dbcfdcb2057
---
# Flight tracker: interactive map selection and multi-flight tracking

The flight tracker homepage lacks UI to select flights. Add interactive map controls similar to FlightRadar24 so users can click aircraft icons to track flights and view details.\n\nRequirements:\n- Render a global map with aircraft icons the user can click\n- Clicking an aircraft adds it to a tracked flights table\n- Show flight tracks (breadcrumb trail) for each tracked flight on the map\n- Support tracking multiple flights simultaneously\n- Real-time updates for tracked flights (positions, status, metadata)\n- Allow removing flights from the tracked table, which also removes the track/marker from the map\n\nAcceptance Criteria:\n- User can click any aircraft icon to start tracking it and see it in the table\n- Map shows track lines for each tracked flight\n- Removing a flight from the table stops updates and removes its track\n- UI provides obvious way to select flights and view their details\n- Behavior works in production deployment

## Close Reason

Closed
