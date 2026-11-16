/** Common finite minor-great-circle segment geometry; route selection stays with apps. */
import { assertValidCoordinate, distanceNM, EARTH_RADIUS, toRadians } from "./distance.js";
import { initialBearing } from "./bearing.js";

export interface SegmentProjectionNM {
  distanceFromSegmentNM: number;
  alongSegmentNM: number;
}

export function projectPointToSegmentNM(
  lat: number, lon: number, startLat: number, startLon: number,
  endLat: number, endLon: number,
): SegmentProjectionNM {
  assertValidCoordinate(lat, lon);
  assertValidCoordinate(startLat, startLon);
  assertValidCoordinate(endLat, endLon);
  const length = distanceNM(startLat, startLon, endLat, endLon);
  if (!Number.isFinite(length) || length / EARTH_RADIUS.NM >= Math.PI - 1e-7) {
    throw new RangeError("Antipodal route leg is ambiguous; add an intermediate waypoint");
  }
  const startDistance = distanceNM(startLat, startLon, lat, lon);
  if (!Number.isFinite(startDistance)) throw new RangeError("Segment projection has no finite solution");
  const delta = startDistance / EARTH_RADIUS.NM;
  const theta = toRadians(initialBearing(startLat, startLon, lat, lon) - initialBearing(startLat, startLon, endLat, endLon));
  let along = Math.atan2(Math.sin(delta) * Math.cos(theta), Math.cos(delta)) * EARTH_RADIUS.NM;
  let distance: number;
  if (length > 1e-9 && along >= 0 && along <= length) {
    distance = Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(delta) * Math.sin(theta))))) * EARTH_RADIUS.NM;
  } else {
    const endDistance = distanceNM(endLat, endLon, lat, lon);
    if (startDistance <= endDistance) { distance = startDistance; along = 0; }
    else { distance = endDistance; along = length; }
  }
  if (!Number.isFinite(distance) || !Number.isFinite(along)) throw new RangeError("Segment projection has no finite solution");
  return { distanceFromSegmentNM: distance, alongSegmentNM: along };
}
