# Aviation airports interface

`aviation.airports` exposes normalized airport data and pure query semantics. Bindings
may use idiomatic names while preserving these operations.

| Operation | Contract |
| --- | --- |
| Normalize records | Omit invalid identities/coordinates; normalize codes and optional fields |
| Lookup by code | Case-insensitive ICAO/IATA/US-prefix lookup; missing returns no record |
| Text search | Deterministic ranking with exact code matches first and an explicit limit |
| Proximity search | WGS-84 origin and radius in nautical miles; nearest-first results |
| Field elevation | Optional finite feet MSL; missing is distinct from zero |

## Normalized record

- `icao`: required uppercase identity.
- `iata`: optional uppercase identity.
- `name`: string, possibly empty when the source has none.
- `city`, `country`, `region`, and `type`: optional descriptive strings.
- `latitude`: finite decimal degrees in `[-90, 90]`.
- `longitude`: finite decimal degrees in `[-180, 180]`.
- `elevation`: optional finite feet MSL.
- `distance_nm`: query-only finite non-negative nautical miles.

## Compatibility

Adding an optional descriptive field or query is backward compatible. Changing identity
rules, units, coordinate ranges, missing-value semantics, ranking, or result shapes is
a breaking interface change.
