# Aviation source inventory and integration decisions

Tracked by GitHub issue #449. Provider contracts were checked on 2026-11-14;
availability observations are point-in-time evidence, not future guarantees.
The implementation contract is [General aviation API and MCP](general-aviation-api.md).

| Source | Access and evidence | Exposed information | Boundaries |
| --- | --- | --- | --- |
| [NOAA Aviation Weather Center](https://aviationweather.gov/data/api/) | Public API and daily global station cache; live station/TAF responses checked | Route TAF/METAR briefing, nearby stations, station products, PIREPs, SIGMETs, G-AIRMETs, center weather advisories | Station catalog cached up to 24h; station batches up to 40 IDs; 100 requests/min provider limit and 400-record result caps. Preserve raw/structured periods and provider timing. |
| [openAIP Core API](https://docs.openaip.net/) | Existing registered key tested successfully against official airport API | Airports, airspaces, navaids, reporting points, hotspots and obstacles, with explicit country/search/page/limit | Current official schema declares CC BY-NC 4.0, not the historical ODbL label in older source registries. Current API responses retain attribution/noncommercial terms and fail closed on a changed license. Community reference data is not certified navigation. |
| [NWS API](https://www.weather.gov/documentation/services-web-api) | Public, identifying User-Agent; point alerts checked live | Active point/state alerts and hourly/period point surface forecasts | US/covered territories; surface forecasts are not TAFs. Preserve units, null geometry, pagination and original periods. Construct trusted forecast URLs from grid IDs rather than following arbitrary provider links. |
| [FAA NAS Status](https://nasstatus.faa.gov/) | Official public airport-events JSON feed checked live | Airport ground stops/delays, closures and related NAS events | Public website feed has no versioned stability promise. Preserve event timestamps and nested records; no inference that an absent event establishes normal operations. Not complete NOTAM coverage. |
| [FAA TFR](https://tfr.faa.gov/) | Existing public list adapter | TFR summaries, optionally by state | Existing API remains available. List does not establish route intersection, activity-only filtering, or all NOTAM coverage. |
| [FAA AIS](https://ais-faa.opendata.arcgis.com/) / US DOT NTAD | Existing public ArcGIS adapters | Class airspace and dated NASR airport fuel/service records | Preserve dates and service codes. No invented fuel prices or FBO availability. |
| [OurAirports](https://ourairports.com/data/) | Existing public-domain data adapters | Airport snapshot, runways and frequencies | Reference snapshot and fetch dates remain explicit. |
| [Open-Meteo](https://open-meteo.com/en/docs) | Existing public weather/elevation adapters | Current route point conditions, daily/hourly forecasts, modeled pressure-level winds and terrain inputs | Retain actual provider identity, units and missing values; separate numerical forecasts from station observations and TAFs. |
| [OpenWeatherMap](https://openweathermap.org/current) | Existing registered key and deployed configuration | Current airport weather with optional NOAA METAR enrichment | Keep key server-side. Cloud-cover percentage cannot establish an observed ceiling. |

## Credential and source investigation

Only credential names/readiness were inventoried; no credential values belong in
source control, API responses, logs, URLs or evidence reports. The operator's
registered-source store contains openAIP and OpenWeatherMap credentials. The
planner's existing `OPENAIP_API_KEY` and `OPENWEATHERMAP_API_KEY` settings/keystore
boundary owns runtime access. Runtime never reads workstation credential files.

No FAA NOTAM/NMS credential was present in the checked registered-source store or
the deployed planner configuration. Full NMS access remains dependent on FAA
approval; the legacy SDK's single-key client and mock fallback are not admitted
as a real service integration. TFR and NAS events are separately identified feeds.
AVWX, CheckWX, AeroDataBox, FlightAware and similar registration/plan-gated services
are not silently enabled without credentials and applicable access terms. No new
account, purchase or API entitlement is assumed. Additional duplicate weather
brokers were not needed to expose the official NOAA products already available.

## HTTP and MCP usage

The source catalog is `GET /api/aviation-data/sources`. It names supported
operations, coverage, authentication configuration and limitations; `configured`
is not a live availability test. Full parameter and response schemas are in
`GET /api/openapi.json`, MCP resource `aviation://v1/planning/openapi` and tool
`v1.planning.describe`. Use the same service-relative path, method and JSON body
with `v1.planning.request`; the public gateway prefix is `/api/v1/planning`.

Example route request:

```json
{
  "airports": ["KPAO", "KSAC"],
  "corridor_nm": 25,
  "max_stations": 50,
  "include_metars": true
}
```

Send this body to `POST /api/aviation-weather/route`. Coordinates may instead be
provided as `points: [[latitude, longitude], ...]`. Optional `valid_at` must include
an offset/timezone. The response keeps resolved airport identities, station
proximity and closest leg, original TAF/METAR records, overlapping forecast
periods, provider provenance and explicit truncation/partial/no-report states.
Nearby stations are separate records, never substitutes labeled as the waypoint's
own forecast. Empty results and expired/out-of-window reports are not safety advice.

## Provider changes discovered during live qualification

NOAA's `/api/data/windtemp` responds HTTP 400 with an explicit retirement message.
[NWS Service Change Notice 26-47](https://www.weather.gov/media/notification/pdf_2026/SCN26-47_Retirement_of_NAM_SREF_HREF_HiresW_NAM_MOS_aad.pdf)
records the November 3, 2026 NAM/FD product retirement. This integration therefore
uses Open-Meteo's documented pressure-level wind/temperature/geopotential-height
variables at `/api/aviation-weather/winds-aloft?lat=...&lon=...`, with explicit model
provenance. It does not claim the retired FD service is available.

NOAA's station cache also contains `-99.99` unknown-coordinate sentinels, including
some TAF-capable stations. Those stations cannot be located along a route. The
response source reports excluded counts and unlocated TAF station IDs; route
`discovery_limited` exposes this provider coverage limitation separately from
weather-fetch `partial` failures and station-limit `truncated` results.
