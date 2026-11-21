# METAR consistency assessment

Behavioral authority for [#621](https://github.com/jordanhubbard/Aviation/issues/621).
The owner's Fort Stockton diversion motivates the feature; it is not a verified
historical sensor-failure finding.

Preserve each original NOAA METAR and its actual observation time. A consistency
assessment is an explainable request to investigate, never a replacement report,
a sensor diagnosis, a clearance, or proof that an unflagged report is accurate.
METAR flight categories are not regulatory VFR operating minima.

Use the existing fixed-origin NOAA station catalog and bounded report adapters.
For one target, select at most 12 METAR-capable neighbors within 100 NM (caller
bounds: 25–150 NM, 3–20 neighbors). One station contributes at most one latest
observation. Do not count the target or stations within 2 NM as independent votes.
Require actual observation times: at most 90 minutes old, no more than 5 minutes
in the future, and within 45 minutes of the target. Exclude stations whose known
elevations differ by more than 1,500 feet; unknown elevations cannot corroborate
a regional ceiling disagreement. Retain excluded candidates and reasons.

Flag a VFR target as regionally inconsistent only when at least three qualifying
neighbors report IFR/LIFR, they represent at least 75 percent of qualifying
neighbors, at least one lies within 50 NM, and evidence spans at least two bearing
quadrants. These are conservative product heuristics, not meteorological proof;
fronts, terrain, coastal effects and localized clear areas can cause disagreement.
Report the thresholds and all station distances, times, categories and exclusions.

Separately flag contradictory reported flight category versus explicit structured
ceiling/visibility evidence, and the original report's maintenance indicator `$`
or missing ceiling/visibility sensor indicators. Preserve unknown fields; never
interpret an absent ceiling/visibility as unrestricted. AO1/AO2 alone is not a
fault. Use target TAF prevailing periods, when present and valid at the target
observation time, only as labeled forecast context; TEMPO/PROB/BECMG periods and
forecasts are not additional observed-station votes. Missing TAFs do not erase a
regional finding. Radar, satellite and sensor-health telemetry are not assessed.

Return `suspicious`, `no_conflict_detected`, `insufficient_evidence` or `unavailable`,
with reason codes, original target/neighbor records, forecast context, source
metadata, observation/candidate counts, truncation, exclusions and limitations.
Stale/missing target observations cannot yield a reassuring result. A clean result
requires at least three qualifying neighbors and never certifies the target.
Provider failure retains partial evidence and a visible error; it is never an
empty successful comparison. Bound all network reads and never poll on startup.

Expose the same assessment through planner HTTP/OpenAPI/MCP and the shared SDK.
Use the shared aviation review UI in Planner/Preflight and Weather Briefing text/
station responses, and expose it in the Codex-ios specialist. Changes of station
invalidate older results; out-of-order responses cannot republish them. Preserve
legacy METAR/TAF and NOTAM responses even if consistency evidence is unavailable.

Primary references: [NOAA ASOS user guide](https://www.weather.gov/media/asos/aum-toc.pdf)
and [AWC flight categories](https://aviationweather.gov/gfa/help/?page=products).
