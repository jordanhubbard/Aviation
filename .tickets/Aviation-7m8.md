---
id: Aviation-7m8
status: closed
deps: [Aviation-rs4]
links: []
created: 2026-01-13T11:25:16.31731-08:00
type: epic
priority: 1
mac-task-id: task_d6a096c432444e1680f74f5e62d1a859
---
# Aviation Accident Tracker: Database

Schema/migrations for events+sources, indexes, >=2000 constraint, upsert by (date_z, registration), repo layer.

## Close Reason

Database schema complete: schema.sql with events+sources tables, >=2000 constraint, indexes (date_z, reg+date, geo, airport, category). Repository layer with upsert by (date_z, registration), list/filter, detail with sources, snake_case->camelCase conversion.
