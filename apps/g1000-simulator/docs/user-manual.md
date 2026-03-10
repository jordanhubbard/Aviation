# G1000 Simulator — User Manual

## Overview

The G1000 Simulator is a web-based recreation of the Garmin G1000 integrated avionics suite. It targets pilots, students, and flight school instructors who want to practice glass cockpit procedures without booking an aircraft. The simulator runs in any modern browser and provides:

- A full-resolution **Primary Flight Display (PFD)** with attitude indicator, airspeed tape, altimeter tape, and horizontal situation indicator (HSI)
- A full-resolution **Multi-Function Display (MFD)** with a moving map, engine page, weather overlay, and traffic display
- Real-time flight physics for three aircraft types: Cessna 172, Cessna 182, and Cirrus SR22
- A coupled autopilot with lateral and vertical mode logic matching the GFC 700 flight control system
- Flight plan management with GPS, VOR/ILS, and procedure support
- A priority-based alert and annunciation system

The simulator is a training aid. It reproduces published G1000 operational behavior but is not a certified aviation training device.

---

## Primary Flight Display (PFD)

### Layout

The PFD occupies the left display. From left to right, its major elements are:

| Region | Content |
|--------|---------|
| Left tape | Airspeed indicator |
| Center | Attitude indicator (pitch/roll sphere) |
| Right tape | Altimeter and vertical speed indicator |
| Bottom strip | Horizontal situation indicator (HSI) and navigation data |
| Top strip | Autopilot mode annunciations |

### Reading the Attitude Indicator

The attitude sphere shows blue sky above the horizon line and brown earth below. The pitch ladder provides markings every 5° up to ±30° and every 10° beyond that. The roll scale at the top of the sphere shows bank angle reference lines at 10°, 20°, 30°, 45°, and 60°.

- A white triangle pointer at the top of the roll scale indicates current bank angle.
- The slip/skid indicator (ball) sits below the roll pointer. Ball in the center means coordinated flight.
- The magenta flight director command bars appear when a flight director mode is active.

### Reading the Airspeed Tape

The airspeed tape scrolls vertically. The white box at the tape center shows indicated airspeed (IAS) in knots. A separate digital readout shows true airspeed (TAS).

Color-coded arcs on the tape correspond to V-speeds:
- **White arc**: Flap operating range (Vfe lower limit to Vfe upper limit)
- **Green arc**: Normal operating range (Vs1 to Vno)
- **Yellow arc**: Caution range (Vno to Vne)
- **Red line**: Never-exceed speed (Vne)

A cyan bug marks the selected airspeed target when the autopilot airspeed reference is set.

### Reading the Altimeter

The altimeter tape scrolls vertically. The white box shows pressure altitude in feet. The barometric setting appears below the tape in inches Hg (or hPa when set to metric). A cyan bug marks the selected altitude target.

When the aircraft is within 200 ft of the selected altitude, an amber ALTS annunciation appears in the autopilot strip and the altitude readout flashes briefly.

The vertical speed indicator (VSI) sits to the right of the altimeter tape. It shows climb or descent rate in feet per minute on a scale from −2000 to +2000 fpm.

### Reading the HSI

The horizontal situation indicator occupies the bottom center of the PFD. It shows:

- A compass rose rotating to reflect current magnetic heading
- A selected heading bug (cyan) set with the HDG knob
- A course deviation indicator (CDI) needle showing lateral deviation from the active course
- Bearing pointer 1 (solid needle) pointing to NAV1 or GPS source
- Bearing pointer 2 (hollow needle) pointing to NAV2 or ADF source
- Distance, groundspeed, and time-to-waypoint readouts below the compass

The CDI source (GPS, NAV1, NAV2) is selected via the CDI softkey or the PFD softkey menu.

### Navigation Data Fields

Below the HSI, the PFD displays:

- **GS** — GPS groundspeed in knots
- **TRK** — GPS track in degrees magnetic
- **DTK** — Desired track to next waypoint
- **DIS** — Distance to next waypoint in nautical miles
- **ETE** — Estimated time en route to next waypoint
- **XTK** — Cross-track error in nautical miles

---

## Multi-Function Display (MFD)

### Pages

Press the softkeys along the bottom of the MFD bezel to switch between pages:

| Page | Description |
|------|-------------|
| MAP | Moving map with flight plan overlay |
| TERRAIN | Color-coded terrain elevation |
| WEATHER | NEXRAD radar and METARs |
| TRAFFIC | TIS/ADS-B traffic display |
| ENGINE | Detailed engine monitoring |
| UTILITIES | Trip planning, weight and balance, calculators |

### Map Display

The MAP page shows the aircraft position (white airplane icon) on a moving map. The active flight plan leg is shown as a magenta line; inactive legs are white.

**Map controls:**

| Action | Control |
|--------|---------|
| Increase range | Range knob clockwise (or `+` key) |
| Decrease range | Range knob counterclockwise (or `-` key) |
| Toggle orientation | MAP softkey → ORIENTATION |
| Toggle airports | MAP softkey → AVIATION → AIRPORTS |
| Toggle navaids | MAP softkey → AVIATION → NAVAIDS |
| Toggle airspace | MAP softkey → AVIATION → AIRSPACE |

