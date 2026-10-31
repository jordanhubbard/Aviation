# `aviation.notam` interface

## Canonical record

- `id`: required canonical identifier.
- `type`: required canonical notice type.
- `location`: required canonical airport/facility identity.
- `facilityType`: required canonical facility class such as `AD`, `EN`, or `NAV`.
- `effectiveStart` and `effectiveEnd`: valid ISO-8601 instants with an inclusive,
  non-inverted window.
- `classification`: provider classification text, trimmed but otherwise preserved.
- `text`: required trimmed notice text.
- `severity`: derived `low`, `medium`, `high`, or `critical` value.
- `category`: derived portable category label.

Python exposes the same record as `Notam` with snake-case field names.

## Operations

- `normalizeNotamRecord(input)`: validate and canonicalize a provider-neutral input,
  deriving severity and category without mutating the input.
- `categorizeNotamSeverity(record)`: apply stable critical, high, medium, then low
  keyword precedence.
- `categorizeNotam(text)`: derive Runway, Taxiway, Apron/Ramp, Lighting, Navigation,
  Obstacle, Airspace, Communications, Fuel, Weather, or General.
- `isNotamEffective(record, instant)`: test the inclusive effective window.
- `filterRelevantNotams(records, routeIcaos, includeEnroute, instant)`: retain only
  effective route/en-route records in input order.
- `sortNotamsBySeverity(records)`: return a stable critical-to-low copy without
  mutating the input.
- `formatNotamText(text)`: collapse whitespace and expand the declared conservative
  abbreviation set.

Provider clients MAY expose idiomatic adapters around these operations. Adding an
optional descriptive field or a new provider adapter is backward compatible. Changing
required fields, time boundaries, severity/category precedence, route matching,
ordering, or text expansion is a breaking interface change.
