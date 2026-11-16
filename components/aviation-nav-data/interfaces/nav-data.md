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
| Adapt provider data | Translate provider formats into this interface and `aviation.airports`; do not add provider-owned query behavior |

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

Provider adapter additions are backward compatible when they return these existing
records. A provider package that exports its own catalog, cache, search, distance, or
procedure-selection semantics is outside this interface.

## Exclusive provider intervals

Optional `effective_until` supplies an exclusive end instant: the record expires
at or after it. Existing `effective_through` remains inclusive and unchanged.
Nonempty inclusive and exclusive ends cannot coexist. A supplied start must
precede an exclusive end; dates require explicit timezones. Normalization and
catalog status retain `effective_until` when supplied, without adding it to
legacy metadata. Paired conformance covers exact end boundaries, legacy inclusive
behavior and invalid or ambiguous intervals.