Map range steps are: 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, and 1000 nm.

Map orientation options:
- **North Up** — Map north is always at the top.
- **Track Up** — Current GPS track points to the top.
- **Heading Up** — Current magnetic heading points to the top.

### Engine Page

The ENGINE page shows:

- **RPM** — Engine tachometer
- **% Power** — Percent rated horsepower
- **MAP** — Manifold pressure (in Hg)
- **FF** — Fuel flow (gal/hr)
- **EGT/CHT** — Multi-cylinder exhaust gas and cylinder head temperatures (individual bars)
- **OAT** — Outside air temperature (°C)
- **Oil Temp/Pressure** — Oil temperature (°C) and pressure (PSI)
- **Fuel Qty** — Left and right tank quantities in gallons; totalizer in gallons remaining
- **Electrical** — Bus voltage and ammeter

Color ranges follow Cessna limitations:
- Green — Normal operating range
- Yellow — Caution
- Red — Limit exceeded (triggers a caution annunciation)

### Flight Plan Page

The MFD flight plan page lists all legs of the active flight plan. Each row shows:

- Waypoint identifier and type
- Desired track (DTK) on the leg
- Distance (DIS)
- Estimated time en route (ETE)
- Cumulative fuel burn estimate

Use the FMS outer knob to scroll through legs and the inner knob to select a leg for editing.

---

## Flight Plan Management

### Creating a Flight Plan

1. Press the **FPL** key to open the Flight Plan page on the MFD.
2. Press **NEW** (softkey) to start an empty flight plan.
3. Rotate the inner FMS knob to select the first field (ORIGIN airport).
4. Type the ICAO identifier with the FMS inner knob and press **ENT**.
5. Move the cursor to the DESTINATION field, enter the ICAO identifier, and press **ENT**.
6. Move the cursor to the first en-route waypoint row. Type a waypoint identifier (airport, VOR, intersection, or user waypoint) and press **ENT**.
7. Repeat step 6 to add additional waypoints.
8. To insert a waypoint between existing legs: move the cursor to the desired row and press **INS WPT** (softkey).

### Editing a Flight Plan

- **Delete a waypoint**: Highlight the waypoint row, press **CLR**, and confirm with **ENT**.
- **Change a waypoint**: Highlight the field, type the new identifier, and press **ENT**.
- **Reorder waypoints**: Waypoints must be deleted and re-entered in the desired order.
- **Add altitude constraint**: Highlight the altitude field on a leg row, type the target altitude, and press **ENT**.

### Activating a Flight Plan

Press the **ACT** softkey on the Flight Plan page. The first leg becomes active (magenta on the map and CDI). The autopilot NAV mode will track the active leg if engaged.

**Direct-To navigation**: Press the **D→** key, enter a waypoint identifier, and press **ENT**. The simulator immediately navigates direct to that waypoint without altering the stored flight plan.

### Suspending and Resuming

When the aircraft passes a waypoint and automatic sequencing should be paused (for example, to fly a hold), press **SUSP** (softkey). The word SUSP appears in the HSI source field. Press **SUSP** again to resume automatic sequencing.

### Procedures

To add a departure or arrival procedure:

1. Open the Flight Plan page.
2. Press **PROC** (softkey).
3. Select **Departure**, **Arrival**, or **Approach** from the menu.
4. Choose the runway and procedure name from the list.
5. Press **LOAD** to insert procedure legs into the flight plan.

---

## Autopilot

### Engaging the Autopilot

Press the **AP** button on the autopilot panel (or press `A` on the keyboard). The autopilot engages in ROL / PIT mode, holding the current bank angle and pitch attitude. The annunciation strip at the top of the PFD shows the active lateral mode on the left and the active vertical mode on the right.

### Lateral Modes

| Mode | Annunciation | Behavior |
|------|-------------|----------|
| ROL | ROL | Holds the bank angle present at engagement (typically wings-level) |
| HDG | HDG | Tracks the heading selected with the HDG bug |
| NAV | NAV | Tracks the active flight plan leg or VOR radial |
| APR | APR | Localizer approach with tighter lateral gain; also arms GS/GP |
| BC | BC | Backcourse localizer tracking |

To select a lateral mode, press the corresponding button on the autopilot panel (HDG, NAV, APR, or BC). The annunciation changes immediately if the master switch is on.

### Vertical Modes

| Mode | Annunciation | Behavior |
|------|-------------|----------|
| PIT | PIT | Holds pitch attitude at engagement |
| VS | VS +/-XXX | Holds the vertical speed set with the VS wheel (fpm) |
| ALT | ALT | Holds the pressure altitude at engagement |
| ALTS | ALTS | Climbs or descends to the selected altitude then captures ALT |
| GS | GS | Follows ILS glideslope (requires APR lateral mode armed) |
| GP | GP | Follows LPV or LNAV/VNAV glidepath (requires APR lateral mode armed) |

To climb or descend to a new altitude:

