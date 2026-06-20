---
id: flightplanner-ly5
status: closed
deps: []
links: []
created: 2025-12-18T22:45:59.290121-05:00
type: bug
priority: 2
mac-task-id: task_4c6b72583071447c9d75ba86795572ec
---
# aviation-missions-app CI: DB migration test asserts on missing 'missions_loaded' log

In run https://github.com/jordanhubbard/aviation-missions-app/actions/runs/20358738331 job 🗄️ Database Migration Test (ID 58499484501), step fails because it greps logs for the string missions_loaded (docker logs fresh-db-test | grep 'missions_loaded') and finds no match. Either the log message was renamed/removed or the seed doesn't run. Fix test to assert on an HTTP endpoint (e.g., /health) and/or query the DB for expected seeded rows instead of grepping logs; or restore the expected log message.

## Close Reason

Fixed in aviation-missions-app: nightly fresh-db check now waits for /health and asserts missions_loaded
