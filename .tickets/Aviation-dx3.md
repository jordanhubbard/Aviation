---
id: Aviation-dx3
status: closed
deps: []
links: []
created: 2026-01-13T15:21:39.93191-08:00
type: task
priority: 0
mac-task-id: task_9788e485c8ab4abb848f39b3b68825cb
---
# Extract weather services to @aviation/shared-sdk

**Epic Child: Aviation-sv9 - Shared Aviation Data Services**

Extract weather data services from flightplanner into shared SDK.

**Current Implementation:**
- Location: `apps/flightplanner/backend/app/services/`
  - `openweathermap.py` - Current conditions
  - `open_meteo.py` - Forecast and route sampling
  - `metar.py` - METAR fetching and parsing
  - `flight_recommendations.py` - Flight category and recommendations

**External Services Used:**
- OpenWeatherMap API (requires `OPENWEATHERMAP_API_KEY`)
- Open-Meteo API (free, no key required)
- AviationWeather.gov METAR API (free)

**Target Location:**
- `packages/shared-sdk/src/aviation/weather/`
  - `openweathermap.ts`
  - `open-meteo.ts`
  - `metar.ts`
  - `flight-category.ts`
  - `weather-cache.ts`

**Requirements:**
- [ ] Port OpenWeatherMap client to TypeScript
- [ ] Port Open-Meteo client to TypeScript
- [ ] Port METAR fetching and parsing
- [ ] Port flight category calculations (VFR, MVFR, IFR, LIFR)
- [ ] Implement caching strategy (TTL + LRU)
- [ ] Handle API rate limits
- [ ] Error handling and retries
- [ ] TypeScript types for all responses
- [ ] Python wrapper for Python apps
- [ ] Unit tests with mocked responses
- [ ] Integration tests with real APIs (optional)

**Acceptance Criteria:**
- [ ] All weather services ported to TypeScript
- [ ] Python wrapper available
- [ ] Caching working (5min TTL)
- [ ] Rate limiting handled gracefully
- [ ] All tests passing
- [ ] API keys managed via keystore
- [ ] Documentation with examples

**Blocks:** accident-tracker weather features, flightplanner migration
