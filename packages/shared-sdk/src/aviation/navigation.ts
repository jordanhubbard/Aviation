export interface WindCorrectionResult {
  groundSpeed: number;
  trueHeading: number;
  windCorrectionAngle: number;
}

export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3440.065; // nautical miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function courseTrue(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return (toDeg(brng) + 360) % 360;
}

export function windCorrection(
  trueAirspeedKts: number,
  trueCourseDeg: number,
  windDirectionDeg: number,
  windSpeedKts: number
): WindCorrectionResult {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const tc = toRad(trueCourseDeg);
  const wd = toRad(windDirectionDeg);
  const ws = windSpeedKts;
  const tas = trueAirspeedKts;

  const headwind = ws * Math.cos(wd - tc);
  const crosswind = ws * Math.sin(wd - tc);
  const groundSpeed = Math.sqrt((tas + headwind) ** 2 + crosswind ** 2);
  const wca = toDeg(Math.atan2(crosswind, tas));
  const trueHeading = (trueCourseDeg + wca + 360) % 360;

  return { groundSpeed, trueHeading, windCorrectionAngle: wca };
}

export function densityAltitude(pressureAltitudeFt: number, temperatureC: number): number {
  const standardTemp = 15 - 0.00198 * pressureAltitudeFt;
  const tempDiff = temperatureC - standardTemp;
  return pressureAltitudeFt + 120 * tempDiff;
}

export function pressureAltitude(indicatedAltitudeFt: number, altimeterInHg: number): number {
  return indicatedAltitudeFt + (29.92 - altimeterInHg) * 1000;
}