1. Set the desired altitude with the ALT knob.
2. Press the **ALT** button to engage ALTS mode.
3. Set climb or descent VS with the VS wheel.
4. The autopilot climbs or descends at the selected VS and captures the altitude.

### Arming an Approach

1. Load an ILS or GPS approach via the PROC menu.
2. When the aircraft is within capture range of the localizer, press **APR**.
3. The PFD annunciates APR in the lateral field. GS (for ILS) or GP (for LPV) appears in white (armed) in the vertical field.
4. When the glideslope is captured, the annunciation changes from white to green.
5. The autopilot follows the glidepath to minimums.

### Disconnecting the Autopilot

Press the **AP** button again, or press the quick-disconnect button (the red button on the yoke, mapped to the `D` key in the simulator). On disconnect, the lateral mode reverts to ROL and the vertical mode reverts to PIT.

---

## Controls Reference

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Engage / disengage autopilot master |
| `D` | Autopilot quick-disconnect |
| `H` | Toggle HDG lateral mode |
| `N` | Toggle NAV lateral mode |
| `P` | Toggle APR lateral mode |
| `V` | Toggle VS vertical mode |
| `L` | Toggle ALT hold vertical mode |
| `+` | Increase map range |
| `-` | Decrease map range |
| `F` | Open / close flight plan page |
| `Ctrl+D` | Direct-To |
| `Esc` | Clear / cancel (CLR) |
| `Enter` | Confirm (ENT) |
| `Arrow Up/Down` | Adjust selected value (heading, altitude, VS) |

### Knob Operations

Virtual knobs on the bezel are operated by clicking and dragging:

- **Drag up** — Clockwise (increases value)
- **Drag down** — Counterclockwise (decreases value)
- **Click** (inner knob) — Push to toggle edit mode

| Knob | Function |
|------|---------|
| HDG | Set selected heading |
| ALT | Set selected altitude (1000 ft increments outer, 100 ft inner) |
| VS | Set selected vertical speed |
| CRS | Set course (OBS) for VOR/ILS |
| BARO | Set barometric altimeter setting |
| FMS outer | Scroll flight plan, page through menus |
| FMS inner | Character entry, select values |
| Range | Map range |

### Softkey Menus

The 12 softkeys along the bottom of each display change function with context. The current labels appear on screen directly above each key. Common PFD softkey menus:

- **PFD** — Opens PFD settings sub-menu
- **CDI** — Toggle CDI source (GPS / NAV1 / NAV2)
- **OBS** — Toggle OBS mode for VOR navigation
- **ALERTS** — Open the alert log
- **BACK** — Return to the previous menu level

---

## Alert System

### Priority Levels

Alerts are categorized into three levels:

| Level | Color | Behavior |
|-------|-------|---------|
| Warning | Red | Master WARNING light illuminates; aural tone plays; immediate action required |
| Caution | Amber | Master CAUTION light illuminates; aural chime plays; acknowledge and monitor |
| Advisory | White / Cyan | Informational; no aural tone by default |

The master WARNING and CAUTION lights are located in the upper corners of the PFD. Click either light to acknowledge the alert and extinguish the light. The text message remains in the alert log until the condition clears.

### Common Warnings (Red)

| Alert | Cause |
|-------|-------|
| STALL | Angle of attack approaching critical AoA |
| TERRAIN | Aircraft on terrain impact trajectory (TAWS) |
| ENGINE FIRE | Simulated engine fire condition |
| TRAFFIC TA | Traffic advisory — conflicting aircraft within range |

### Common Cautions (Amber)

| Alert | Cause |
|-------|-------|
| FUEL LOW | Total fuel below minimum reserve |
| OIL PRESSURE LOW | Oil pressure below operating minimum |
| CHT HIGH | Cylinder head temperature exceeding limit |
| GPS RAIM FAIL | GPS integrity check failed |
| ELEC BUS VOLT LOW | Bus voltage below normal range |

### Common Advisories (White)

| Alert | Cause |
|-------|-------|
| APPROACHING ALT | Within 200 ft of selected altitude |
| NEXT WPT | Within 30 seconds of next waypoint |
| GP ARMED | Glidepath capture armed |
| FPL MODIFIED | Flight plan has been edited |

### Acknowledging Alerts

Click the master WARNING or CAUTION light to acknowledge. Alternatively, open the alert log from the ALERTS softkey to review all active and recent messages.

---

## Demo Scenarios

The simulator ships with pre-recorded demo scenarios accessible from the main menu under **Demo Flights**:

| Scenario | Description |
|----------|------------|
| VFR Pattern | Traffic pattern work at a towered airport |
| Cross-Country VFR | 90-minute cross-country with en-route GPS navigation |
| IFR Departure | Instrument departure via published SID |
| ILS Approach | Full ILS approach to minimums with autopilot coupled |
| LPV Approach | GPS LPV approach with glidepath |
| Engine Failure | Simulated engine-out emergency and forced landing |
| Low Fuel | Fuel management scenario with divert decision |

To load a demo: select **Demo Flights** from the main menu, choose a scenario, and press **Load**. The simulator initializes the flight state and positions the aircraft at the scenario start point. Press **Play** to begin.
