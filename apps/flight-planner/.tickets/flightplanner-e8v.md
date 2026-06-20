---
id: flightplanner-e8v
status: closed
deps: []
links: []
created: 2025-12-18T05:47:10.732921-05:00
type: bug
priority: 2
mac-task-id: task_943440c49b9249ab9e777f9971cbff3f
---
# Hide non-reporting airports from local map weather status circles

LocalMap currently renders gray UNKNOWN status circles for nearby airports that don't publish METAR/flight category. Only render status circles for airports with a known flight category (VFR/MVFR/IFR/LIFR); do not show UNKNOWN circles.

## Close Reason

Filter LocalMap weather status circles to only render airports with a known flight category (VFR/MVFR/IFR/LIFR); hide UNKNOWN (non-reporting) points and avoid gray wind-barb backgrounds for UNKNOWN
