import fs from "node:fs";
import path from "node:path";

import {
  C172S_OPERATING_PROFILE,
  C172S_LOADING_PROFILE,
  calculateC172Loading,
  calculateDensityAltitude,
  calculateDistanceNm,
  calculateHeadingDelta,
  calculateTripFuel,
  coordinateOffsetNm,
  offsetCoordinateNm,
  projectEngineInstruments,
} from "../../frontend/src/integrations/sharedSdk";

describe("G1000 shared SDK boundary", () => {
  it("delegates portable alert lifecycle while retaining telemetry policy", () => {
    const manager = fs.readFileSync(
      path.join(__dirname, "../../frontend/src/services/alert-manager.ts"),
      "utf8",
    );
    expect(manager).toContain("orderAlerts");
    expect(manager).toContain("reconcileAcknowledgements");
    expect(manager).toContain("highestAlertLevel");
    expect(manager).not.toContain("LEVEL_PRIORITY");
    expect(manager).not.toContain("alerts.sort");
    expect(manager).toContain("airspeed >= 160");
    expect(manager).toContain("altitudeDelta >= 250");
    expect(manager).toContain("headingDelta >= 20");
  });

  it("uses common navigation fuel and performance semantics", () => {
    expect(calculateTripFuel(120, 120, 10, 30)).toEqual({
      timeHours: 1,
      fuelRequiredGallons: 15,
    });
    expect(calculateDensityAltitude(5000, 25)).toBeCloseTo(7388.72, 2);
    expect(calculateHeadingDelta(350, 10)).toBe(20);
  });

  it("uses the common heading delta while retaining HSI presentation scaling", () => {
    const display = fs.readFileSync(
      path.join(__dirname, "../../frontend/src/displays/PFD/HSI.tsx"),
      "utf8",
    );
    expect(display).toContain("calculateHeadingDelta");
    expect(display).toContain("/ 10");
    expect(display).toContain("cdiDeviation * 22");
    expect(display).not.toContain("computeDelta");
    expect(display).not.toContain("% 360");
  });

  it("uses common local geometry while retaining map pixel policy", () => {
    const origin = { latitude: 37.618805, longitude: -122.375416 };
    const offset = offsetCoordinateNm(
      origin.latitude,
      origin.longitude,
      5,
      -2,
    );
    const roundTrip = coordinateOffsetNm(
      offset.lat,
      offset.lon,
      origin.latitude,
      origin.longitude,
    );
    expect(roundTrip.eastNm).toBeCloseTo(5, 9);
    expect(roundTrip.northNm).toBeCloseTo(-2, 9);
    expect(calculateDistanceNm(origin, {
      latitude: offset.lat,
      longitude: offset.lon,
    })).toBeCloseTo(Math.hypot(5, 2), 2);

    for (const file of ["MapDisplay.tsx", "FlightPlanDisplay.tsx"]) {
      const display = fs.readFileSync(
        path.join(__dirname, `../../frontend/src/displays/MFD/${file}`),
        "utf8",
      );
      expect(display).toContain("offsetCoordinateNm");
      expect(display).not.toContain("offsetCoordinates");
      expect(display).not.toContain("NM_PER_DEG_LAT");
    }
    const map = fs.readFileSync(
      path.join(__dirname, "../../frontend/src/displays/MFD/MapDisplay.tsx"),
      "utf8",
    );
    expect(map).toContain("coordinateOffsetNm");
    expect(map).toContain("(offset.eastNm / rangeNm) * 50");
  });

  it("uses common synthetic engine state while retaining display policy", () => {
    expect(projectEngineInstruments(100)).toEqual({
      rpm: 2500,
      oilTempF: 210,
      oilPressurePsi: 62,
      fuelFlowGph: 10,
      busVolts: 28.4,
      alternatorLoadAmps: 28,
      manifoldPressureInHg: 20,
      batteryTempF: 90,
      egtF: [1415, 1419, 1426, 1440, 1460, 1478],
      chtF: [358, 361, 369, 379, 389, 394],
    });
    const display = fs.readFileSync(
      path.join(__dirname, "../../frontend/src/displays/MFD/EngineDisplay.tsx"),
      "utf8",
    );
    expect(display).toContain("projectEngineInstruments");
    expect(display).toContain("fuelStartRef");
    expect(display).toContain("oilAlert");
    expect(display).toContain("rpm / 2700");
    expect(display).not.toContain("1900 + airspeed * 6");
    expect(display).not.toContain("1280 + airspeed * 1.6");
    expect(display).not.toContain("const clamp");
  });

  it("uses the shared C172 profile and loading calculation", () => {
    const result = calculateC172Loading([180, 150, 120, 40, 0], 53);

    expect(C172S_LOADING_PROFILE.aircraftProfileId).toBe(
      C172S_OPERATING_PROFILE.profileId,
    );
    expect(C172S_LOADING_PROFILE.emptyWeight).toBe(1642);
    expect(C172S_LOADING_PROFILE.usableFuelCapacity).toBe(53);
    expect(C172S_LOADING_PROFILE.maxGross).toBe(2550);
    expect(result.weight).toBe(2450);
    expect(result.cg).toBeCloseTo(41.8914, 4);
  });

  it("uses the shared C172S operating limits for the airspeed tape", () => {
    expect(C172S_OPERATING_PROFILE.airspeedLimits).toEqual({
      vsoKias: 40,
      vsKias: 48,
      vfeKias: 85,
      vaKias: 105,
      vnoKias: 129,
      vneKias: 163,
    });

    const display = fs.readFileSync(
      path.join(__dirname, "../../frontend/src/displays/PFD/AirspeedTape.tsx"),
      "utf8",
    );
    expect(display).toContain("C172S_OPERATING_PROFILE.airspeedLimits");
    expect(display).not.toContain("const V_SPEEDS");
    expect(display).not.toMatch(/\b(?:40|48|85|105|129|163)\b/);
  });

  it("uses the shared C172S identity and reference profile for configuration", () => {
    expect(C172S_OPERATING_PROFILE.icaoTypeDesignator).toBe("C172");
    expect(C172S_OPERATING_PROFILE.fuelLimits).toEqual({
      totalCapacityGal: 56,
      usableCapacityGal: 53,
    });
    expect(
      C172S_OPERATING_PROFILE.referencePerformance.maximumCruiseSpeedKtas,
    ).toBe(124);

    const configStore = fs.readFileSync(
      path.join(__dirname, "../../frontend/src/stores/configStore.ts"),
      "utf8",
    );
    expect(configStore).toContain("C172S_OPERATING_PROFILE.icaoTypeDesignator");
    expect(configStore).not.toContain("aircraftType: 'C172'");
  });

  it("keeps private trip-planning formulas out of the display", () => {
    const display = fs.readFileSync(
      path.join(
        __dirname,
        "../../frontend/src/displays/MFD/TripPlanningDisplay.tsx",
      ),
      "utf8",
    );

    expect(display).not.toContain("distanceValue / speedValue");
    expect(display).not.toContain("standardTemp =");
    expect(display).not.toContain("stationTotals");
    expect(display).toContain("calculateTripFuel");
    expect(display).toContain("calculateC172Loading");
    expect(display).toContain("calculateDensityAltitude");
    expect(display).toContain("DEFAULT_STATION_WEIGHTS_LB");
    expect(display).toContain("setStations");
    expect(display).not.toContain("['180', '150', '120', '40']");
  });
});
