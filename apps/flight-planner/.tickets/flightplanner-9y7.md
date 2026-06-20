---
id: flightplanner-9y7
status: closed
deps: []
links: []
created: 2025-12-17T21:23:38.965043-05:00
type: bug
priority: 1
mac-task-id: task_5e64013472b64ee28efeea9f5e88ff69
---
# Normalize airport code inputs with descriptions

Allow inputs like 'KPAO - Palo Alto Airport' (or em/en dashes) and use only the code part for lookups and requests.

## Close Reason

Updated frontend validation to extract leading 3-4 letter code from strings with dash descriptions; use normalized codes for plan/weather requests; backend also normalizes codes
