import type {
  FlightPlan,
  FlightPlanSegmentType,
  WaypointType,
} from "../api/schema";

export type FlightPlanFormat = "fpl" | "gpx" | "kml";

export const FLIGHT_PLAN_FORMATS: FlightPlanFormat[] = ["fpl", "gpx", "kml"];

export interface FlightPlanFormatSpec {
  format: FlightPlanFormat;
  version: string;
  supportedFields: string[];
}

export const FLIGHT_PLAN_SPECS: Record<FlightPlanFormat, FlightPlanFormatSpec> = {
  fpl: {
    format: "fpl",
    version: "1.0",
    supportedFields: [
      "name",
      "origin",
      "destination",
      "waypoints.id",
      "waypoints.type",
      "waypoints.name",
      "waypoints.latitude_deg",
      "waypoints.longitude_deg",
      "waypoints.altitude_ft",
    ],
  },
  gpx: {
    format: "gpx",
    version: "1.1",
    supportedFields: [
      "route.name",
      "route.points.lat",
      "route.points.lon",
      "route.points.ele_m",
      "route.points.name",
    ],
  },
  kml: {
    format: "kml",
    version: "2.2",
    supportedFields: [
      "linestring.name",
      "linestring.coordinates.lon",
      "linestring.coordinates.lat",
      "linestring.coordinates.alt_m",
    ],
  },
};

export const DEFAULT_FLIGHT_PLAN_SEGMENT: FlightPlanSegmentType = "enroute";

export interface FplWaypoint {
  id: string;
  type?: WaypointType | string;
  name?: string;
  latitude_deg?: number;
  longitude_deg?: number;
  altitude_ft?: number;
}

export interface FplFlightPlan {
  name?: string;
  origin?: string;
  destination?: string;
  waypoints: FplWaypoint[];
}

export interface GpxRoutePoint {
  lat: number;
  lon: number;
  ele_m?: number;
  name?: string;
  desc?: string;
}

export interface GpxRoute {
  name?: string;
  points: GpxRoutePoint[];
}

export interface KmlCoordinate {
  lon: number;
  lat: number;
  alt_m?: number;
}

export interface KmlLineString {
  name?: string;
  coordinates: KmlCoordinate[];
}

export type FlightPlanModel = FlightPlan;
