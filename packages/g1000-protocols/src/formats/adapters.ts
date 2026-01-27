import type {
  FlightPlan,
  FlightPlanLeg,
  FlightPlanSegment,
} from "../api/schema";
import {
  DEFAULT_FLIGHT_PLAN_SEGMENT,
  type FlightPlanFormat,
  type FplFlightPlan,
  type FplWaypoint,
  type GpxRoute,
  type GpxRoutePoint,
  type KmlLineString,
} from "./flight-plan";

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const toDegrees = (rad: number): number => (rad * 180) / Math.PI;
const metersToFeet = (meters?: number): number | undefined =>
  meters === undefined ? undefined : meters * 3.28084;
const feetToMeters = (feet?: number): number | undefined =>
  feet === undefined ? undefined : feet / 3.28084;

const buildLegs = (waypoints: FplWaypoint[]): FlightPlanLeg[] =>
  waypoints.map((waypoint, index) => ({
    sequence: index + 1,
    waypoint: {
      id: waypoint.id,
      type: waypoint.type ?? "user",
      name: waypoint.name,
      latitude_deg: waypoint.latitude_deg,
      longitude_deg: waypoint.longitude_deg,
      altitude_ft: waypoint.altitude_ft,
    },
  }));

const buildSegments = (legs: FlightPlanLeg[]): FlightPlanSegment[] => [
  {
    type: DEFAULT_FLIGHT_PLAN_SEGMENT,
    legs,
  },
];

const flattenLegs = (plan: FlightPlan): FlightPlanLeg[] =>
  plan.segments.flatMap((segment) => segment.legs);

export const importFromFpl = (fpl: FplFlightPlan): FlightPlan => {
  const legs = buildLegs(fpl.waypoints ?? []);
  return {
    id: fpl.name ?? "fpl-import",
    name: fpl.name,
    origin: fpl.origin,
    destination: fpl.destination,
    segments: buildSegments(legs),
  };
};

export const exportToFpl = (plan: FlightPlan): FplFlightPlan => ({
  name: plan.name ?? plan.id,
  origin: plan.origin,
  destination: plan.destination,
  waypoints: flattenLegs(plan).map((leg) => ({
    id: leg.waypoint.id,
    type: leg.waypoint.type,
    name: leg.waypoint.name,
    latitude_deg: leg.waypoint.latitude_deg,
    longitude_deg: leg.waypoint.longitude_deg,
    altitude_ft: leg.waypoint.altitude_ft,
  })),
});

export const importFromGpx = (route: GpxRoute): FlightPlan => {
  const waypoints: FplWaypoint[] = (route.points ?? []).map((point, index) => ({
    id: point.name ?? `WP${index + 1}`,
    type: "user",
    name: point.name,
    latitude_deg: point.lat,
    longitude_deg: point.lon,
    altitude_ft: metersToFeet(point.ele_m),
  }));
  const legs = buildLegs(waypoints);
  return {
    id: route.name ?? "gpx-import",
    name: route.name,
    segments: buildSegments(legs),
  };
};

export const exportToGpx = (plan: FlightPlan): GpxRoute => ({
  name: plan.name ?? plan.id,
  points: flattenLegs(plan)
    .filter((leg) => leg.waypoint.latitude_deg !== undefined
      && leg.waypoint.longitude_deg !== undefined)
    .map((leg) => ({
      lat: leg.waypoint.latitude_deg ?? 0,
      lon: leg.waypoint.longitude_deg ?? 0,
      ele_m: feetToMeters(leg.waypoint.altitude_ft),
      name: leg.waypoint.name ?? leg.waypoint.id,
    })),
});

export const importFromKml = (lineString: KmlLineString): FlightPlan => {
  const waypoints: FplWaypoint[] = (lineString.coordinates ?? []).map(
    (coord, index) => ({
      id: `WP${index + 1}`,
      type: "user",
      name: `WP${index + 1}`,
      latitude_deg: coord.lat,
      longitude_deg: coord.lon,
      altitude_ft: metersToFeet(coord.alt_m),
    }),
  );
  const legs = buildLegs(waypoints);
  return {
    id: lineString.name ?? "kml-import",
    name: lineString.name,
    segments: buildSegments(legs),
  };
};

export const exportToKml = (plan: FlightPlan): KmlLineString => ({
  name: plan.name ?? plan.id,
  coordinates: flattenLegs(plan)
    .filter((leg) => leg.waypoint.latitude_deg !== undefined
      && leg.waypoint.longitude_deg !== undefined)
    .map((leg) => ({
      lon: leg.waypoint.longitude_deg ?? 0,
      lat: leg.waypoint.latitude_deg ?? 0,
      alt_m: feetToMeters(leg.waypoint.altitude_ft),
    })),
});

export const importFlightPlan = (
  format: FlightPlanFormat,
  payload: FplFlightPlan | GpxRoute | KmlLineString,
): FlightPlan => {
  switch (format) {
    case "fpl":
      return importFromFpl(payload as FplFlightPlan);
    case "gpx":
      return importFromGpx(payload as GpxRoute);
    case "kml":
      return importFromKml(payload as KmlLineString);
    default:
      throw new Error(`Unsupported flight plan format: ${format}`);
  }
};

export const exportFlightPlan = (
  format: FlightPlanFormat,
  plan: FlightPlan,
): FplFlightPlan | GpxRoute | KmlLineString => {
  switch (format) {
    case "fpl":
      return exportToFpl(plan);
    case "gpx":
      return exportToGpx(plan);
    case "kml":
      return exportToKml(plan);
    default:
      throw new Error(`Unsupported flight plan format: ${format}`);
  }
};

export const computeRouteDistanceNm = (plan: FlightPlan): number => {
  const legs = flattenLegs(plan);
  let total = 0;
  for (let i = 1; i < legs.length; i += 1) {
    const prev = legs[i - 1].waypoint;
    const next = legs[i].waypoint;
    if (
      prev.latitude_deg === undefined
      || prev.longitude_deg === undefined
      || next.latitude_deg === undefined
      || next.longitude_deg === undefined
    ) {
      continue;
    }
    const dLat = toRadians(next.latitude_deg - prev.latitude_deg);
    const dLon = toRadians(next.longitude_deg - prev.longitude_deg);
    const lat1 = toRadians(prev.latitude_deg);
    const lat2 = toRadians(next.latitude_deg);
    const a =
      Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += 3440.065 * c;
  }
  return total;
};

export const computeRouteBearingDeg = (
  from: FlightPlanLeg,
  to: FlightPlanLeg,
): number | undefined => {
  if (
    from.waypoint.latitude_deg === undefined
    || from.waypoint.longitude_deg === undefined
    || to.waypoint.latitude_deg === undefined
    || to.waypoint.longitude_deg === undefined
  ) {
    return undefined;
  }
  const lat1 = toRadians(from.waypoint.latitude_deg);
  const lat2 = toRadians(to.waypoint.latitude_deg);
  const dLon = toRadians(to.waypoint.longitude_deg - from.waypoint.longitude_deg);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};
