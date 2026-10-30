# Aviation navigation-data interface

`aviation.nav-data` exposes provider-neutral records and catalog behavior. Bindings may
use idiomatic names while preserving these operations.

| Operation | Contract |
| --- | --- |
| Ingest bundle | Validate metadata and normalize navaids, procedures, and airspace |
| Search navaids | Case-insensitive identifier/name substring match with stable order |
| Select procedures | Filter by airport, type, and optional runway |
| Normalize airspace | Retain valid GeoJSON Features and reject malformed collections |
| Report status | Return record counts, source, cycle, effective dates, and freshness |
| Classify freshness | Return current/expired/future/undated at an explicit instant |

## Record conventions

- Identifiers, airport ICAO codes, procedure types, runways, transitions, and fix names
  are uppercase.
- Latitude is decimal degrees in `[-90, 90]`; longitude is in `[-180, 180]`.
- Frequencies are positive numbers when present.
- Procedure types are `SID`, `STAR`, or `APPROACH`.
- Effective date strings are ISO-8601 UTC instants.

## Compatibility

Adding optional record fields is backward compatible. Changing units, normalization,
freshness boundaries, query ordering, procedure filtering, or required provenance is a
breaking interface change.
