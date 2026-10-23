# G1000 Simulator — UI Reference Comparison

**Document type:** P0 Visual Review
**Date:** 2026-03-10
**Purpose:** Compare the current simulator UI against real Garmin G1000 NXi reference screenshots and documentation. Identifies implementation status of every significant UI element and lists actionable recommendations for each gap.

---

## PFD (Primary Flight Display) Elements

| Element | Status | Notes |
|---|---|---|
| Attitude sphere (ADI) | Partial | Pitch ladder and bank angle arc rendered; sky/ground gradient present. Missing: slip/skid indicator (inclinometer ball), flight path marker (FPM), unusual-attitude recovery chevrons. |
| Airspeed tape | Partial | Numeric tape scrolls correctly; speed bug (target airspeed) displayed. Missing: color-coded speed range bands (white arc / green arc / yellow arc / red line), trend vector arrow, Vne/Vno marks. |
| Altimeter tape | Partial | Altitude tape scrolls; target altitude bug present; baro setting shown. Missing: decision height (DH/MDA) bug, BARO flashing alert when set below standard, altitude trend vector. |
| Vertical speed indicator (VSI) | Partial | VSI value shown in text footer. Missing: analog VSI arc/needle graphic alongside tape; the real G1000 uses a combined tape+needle layout on the right side of the altimeter. |
| HSI / CDI | Partial | Heading arc and course pointer rendered; turn rate shown. Missing: lateral deviation bar (CDI needle) with full/half-scale dots, glideslope deviation indicator (vertical needle), TO/FROM flag, nav source annunciation (GPS / VOR1 / VOR2 / LOC) on the compass face. |
| Flight Mode Annunciator (FMA) | Partial | Autopilot status component exists (`AutopilotStatus`). Missing: dual-row FMA strip at the top of the ADI with color-coded armed/active mode boxes (green = active, white = armed, cyan = selected). Pitch/roll mode labels in correct positions. |
| OAT (Outside Air Temperature) | Missing | `adc.oat_c` is available in telemetry. No OAT readout displayed on the PFD. Real G1000 shows OAT bottom-left of the attitude indicator area. |
| Wind data (speed / direction / headwind-crosswind) | Missing | Wind vector data is not displayed on the PFD. Real G1000 shows wind direction arrow + magnitude and H/C component readouts in the lower-left of the PFD. |
| Alerts bar / CAS | Partial | `AlertOverlay` component exists. Missing: color-coded CAS (Crew Alerting System) strip with WARNING (red), CAUTION (yellow), ADVISORY (white) prioritized message list. Scrolling when messages exceed single line. |
| Baro setting (inHg / hPa) | Partial | Hardcoded to `'29.92 inHg'` string in `PfdDisplay.tsx` line 29. Not read from configStore. Should flash green when changed and revert after a few seconds. |
| Marker beacon annunciators | Missing | Outer (O), Middle (M), Inner (I) beacon flags. `audio_panel.marker_outer_active` etc. are in telemetry but not shown on PFD. |
| Clock / Zulu time | Missing | Real G1000 has a clock in the top-right of the PFD. |

---

## MFD (Multi-Function Display) Elements

| Element | Status | Notes |
|---|---|---|
| Moving map | Partial | `MapDisplay` component exists. Status of map tiles, ownship symbol, track-up/north-up orientation, and range ring depends on MapDisplay internals. Needs verification of: airport symbology, airspace overlays, VOR/NDB/fixes, and waypoint labels. |
| Engine instruments (EIS) | Partial | `EngineDisplay` supports `layout="summary"` on map page and `layout="full"` on engine page. Real G1000: summary strip on left shows RPM, MP, fuel flow, oil temp/pressure, EGT, CHT. Verify that all six parameters are present and color-band coded. |
| Flight plan page | Partial | `FlightPlanDisplay` exists. Verify that it shows active leg highlighted in magenta, cumulative distance, fuel burn estimates, ETE/ETA columns. |
| Nearest page | Partial | `NearestDisplay` exists. Verify tabs: Airports, VORs, NDBs, Intersections, User waypoints, Frequencies, Airspaces. |
| Procedures page | Partial | `ProceduresDisplay` exists. Verify: departure, arrival, approach procedure listings with transition selection. |
| Trip planning page | Partial | `TripPlanningDisplay` exists. Verify: fuel planning, W&B, density altitude calculator. |
| MFD header / subtitle strip | Implemented | Page title and subtitle rendered correctly with active page switching. |
| Weather overlay (Nexrad / FIS-B) | Missing | `showWeather` toggle exists in softkeyStore but no weather tile rendering observed. Label shows "WX ON/OFF" but no data is drawn on the map. |
| Traffic overlay (TIS-A / ADS-B) | Missing | `showTraffic` toggle exists but no traffic symbology rendered on map. |
| Terrain proximity (TAWS) | Partial | Terrain elevation alert level computed in `mfdTerrain` service. Color overlay on map tile not confirmed implemented. |

