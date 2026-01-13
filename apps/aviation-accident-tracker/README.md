# Aviation Accident Tracker

> Part of the Aviation monorepo. Tracks and visualizes aviation accidents/incidents (>= year 2000) with provenance and GA/Commercial classification.

## Overview
- Ingests recent accidents/incidents from trusted public sources (initially ASN, AVHerald), normalizes to UTC/Z, and de-duplicates by (date_z, registration).
- Preserves provenance (source URL, fetched time, checksum) and classification (general, commercial, unknown).
- UI: map (Mercator) with clustered pins, airport/region and GA/Commercial filters, and a date-sorted table with details.

## Structure
```
apps/aviation-accident-tracker/
├── PLAN.md            # Epic/work breakdown
├── beads.yaml         # Epics as beads
├── backend/           # Service, ingestion, API, DB
└── frontend/          # Vite/React UI
```

## Quickstart (placeholder)
```bash
# Backend
cd apps/aviation-accident-tracker/backend
npm install
npm run build
npm start

# Frontend
cd apps/aviation-accident-tracker/frontend
npm install
npm run dev
```

## Scripts (app-level Makefile)
```bash
make build   # build backend + frontend
make test    # placeholder tests
make start   # start backend (placeholder)
```

## Notes
- Secrets: use keystore for DB/proxy credentials.
- Data window: only >= 2000; normalize all timestamps to Zulu.
- Uniqueness: (date_z, registration) primary; fuzzy merge fallback (date_z±1d, country, type).
