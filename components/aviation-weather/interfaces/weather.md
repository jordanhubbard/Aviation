# Aviation weather interface

`aviation.weather` exposes provider-neutral observation and forecast behavior. Bindings
may use idiomatic names while preserving these operations and units.

| Operation | Contract |
| --- | --- |
| Parse METAR | Extract wind, visibility, Fahrenheit temperature, and lowest ceiling |
| Classify conditions | Return VFR/MVFR/IFR/LIFR/UNKNOWN from visibility and ceiling |
| Recommend and warn | Produce deterministic category guidance and threshold warnings |
| Normalize provider weather | Convert provider payloads to the common airport-weather shape |
| Fetch observations | Normalize stations, bound requests, and expose provider failures |
| Fetch AWC JSON reports | Fixed six-product acquisition through an injected trusted bounded JSON transport; preserve complete raw report records |
| Fetch pressure-level forecast | Fixed Open-Meteo request planning and acquisition; preserve raw data and validate requested units/array alignment |
| Fetch forecasts | Validate requested horizons and normalize current/daily/hourly fields |
| Score departure windows | Deterministically rank forecast windows, best first |

## Units and missing values

- Wind direction: degrees true; variable wind is absent.
- Wind speed and gust: knots.
- Visibility: statute miles.
- Ceiling: feet AGL, lowest BKN/OVC/VV layer.
- Temperature fields suffixed `_f`: degrees Fahrenheit.
- Missing values are absent/null and are not silently replaced with favorable weather.

## Compatibility

Adding an optional provider field is backward compatible. Changing units, category
thresholds, missing-value behavior, normalized field names, warning text, or scoring
order is a breaking interface change.

Observation acquisition accepts raw reports with optional `METAR` or `SPECI`
prefixes, matches the following station token, and preserves the complete raw report.

## AWC JSON acquisition

TypeScript `fetchAWCJSONReports(product, params, transport)` is asynchronous;
Python `fetch_awc_json_reports(product, params, transport)` is synchronous. Both
return `{url, reports}`. URL is exactly
`https://aviationweather.gov/api/data/` plus one of `metar`, `taf`, `pirep`,
`gairmet`, `airsigmet`, `cwa`. There is no caller-selected origin, path, format,
credential or automatic retry. A shared provider URL constant also supplies the
existing raw-METAR implementation's default origin.

Only these parameters are admitted, before invoking transport:

- METAR/TAF: exactly `ids`, a string of at most 8192 characters containing a
  comma-separated list of one to forty station IDs. Trim ASCII space, tab, CR and
  LF from each ID, validate ASCII syntax, then uppercase; require one to eighty ASCII letters, digits,
  underscores, dots or hyphens, beginning with a letter or digit. Preserve order
  and duplicates. Extended IDs remain available for the existing provider catalog;
  public application routes may retain narrower airport validation.
- PIREP: exactly `id`, `distance`, `age`. Normalize one station ID as above,
  with the same 8192-character input ceiling;
  distance is a finite number in [1, 500] nautical miles, age is an integer in
  [1, 24] hours. Booleans are not numbers.
- GAIRMET/AIRSIGMET/CWA: no parameters.

Transport receives `(url, {...validatedParams, format: 'json'})` exactly once.
It is trusted to enforce the existing twenty-second request timeout, reject HTTP
errors, return parsed JSON, map HTTP 204 to an empty list, and reject responses
larger than 20 MiB after download. This existing post-download check is not a
streaming memory cap; an injected callback does not independently establish those
bounds. The common capability accepts only a list of object records. It preserves
their complete contents and order; empty lists remain empty. It exposes generic
request/response/provider errors without echoing transport exception text, URLs or
credentials. There is no stale fallback or cache in this acquisition function.

The Planner compatibility adapter retains its five-minute bounded cache, source
URL/provider/retrieval timestamp and `available`/`no_reports` envelope. Transport or
schema failure remains HTTP 503/unavailable and never becomes an empty successful
response. Existing route batching and mixed-success behavior remain application
policy.

## Open-Meteo pressure-level forecasts

TypeScript `planPressureLevelForecast(lat, lon, levels, hours)` and Python
`plan_pressure_level_forecast(lat, lon, levels, hours)` return
`{url, params, levels_hpa}`. The URL is exactly
`https://api.open-meteo.com/v1/forecast`; no caller-selected origin is accepted.
`getPressureLevelForecast(lat, lon, levels, hours, transport)` and Python
`get_pressure_level_forecast(lat, lon, levels, hours, transport)` acquire through
the same planner and return `{url, data, levels_hpa}`. Acquisition accepts original
inputs, not a caller-modifiable plan. Planning is pure and supplies normalized
levels for application-owned cache keys.

Coordinates are finite numbers in latitude [-90, 90] and longitude [-180, 180].
Supply one to eight numeric integer level entries drawn from
`[1000, 925, 850, 700, 500, 300, 250, 200]` hPa. Preserve first-occurrence order
when deduplicating. Python integer enums are supported; booleans are rejected in
every numeric input. Hours is an integer value in [1, 72].

For each deduplicated level, request variables in this exact order:
`wind_speed`, `wind_direction`, `temperature`, `geopotential_height`, each suffixed
`_<level>hPa`, joined by commas. Params also include the input latitude/longitude,
`wind_speed_unit=kn`, `temperature_unit=celsius`, `timezone=UTC` and
`forecast_hours=hours`. A common constant supplies the forecast URL to existing
Open-Meteo methods without changing their other query fields or behavior.

Transport has the same trusted twenty-second, HTTP-error, parsed-JSON and
20 MiB post-download obligations described above; these are not independent
streaming bounds. Acquisition invokes it exactly once, with no retry or stale
fallback. Failures use a generic `OpenMeteoError`-compatible typed error, omitting
transport details and exception context. Existing methods retain their own
exception behavior.

Require a provider object with numeric (not boolean) `utc_offset_seconds=0`,
`hourly` and `hourly_units` objects, and a nonempty hourly time array no longer
than the requested hours. Every requested variable must have an array of exactly
that length and the exact corresponding unit `kn`, `°`, `°C` or `m`. Reject
missing arrays, alignment failures and unit drift, rather than converting or
relabeling data. Preserve the full original provider object, time strings, nulls,
unknown fields and units. This does not interpret timestamps or certify source
weather values, interpolate, convert pressure to flight altitude, or create an
observed-weather product.

Planner retains its thirty-minute bounded cache keyed by normalized levels,
source/provider/license/attribution envelope and existing modeled-weather
limitations. Provider failures remain unavailable/503.