---

## Softkeys

| Element | Status | Notes |
|---|---|---|
| 12 softkey button strip (PFD) | Partial | `SoftkeyMenuSystem` rendered with `context="pfd"`. Verify all 12 button positions are always rendered (empty buttons must show blank label, not be absent). |
| 12 softkey button strip (MFD) | Partial | `MenuSystem` component used on MFD. Verify consistent 12-button layout. |
| Context-sensitive menus | Partial | `useSoftkeyToggle` and `useMfdStore` drive page-specific menus. Verify that PFD softkey set changes when an overlay (e.g., Inset Map) is active. |
| Softkey label text styling | Partial | Real G1000 uses uppercase white text on a black bar, with active toggles shown in cyan/green. Verify CSS matches this scheme. |
| Back / root navigation | Unknown | Verify that a "BACK" softkey appears when in a sub-menu and returns to the root menu level. |

---

## Known Visual Discrepancies vs Real G1000

1. **Color palette.** The real G1000 uses a very specific palette: sky blue (#4DA6FF or similar) / brown earth, magenta for targets, cyan for active leg/autopilot modes, green arc for normal operating range. The simulator theme may not match exactly — requires side-by-side screenshot comparison.

2. **Font.** Garmin uses a custom narrow sans-serif font optimized for avionics readability. The simulator likely uses a system font; a closer match (e.g., "Roboto Condensed" or a monospaced avionics-style font) would improve fidelity.

3. **Tape scroll behavior.** The real G1000 altimeter and airspeed tapes use a fixed pointer with a moving tape behind it. Verify the implementation scrolls the tape element rather than moving the pointer.

4. **Baro setting is hardcoded.** `PfdDisplay.tsx:29` sets `baroSetting = '29.92 inHg'` unconditionally. This should read from `configStore.currentConfig.baroSetting`.

5. **Heading indicator vs HSI.** The real G1000 PFD lower section is a full HSI (Horizontal Situation Indicator) with a compass rose, not just a heading readout. The current `HSI` component should be verified for a full 360° compass arc with labeled cardinal points.

6. **Autopilot FMA placement.** Real G1000 places the FMA directly above the attitude sphere, not in a separate panel. Review `AutopilotStatus` component layout.

7. **Turn coordinator / slip indicator.** The inclinometer (ball) is absent. This is a primary instrument — it must be added to the attitude indicator region.

8. **Altitude pre-select flashing.** When the aircraft passes through the selected altitude, the altitude bug and readout should flash amber then return to normal. Not observed.

---

## Recommendations by Priority

### High Priority (P0 — affects primary flight safety awareness)

- **Add slip/skid indicator (inclinometer ball)** to `AttitudeIndicator` component — uses roll/sideslip data already in telemetry.
- **Add CDI lateral deviation bar** to `HSI` component — required for IFR navigation display.
- **Add glideslope deviation indicator** to the right of the altimeter tape.
- **Fix baro setting** — read from `configStore.baroSetting` instead of hardcoding `'29.92 inHg'`.
- **Add OAT readout** — `adc.oat_c` is available in telemetry; display bottom-left of attitude area.
- **Add marker beacon annunciators** — `audio_panel.marker_*_active` fields are in telemetry.

### Medium Priority (P1 — affects situational awareness)

- **Add airspeed range bands** (color arcs) to the airspeed tape — Vne, Vno, flap operating range.
- **Add wind vector display** to PFD lower-left area.
- **Add altitude trend vector** to altimeter tape.
- **Add airspeed trend vector** to airspeed tape.
- **Implement weather overlay rendering** on MFD map — current toggle is non-functional.
- **Implement traffic overlay** on MFD map.
- **Standardize softkey button count** — always render exactly 12 positions.

### Low Priority (P2 — cosmetic / polish)

- **Font replacement** — replace system font with a narrow avionics-appropriate font.
- **Color palette audit** — match Garmin reference colors for sky, earth, targets, CDI, FMA modes.
- **Clock/Zulu time** display on PFD.
- **CAS scrolling** — implement scroll when CAS messages exceed the alert bar height.
- **Altitude pre-select flash** animation when crossing selected altitude.

---

## Reference Sources

- Garmin G1000 NXi Pilot's Guide for Cessna Nav III (190-02327-03 Rev. A)
- Garmin G1000 Cockpit Reference Guide for the Cessna Nav III (190-00384-07)
- FAA AC 120-76D — Guidelines for the Certification, Airworthiness, and Operational Use of EFB
- Real G1000 screenshot reference sets available at: https://www.garmin.com/en-US/p/6420 (product page gallery)
