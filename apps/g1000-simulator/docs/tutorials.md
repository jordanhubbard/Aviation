# G1000 Simulator — Tutorials

These step-by-step tutorials introduce the major features of the G1000 Simulator. Each tutorial builds on the previous one. Complete them in order if you are new to the simulator.

---

## Tutorial 1: Basic VFR Cross-Country

**Goal:** Create a simple VFR flight plan, take off, fly en route, and land at the destination.

**Aircraft:** Cessna 172
**Route:** KPAO (Palo Alto, CA) → KSNS (Salinas, CA)
**Estimated duration:** 25 minutes simulated, 10 minutes of tutorial time

---

### Step 1 — Configure the Aircraft

1. From the main menu, select **New Flight**.
2. Under **Aircraft**, choose **Cessna 172 (Skyhawk)**.
3. Under **Departure Airport**, type `KPAO` and press **Enter**.
4. Leave fuel at full and weight at standard.
5. Select **Start on Runway** to begin positioned at the runway threshold.
6. Press **Begin Simulation**.

The PFD and MFD both illuminate. You should see the aircraft sitting on Runway 31 at Palo Alto.

---

### Step 2 — Create the Flight Plan

1. Press **FPL** to open the Flight Plan page on the MFD.
2. Press the **NEW** softkey.
3. The cursor is on the ORIGIN field. The field already shows `KPAO` from the departure selection — press **ENT** to confirm.
4. Move the cursor to DESTINATION. Type `KSNS` and press **ENT**.
5. The simulator offers to add direct routing. Press **ENT** to accept. A single direct leg from KPAO to KSNS appears.
6. Press **ACT** to activate the flight plan. The magenta leg appears on the map.

---

### Step 3 — Set the Altimeter

1. Check the current altimeter setting in the real-world weather panel (or use 29.92 for the tutorial).
2. Rotate the **BARO** knob until the altimeter reads the correct setting. The altitude tape should show approximately 7 ft (field elevation at KPAO).

---

### Step 4 — Take Off

1. Advance the throttle to full (press `F` to toggle full throttle in keyboard mode, or drag the throttle slider to 100%).
2. Rotate at 55 KIAS. The pitch indicator on the PFD will show the nose pitching up.
3. After liftoff, retract flaps when airspeed is above Vx (60 KIAS).
4. Climb at 80 KIAS to 3,500 ft.

Watch the airspeed tape and altimeter as you climb. Notice the VSI showing a positive climb rate.

---

### Step 5 — En-Route Navigation

1. Once level at 3,500 ft, observe the HSI on the PFD. The magenta needle points to KSNS.
2. The navigation data below the HSI shows **DTK**, **DIS**, and **ETE** updating in real time.
3. Turn the aircraft to match the **DTK** value. Hold that heading to track toward the destination.

The MFD MAP page shows your position moving along the magenta leg toward KSNS.

---

### Step 6 — Descend and Land

1. When the DIS readout shows 10 nm to KSNS, begin a descent.
2. Reduce power to approximately 2,000 RPM and pitch down to maintain 90 KIAS.
3. On the MAP page, verify you are aligned with the active runway at KSNS.
4. Extend flaps in stages (10°, 20°, full) on short final.
5. Aim for 65–70 KIAS over the threshold. Reduce power to idle over the numbers and flare.

**What you learned:** PFD instrument scanning, basic flight plan creation, activation, and en-route GPS tracking.

---

## Tutorial 2: IFR Flight with Autopilot

**Goal:** File an IFR flight plan, use the autopilot HDG and NAV modes, and fly a coupled ILS approach to minimums.

**Aircraft:** Cessna 172
**Route:** KPAO → KSJC (San Jose International)
**Estimated duration:** 20 minutes simulated, 15 minutes of tutorial time

---

### Step 1 — Load an ILS Approach

1. Start a new flight at KPAO, aircraft on the ground, engine running.
2. Press **FPL** and create a new flight plan: KPAO → KSJC.
3. Press **PROC** to open the procedure menu.
4. Select **Arrival** → choose **ILS 30L** approach for KSJC.
5. Press **LOAD** to add the approach legs. The flight plan now ends with the ILS 30L initial approach fix, final approach fix, and runway waypoints.
6. Press **ACT** to activate the flight plan.

---

### Step 2 — Depart and Climb in HDG Mode

