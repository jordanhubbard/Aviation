# Flight Track Analyzer

Upload ForeFlight or Garmin KML logs to analyze takeoffs, landings, traffic
patterns, flight performance, and altitude and airspeed accuracy. The Python
API serves the browser UI from the same process. The optional LLM debrief is
available only when configured.

From the Aviation repository root, run `make run-flight-track-analyzer` and open
<http://127.0.0.1:8010>. Direct `make run` in this directory keeps the original
port 8000 default. Run `make test` here for the analyzer tests, or run the
root `make test` to include them with the other application suites.

The analyzer reads Aviation's bundled airport data from
`apps/flight-planner/backend/data/airports_cache.json`. Set
`AVIATION_AIRPORTS_DATA` to select another compatible cache. Airport elevations
are in feet MSL. The nearest valid airport within 5 km is reported on events;
an airport elevation can extend an observed GPS ground reference to a landing
without a stationary block. Altitude alone does not confirm touchdown. When
airport data is missing or inconsistent, track-derived analysis remains in use.

The [Component specification](../../../../../components/flight-analyzer/component.md)
defines intended behavior. The implementation is retained source while the
Literate AI migration qualifies it as a native Component.
