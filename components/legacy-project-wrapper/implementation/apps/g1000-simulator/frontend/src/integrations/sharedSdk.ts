import { C172S_OPERATING_PROFILE } from '@aviation/shared-sdk/aviation/aircraft';
import { C172S_LOADING_PROFILE, calculateLoad } from '@aviation/shared-sdk/aviation/weight-balance';
import { projectPistonEngineInstruments } from '@aviation/shared-sdk/aviation/flight-dynamics';
import {
  densityAltitude, distanceNM, flightTime, fuelConsumption, fuelReserve,
  fromLocalTangentPlane, initialBearing, headingDifference, toLocalTangentPlane,
} from '@aviation/shared-sdk/aviation/navigation';

export { C172S_OPERATING_PROFILE };
export { C172S_LOADING_PROFILE };

export type LegSummary = {
  distanceNm: number;
  courseTrue: number;
};

export const summarizeLeg = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
): LegSummary => ({
  distanceNm: distanceNM(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude,
  ),
  courseTrue: initialBearing(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude,
  ),
});

export type TripFuelSummary = {
  timeHours: number;
  fuelRequiredGallons: number;
};

export const calculateTripFuel = (
  distanceNm: number,
  groundSpeedKt: number,
  fuelBurnGph: number,
  reserveMinutes: number,
): TripFuelSummary => {
  if (groundSpeedKt <= 0) {
    return { timeHours: 0, fuelRequiredGallons: 0 };
  }
  const timeHours = flightTime(distanceNm, groundSpeedKt);
  return {
    timeHours,
    fuelRequiredGallons:
      fuelConsumption(fuelBurnGph, timeHours) +
      fuelReserve(fuelBurnGph, reserveMinutes),
  };
};

export const calculateDensityAltitude = (
  pressureAltitudeFt: number,
  outsideAirTemperatureC: number,
): number => densityAltitude(pressureAltitudeFt, outsideAirTemperatureC);

export const calculateHeadingDelta = (
  fromHeading: number,
  toHeading: number,
): number => headingDifference(fromHeading, toHeading);

const METERS_PER_NAUTICAL_MILE = 1852;

export const offsetCoordinateNm = (
  latitude: number,
  longitude: number,
  eastNm: number,
  northNm: number,
) => {
  const [lat, lon] = fromLocalTangentPlane(
    eastNm * METERS_PER_NAUTICAL_MILE,
    northNm * METERS_PER_NAUTICAL_MILE,
    latitude,
    longitude,
  );
  return { lat, lon };
};

export const coordinateOffsetNm = (
  latitude: number,
  longitude: number,
  originLatitude: number,
  originLongitude: number,
) => {
  const projected = toLocalTangentPlane(
    latitude,
    longitude,
    originLatitude,
    originLongitude,
  );
  return {
    eastNm: projected.eastMeters / METERS_PER_NAUTICAL_MILE,
    northNm: projected.northMeters / METERS_PER_NAUTICAL_MILE,
  };
};

export const calculateDistanceNm = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
): number => distanceNM(
  start.latitude,
  start.longitude,
  end.latitude,
  end.longitude,
);

export const projectEngineInstruments = (airspeedKt: number) =>
  projectPistonEngineInstruments(airspeedKt, 6);

export const calculateC172Loading = (
  stationWeights: number[],
  fuelGallons: number,
) =>
  calculateLoad(C172S_LOADING_PROFILE, {
    stationWeights,
    fuelGallons,
    fuelBurnGallons: 0,
  }).takeoff;
