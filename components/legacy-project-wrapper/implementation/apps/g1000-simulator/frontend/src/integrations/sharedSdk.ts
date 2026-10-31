import {
  C172S_OPERATING_PROFILE,
  C172S_LOADING_PROFILE,
  calculateLoad,
  densityAltitude,
  distanceNM,
  flightTime,
  fuelConsumption,
  fuelReserve,
  initialBearing,
} from '@aviation/shared-sdk';

export { C172S_OPERATING_PROFILE };
export { C172S_LOADING_PROFILE };

export type LegSummary = {
  distanceNm: number;
  courseTrue: number;
};

export const summarizeLeg = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): LegSummary => ({
  distanceNm: distanceNM(start.latitude, start.longitude, end.latitude, end.longitude),
  courseTrue: initialBearing(start.latitude, start.longitude, end.latitude, end.longitude),
});

export type TripFuelSummary = {
  timeHours: number;
  fuelRequiredGallons: number;
};

export const calculateTripFuel = (
  distanceNm: number,
  groundSpeedKt: number,
  fuelBurnGph: number,
  reserveMinutes: number
): TripFuelSummary => {
  if (groundSpeedKt <= 0) {
    return { timeHours: 0, fuelRequiredGallons: 0 };
  }
  const timeHours = flightTime(distanceNm, groundSpeedKt);
  return {
    timeHours,
    fuelRequiredGallons:
      fuelConsumption(fuelBurnGph, timeHours) + fuelReserve(fuelBurnGph, reserveMinutes),
  };
};

export const calculateDensityAltitude = (
  pressureAltitudeFt: number,
  outsideAirTemperatureC: number
): number => densityAltitude(pressureAltitudeFt, outsideAirTemperatureC);

export const calculateC172Loading = (stationWeights: number[], fuelGallons: number) =>
  calculateLoad(C172S_LOADING_PROFILE, {
    stationWeights,
    fuelGallons,
    fuelBurnGallons: 0,
  }).takeoff;
