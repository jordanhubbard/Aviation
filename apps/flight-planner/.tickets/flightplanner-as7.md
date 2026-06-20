---
id: flightplanner-as7
status: closed
deps: []
links: []
created: 2025-12-18T22:46:00.471629-05:00
type: bug
priority: 1
mac-task-id: task_70f9d785e85b498a8fc4fa3c1e27ece5
---
# aviation-missions-app CI: Clojure test failures in db/validation

In run https://github.com/jordanhubbard/aviation-missions-app/actions/runs/20358738331 job 🧪 Extended Test Suite (ID 58499484502), lein test reports multiple failures. Examples from log: (1) db/create-mission! with invalid category expected to throw but returns nil; (2) rating operations expected pilot_name 'Happy Pilot' but got nil; (3) mission update expected updated_at != created_at but they are equal; (4) validation edge cases expect difficulty spec valid for Integer/MIN_VALUE and Integer/MAX_VALUE but it's invalid. Fix underlying constraints/specs or update tests to reflect intended bounds and timestamp behavior.

## Close Reason

Fixed in aviation-missions-app: backend changes + test fixes; lein test now passes
