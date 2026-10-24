# Changelog

## Unreleased

- Accident Tracker discovers matching publisher headlines during ingestion, stores citation titles and links, and expands citations beneath each event row.
- Flight Planner loads saved plans from its deployed API route and rejects invalid responses; Aviation Chat explains its API-only role at its root URL.
- Deployment verification now renders all eleven public application roots in Chromium and checks key Accident Tracker, Flight Planner, and Chat interactions.
- ForeFlight Dashboard accepts solo time that overlaps PIC time and verifies a synthetic logbook upload in the post-deployment browser gate.
- ForeFlight Dashboard no longer rejects rapid pattern-work landing counts based on a fixed four-minute-per-landing assumption; post-deployment browser checks cover eight landings in half an hour.

- Restored the Aviation deployment workflow after source relocation: all four image builds and the staging dry run pass on main.

- Adopted the Aviation monorepo into Literate AI with retained application entrypoints, current locks, and retained test evidence.
- Integrated Flight Track Analyzer with bundled airport MSL elevations to support calibrated touchdown detection, plus API, UI, tests, and CI.
- Updated retained dependencies to resolve Trivy findings reported during the conversion.

- Initialized the project with Literate AI's specification-led lifecycle and durable
  user-directed work queue.
