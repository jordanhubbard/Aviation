---
id: Aviation-dhw.16.1
status: open
deps: []
links: []
created: 2026-01-24T11:50:06.524183-08:00
type: task
priority: 2
parent: Aviation-dhw.16
mac-task-id: task_058914d9fce3475dbf43552f7b22dcf7
---
# Story: Pre-recorded training scenarios

## Scenario Types
1. Pattern Work
   - Takeoff, climb to pattern altitude (1000 AGL)
   - Standard traffic pattern (left/right)
   - Approach, landing, go-around option
2. GPS Approach
   - Establish on final course
   - Descend on glidepath
   - Decision altitude (DA) callout
   - Land or missed approach
3. Cross-Country
   - Depart origin
   - En-route navigation (multiple waypoints)
   - Weather deviation
   - Arrive destination
4. Emergency
   - Engine failure
   - Electrical failure
   - Lost procedures
   - Diversion

## Scenario Data Format (YAML)
Includes `initial_conditions`, `waypoints`, and timed `events` (radio calls, checklist reminders).
