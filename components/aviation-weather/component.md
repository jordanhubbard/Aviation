---
namespace: aviation
version: 0.4.0
display_name: Aviation weather
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.weather
    version: 0.4.0
    interface:
      uri: interfaces/weather.md
      pin: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application-implementation/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
workflow_definition:
  uri: workflows/production/staging/dev/workflow.md
routing_policy:
  uri: routing/production/staging/dev/routing.json
flavor_slots: []
entrypoints: []
acceptance_contracts:
  - kind: acceptance-contract
    uri: acceptance/weather.md
source_dependencies: []
---
# Aviation weather

This Component owns provider-neutral aviation-weather observations, METAR parsing,
flight-category classification, operational warnings, forecast normalization, and
departure-window scoring. It also owns adapters for the established Aviation Weather,
Open-Meteo, and OpenWeatherMap providers. It does not own airport identity, route
planning, aircraft-specific limitations, application presentation, or pilot-in-command
decision making.

The public surface is defined by `interfaces/weather.md`. Every language binding must
pass `acceptance/weather.md` against `acceptance/vectors.json`.

### Requirement: Applications consume one weather capability

Applications SHALL use `aviation.weather` for METAR parsing, provider access,
flight-category classification, warnings, and forecast scoring. Application-private
code MAY combine weather with routes, aircraft limitations, or presentation, but SHALL
NOT retain independent implementations of the common algorithms or provider adapters.

#### Scenario: A flight planner requests current conditions

- **WHEN** the planner fetches and classifies airport weather
- **THEN** its private service layer delegates acquisition and interpretation to
  `aviation.weather`

### Requirement: Weather semantics are deterministic

Visibility SHALL use statute miles, wind speed SHALL use knots, ceiling SHALL use feet
AGL, temperature SHALL use degrees Fahrenheit where the public field is suffixed `_f`,
and flight categories SHALL be one of `VFR`, `MVFR`, `IFR`, `LIFR`, or `UNKNOWN`.
Missing observation values SHALL remain missing rather than becoming operationally
favorable defaults.

#### Scenario: Required category inputs are missing

- **WHEN** visibility or ceiling is absent
- **THEN** classification returns `UNKNOWN`

### Requirement: Flight-category boundaries match AWC categories

VFR requires visibility greater than 5 statute miles and a ceiling greater than
3,000 feet AGL. Exactly 5 SM or 3,000 feet belongs to MVFR; IFR boundaries remain
below 3 SM or 1,000 feet and LIFR below 1 SM or 500 feet. These categories do not
replace regulatory VFR minima. Missing required inputs remain `UNKNOWN`.

#### Scenario: An observation is exactly on a VFR boundary

- **WHEN** both category inputs are present and visibility is exactly 5 SM or the ceiling is exactly 3,000 feet AGL
- **THEN** the category is MVFR unless another input establishes IFR or LIFR

### Requirement: Provider access is bounded and cacheable

Provider adapters SHALL use bounded timeouts, normalize station identifiers, reject
provider error responses, and support finite-TTL caching with stale-on-error behavior
where an earlier successful observation exists.

#### Scenario: A provider is temporarily unavailable

- **WHEN** a cached value has expired and refresh fails
- **THEN** an adapter configured for stale fallback may return the last successful value

### Requirement: Independent acceptance owns parity

TypeScript and Python realizations SHALL execute the same Component-owned synthetic
vectors. Network access and provider credentials SHALL NOT be required by acceptance.

#### Scenario: A parser changes

- **WHEN** its normalized output diverges from a shared vector
- **THEN** common SDK CI fails before an application can mask the regression

### Requirement: AWC JSON products share a fixed acquisition boundary

The common capability SHALL acquire the six existing AWC JSON products through
the fixed HTTPS Aviation Weather Center data origin and closed parameter rules
specified in the interface. It SHALL invoke the caller's trusted bounded JSON
transport exactly once, force JSON format, reject non-list or non-record report
responses, and preserve every raw report, nested field, null and report order.
Applications MAY retain generic HTTP transport, bounded cache, retrieval-time
provenance, route batching and station matching. JSON acquisition SHALL NOT inherit
the separate raw-METAR stale fallback or silently replace complete TAF/advisory
products with a parsed METAR summary.

#### Scenario: A route requests full TAF products

- **WHEN** the application requests at most forty provider station IDs
- **THEN** the common capability validates and acquires the exact JSON product
- **AND** the application retains full returned forecasts, available/no-reports
  status, provider attribution and explicit partial failures

### Requirement: Pressure-level forecasts have one provider owner

The capability SHALL own fixed-origin Open-Meteo pressure-level request planning
and acquisition, with the exact bounded inputs, variable ordering, units, UTC
offset and aligned-array rules in the public interface. It SHALL preserve raw
provider data and first-occurrence level order, reject unit drift and boolean
numeric impostors, and never convert pressure surfaces into fixed flight
altitudes or imply observed winds. Applications MAY retain generic transport,
cache, provenance and presentation. Existing surface/daily/hourly operations and
their query spellings, defaults and fallback behavior SHALL remain unchanged.

#### Scenario: A pilot requests modeled winds aloft

- **WHEN** the application requests the supported pressure levels and bounded hours
- **THEN** common weather plans and validates the exact provider product once
- **AND** the application preserves source units, nulls and modeled-data limitations
  without substituting observations, interpolation or stale success

### Requirement: Station discovery shares a complete provider catalog

Common weather SHALL acquire and interpret the fixed AWC gzip/JSON station catalog
through a trusted bounded transport. It SHALL validate the whole catalog before
returning located raw rows and explicit unlocated accounting, using the numeric,
identifier and paired-sentinel rules in the public interface. Applications retain
generic decompression, cache, provenance and route/station selection.

#### Scenario: A catalog contains stations with unknown coordinates

- **WHEN** both coordinates satisfy the documented provider sentinel
- **THEN** common weather excludes that row from geometry and counts it explicitly
- **AND** preserves its nonempty TAF ICAO identity without inventing a location