1. Take off from KPAO Runway 31.
2. After liftoff and climbing through 400 ft AGL, press `A` to engage the autopilot. It enters ROL / PIT mode.
3. Set the heading bug to 310° (runway heading) using the **HDG** knob.
4. Press `H` to select **HDG** mode. The autopilot holds runway heading.
5. Press `V` to select **VS** mode. Rotate the VS knob to +700 fpm.
6. Set the selected altitude to **3,000 ft** using the **ALT** knob.
7. Press `L` to engage **ALTS** mode. The autopilot climbs at 700 fpm toward 3,000 ft and levels off.

Watch the ALTS annunciation in the PFD autopilot strip. When the aircraft approaches 3,000 ft, it transitions automatically to ALT.

---

### Step 3 — Navigate with NAV Mode

1. Once level at 3,000 ft, press `N` to engage **NAV** mode.
2. The autopilot intercepts the active flight plan leg and begins tracking toward KSJC.
3. On the MAP page, observe the aircraft icon turning onto the magenta leg.

If the intercept angle is large, the autopilot will perform a smooth arc onto the track. You can set a different heading first with HDG mode to position for a shallower intercept.

---

### Step 4 — Configure for the ILS Approach

1. Tune **NAV1** to the KSJC ILS 30L frequency (109.75 MHz). Use the NAV1 frequency knob or the radio page softkey.
2. Switch the CDI source to **NAV1** by pressing the **CDI** softkey on the PFD until NAV1 is displayed.
3. The CDI needle will show lateral deviation from the ILS localizer course.
4. Set the **CRS** knob to the ILS front course (300°).

---

### Step 5 — Arm the Approach

1. When the aircraft is within 30 nm of the airport and cleared for the approach, press `P` to select **APR** mode.
2. The PFD annunciates **APR** (lateral) and **GS** in white (armed vertical).
3. The autopilot captures the localizer. The lateral annunciation changes from APR to LOC.
4. As the glideslope needle centers from above, the vertical mode changes from white GS to active **GS** (green).
5. The aircraft now tracks the glidepath to the runway.

---

### Step 6 — Monitor to Minimums

1. Monitor the airspeed, altitude, and CDI throughout the approach.
2. At 200 ft AGL (decision altitude for CAT I), observe the runway environment on the map.
3. Press `D` to disconnect the autopilot and hand-fly the final 200 ft to touchdown.

**What you learned:** Autopilot engagement, HDG/NAV/APR/GS modes, coupled ILS approach.

---

## Tutorial 3: Using the MFD

**Goal:** Explore all MFD pages — engine monitoring, weather overlay, terrain, and nearest airports — during a flight.

**Aircraft:** Cessna 182
**Start:** Airborne at 8,500 ft, cruise configuration

---

### Step 1 — Start in Cruise

1. From the main menu, select **New Flight**.
2. Choose **Cessna 182 (Skylane)** and set the starting state to **Cruise at 8,500 ft**.
3. Begin the simulation. The aircraft is flying straight and level.

---

### Step 2 — Explore the Engine Page

1. On the MFD, press the **ENGINE** softkey (or select the ENGINE page from the softkey menu).
2. Observe the following readings at normal cruise power:
   - RPM: approximately 2,400
   - % Power: approximately 65–75%
   - FF (fuel flow): approximately 10–12 gal/hr for the O-470
   - EGT/CHT bars: 6 individual bars, one per cylinder
3. Press the **LEAN** softkey to enter lean-assist mode. The EGT bars animate to help identify peak EGT.
4. Press **BACK** to return to the main engine display.

---

### Step 3 — Switch to the Map Page

1. Press the **MAP** softkey.
2. Use the range knob (`-` key) to zoom in until terrain features are visible.
3. Press the **TERRAIN** softkey on the map menu to overlay color-coded terrain elevation:
   - Black — terrain more than 1,000 ft below aircraft
   - Yellow — terrain 500–1,000 ft below
   - Red — terrain within 100 ft or above aircraft altitude
4. Use the range knob to pan through different ranges and observe how terrain colors change relative to aircraft altitude.

---

### Step 4 — Enable Weather Overlay

