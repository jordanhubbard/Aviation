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
