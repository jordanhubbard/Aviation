import {
  C172S_OPERATING_PROFILE,
  SAMPLE_AIRCRAFT,
  calculateLoad,
  densityAltitude,
  distanceNM,
  flightTime,
  fuelConsumption,
  fuelReserve,
  initialBearing,
  type LoadingProfile,
} from '@aviation/shared-sdk';

export { C172S_OPERATING_PROFILE };

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

const c172 = SAMPLE_AIRCRAFT.C172N;

export const C172_FUEL_CAPACITY_GALLONS = c172.fuelCapacity;

export const C172_LOADING_PROFILE: LoadingProfile = {
  emptyWeight: c172.emptyWeight,
  emptyArm: c172.emptyArm,
  maxGross: c172.maxGrossWeight,
  fuelArm: c172.stations.fuel.arm,
  fuelDensity: c172.fuelWeightPerGallon,
  stations: [
    { name: 'Pilot', arm: c172.stations.pilot.arm },
    { name: 'Copilot', arm: c172.stations.copilot.arm },
    { name: 'Rear Pax', arm: c172.stations.rearSeats?.arm ?? 0 },
    { name: 'Baggage', arm: c172.stations.baggage1?.arm ?? 0 },
  ],
  envelope: c172.cgLimits.map(({ weight, forwardCG, aftCG }) => ({
    weight,
    forward: forwardCG,
    aft: aftCG,
  })),
};

export const calculateC172Loading = (stationWeights: number[], fuelGallons: number) =>
  calculateLoad(C172_LOADING_PROFILE, {
    stationWeights,
    fuelGallons,
    fuelBurnGallons: 0,
  }).takeoff;
