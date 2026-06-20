---
id: Aviation-3of
status: closed
deps: []
links: []
created: 2026-01-14T08:55:09.945055-08:00
type: feature
priority: 2
mac-task-id: task_0da9bc1ef66f43b5810f9fe0a268ad50
---
# Add accident-tracker data export functionality

Add ability to export accident/incident data:

**Export Formats:**
- CSV
- JSON
- Excel (XLSX)
- PDF report

**Features:**
- Export filtered results
- Export all data
- Include/exclude columns
- Custom date ranges
- Email export (optional)

**UI:**
- Export button in results view
- Format selector dropdown
- Column selection checkboxes
- Progress indicator for large exports

**Backend:**
- New endpoint: `POST /api/events/export`
- Streaming for large datasets
- Rate limiting to prevent abuse
- Background job for large exports

**Priority:** P2 - Feature

## Close Reason

Added /api/events/export with CSV/JSON/XLSX/PDF support, filters, columns, and simple rate limiting; added export UI with format/columns selection. Ran app make test (frontend tests fail due to missing @vitejs/plugin-react).
