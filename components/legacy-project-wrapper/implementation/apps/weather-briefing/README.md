# Aviation Weather Briefing

Weather Briefing serves METAR observations and TAF forecasts through its legacy
HTTP endpoints and a station/map interface. Route exploration remains available
in the shared aviation-data review panel. Reports are current provider products,
not a complete flight briefing or authorization to fly.

## HTTP endpoints

| Endpoint | Response |
| --- | --- |
| `GET /health` | Process/service health; not a provider availability guarantee |
| `GET /station?code=KSFO` | `{ "station": WeatherStation }` |
| `GET /stations?region=us` | `{ "region": "us", "stations": WeatherStation[] }` |
| `GET /briefing?station=KSFO` | Plain text with separate METAR and TAF sections |

Regions are `us`, `us-west`, `us-east`, `europe`, and `aus-nz`. An unknown region
uses the default US region. Airport codes are normalized to uppercase and must
contain 3–4 alphanumeric characters. Invalid station input returns HTTP 400;
unsupported endpoint methods return 405. Provider failure is represented per
product in an otherwise usable HTTP 200 station/briefing response.

Existing `code`, `category`, `metar` (raw string/null), `recommendation`, and
`warnings` fields remain compatible. The enriched station includes:

- `taf` and `metar_reports`: `{status, reports, source}` using the unified API
  envelope. Status is `available`, `no_reports`, or `unavailable`. Reports retain
  original NOAA fields, including multiline `rawTAF`/`rawOb`, issue/report times,
  and numeric Unix-second TAF `validTimeFrom`/`validTimeTo` values. Source includes
  `provider`, `url`, and `retrieved_at_utc` (null when retrieval was unavailable).
- `partial`: true if either product failed; an empty successful report list is
  distinct from provider failure. A missing METAR does not suppress a TAF.
- `name`, `latitude`, `longitude`: shared airport metadata. Unknown coordinates
  remain null and do not create a map marker.
- `wind_direction`, `wind_speed_kt`, optional `wind_gust_kt`, `visibility_sm`,
  `temperature_f`, `ceiling_ft`: shared METAR parser metrics, omitted if unknown.
- `updatedAt`: UTC refresh time. Report issue/validity and provider retrieval
  timestamps remain separately available and are displayed explicitly.

Category, recommendations and warnings use METAR observations only. A TAF never
substitutes for a missing observation. A failed refresh never presents the old
METAR as current. Text briefings label products, full raw text, source, issue,
retrieval and TAF validity. NOTAM retrieval still depends on the shared SDK's
configuration and must not replace official FAA briefing sources.

The legacy `days=1,3,5,7` query remains accepted for compatibility. It does not
request arbitrary multi-day TAF forecasts: the response explicitly states that
requested days cannot extend the published TAF validity. The UI therefore shows
published validity instead of a multi-day forecast selector.

## Middleware

The same endpoints are exposed by Meta App at `/api/v1/weather/station`,
`/api/v1/weather/stations`, and `/api/v1/weather/briefing`, with the same query
parameters. MCP uses `v1.weather.request` with the service-relative `path`.
Middleware preserves the JSON fields and text; it does not invent forecasts or
convert TAFs into observed flight categories. UI report strings enter text nodes,
and selection changes abort/discard stale responses.

## Configuration and local use

`AVIATION_WEATHER_API_BASE_URL` selects the trusted aviation-weather API root.
It defaults to `https://meta-app.jordanhubbard.net/api/v1/planning/api/aviation-weather`.
Only HTTP(S) bases without credentials, queries or fragments are accepted. The
server fetches METAR and TAF products independently and never forwards browser
cookies or authorization to that API. NOAA access remains owned by the planning
API; this app does not add another NOAA provider adapter.

Each product has a five-second fetch deadline. Region loads run six station jobs
at a time, share in-flight station requests, and cache at most 256 stations for one
minute (partial failures for 15 seconds). The shared airport dataset ships with
the SDK. `PORT` defaults to 3003. `AVIATION_E2E_OFFLINE=true` prevents real weather
calls unless an explicit test API base is supplied and disables startup demo and
NOTAM calls.

From the retained implementation workspace:

```sh
pnpm --filter @aviation/weather-briefing... build
pnpm --filter @aviation/weather-briefing start
pnpm --filter @aviation/weather-briefing test
```

Tests exercise real HTTP handlers through Meta HTTP and MCP, plus provider
failures, missing products, metadata, cache refresh/coalescing, safe text,
stale selections and desktop/mobile rendering. Browser tests isolate third-party
map/CDN behavior; deployment lifecycle tests use the real map assets and signed
run fixtures. CI installs Chromium; local verification can set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing browser.


### NOTAM source

Briefings now use the shared cached NMS report client, not direct FAA key/secret
headers. `AVIATION_NOTAM_API_BASE_URL` overrides the cached service URL (default:
`https://meta-app.jordanhubbard.net/api/v1/planning/api/notams`). The weather service
needs no FAA credential. Original notice text, source synchronization/environment,
permanence, schedules, missing fields and stale/partial/unavailable states remain
visible in the existing `/briefing` text/UI and gateway HTTP/MCP output. No failure
falls back to sample NOTAMs. Non-production feeds are explicitly labeled; exact
location reports do not establish complete route or international coverage.