1. On the MAP page, press **WEATHER** from the softkey menu.
2. Enable **NEXRAD** to overlay simulated radar returns on the map.
3. The precipitation intensity scale appears in the corner (green = light, yellow = moderate, red = heavy).
4. Press **LIGHTNING** to overlay simulated lightning strike indicators.
5. Press **WINDS** to display wind barbs at your altitude.
6. Observe the METAR flags at nearby airports. Hover over or click an airport flag to read the METAR summary.

---

### Step 5 — Find Nearest Airports

1. Press the **NRST** key (or the NEAREST softkey on the MFD).
2. The Nearest Airports page lists airports sorted by distance from the current position.
3. Each entry shows: ICAO identifier, name, distance (nm), bearing, and best runway length.
4. Use the FMS knob to scroll through the list.
5. Highlight an airport and press **INFO** to see full airport details: elevation, frequencies, runway dimensions, and available services.
6. Press **D→** to fly direct to any airport from the Nearest list.

---

### Step 6 — Use the Utilities Page

1. Press **UTILITIES** from the MFD softkey menu.
2. Select **Trip Planning**.
3. Enter a destination airport, cruise altitude, and planned speed. The calculator returns:
   - Total distance
   - Estimated flight time
   - Estimated fuel burn
   - Required fuel on board
4. Select **Density Altitude** from the utilities sub-menu. Enter pressure altitude and temperature to compute density altitude.

**What you learned:** Engine monitoring, terrain display, weather overlay, nearest airports, and trip planning utilities.

---

## Tutorial 4: Emergency Procedures

**Goal:** Practice responding to low-fuel and engine-out emergencies using the alert system and nearest airports feature.

**Aircraft:** Cessna 172
**Start:** Airborne over unfamiliar terrain, low fuel state

---

### Step 1 — Load the Emergency Scenario

1. From the main menu, select **Demo Flights** → **Low Fuel**.
2. Press **Load**. The simulation starts with the aircraft airborne, fuel tanks showing 5 gallons total (less than the 1-hour reserve).
3. The PFD immediately annunciates a **FUEL LOW** caution (amber). The master CAUTION light illuminates.

---

### Step 2 — Acknowledge the Alert

1. Click the amber **CAUTION** light in the upper-left corner of the PFD to acknowledge. The light extinguishes, but the text message remains in the alert log.
2. Press **ALERTS** (softkey) to open the alert log.
3. Read the message: `FUEL LOW — Less than minimum reserve. Land as soon as practicable.`
4. Note the current fuel quantity on the ENGINE page. At typical fuel burn, you have less than 20 minutes of endurance.

---

### Step 3 — Find the Nearest Airport

1. Press **NRST** to open the Nearest Airports list.
2. The closest airport appears at the top with distance and bearing.
3. Check the runway length against the Cessna 172's required landing distance. Any runway above 2,000 ft is acceptable.
4. Press **D→** to navigate direct to the nearest suitable airport.
5. The MFD MAP and PFD CDI update immediately to show the direct course.

---

### Step 4 — Declare a Simulated Emergency

1. Open the transponder page via the softkey menu.
2. Change the squawk code to **7700** (emergency).
3. The transponder annunciates IDENT in red.

---

### Step 5 — Manage the Descent and Landing

1. Reduce power to cruise descent (approximately 1,500 fpm) to conserve fuel while descending.
2. On the MAP page, verify the destination runway orientation. Identify the landing runway based on wind direction (shown in the WEATHER overlay or METAR).
3. Set the destination airport as the active flight plan to get CDI guidance on the PFD HSI.
4. Fly the approach and land.

---

### Step 6 — Engine-Out Extension (Optional)

1. After landing, select **Demo Flights** → **Engine Failure** from the main menu.
2. The simulation starts with the engine running at altitude. After 30 seconds, the engine fails.
3. The PFD annunciates a **ENGINE FAIL** warning (red). The master WARNING light illuminates.
4. Best glide speed for the C172 is 65 KIAS. Pitch to this speed immediately (watch the airspeed tape).
5. Use the **NRST** page to identify the nearest runway.
6. Fly to the nearest airport using the Direct-To feature and the heading on the HSI.
7. Plan for a no-flap landing above 60 KIAS if altitude allows a normal approach; otherwise fly a straight-in at best glide.

The simulator does not end the flight when the engine fails — it continues physics simulation with a windmilling prop and dead stick glide characteristics.

**What you learned:** Alert acknowledgment, fuel emergency response, nearest airports navigation, Direct-To, and engine-out glide management.
