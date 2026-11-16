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
