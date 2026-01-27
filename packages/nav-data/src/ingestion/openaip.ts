import { NormalizedAirspace, GeoPoint, AirspaceClass } from "./types";

const OPENAIP_SOURCE = "openaip";

interface OpenAipFeatureCollection {
  features?: OpenAipFeature[];
}

interface OpenAipFeature {
  properties?: {
    id?: string;
    name?: string;
    class?: string;
    lowerLimit?: number;
    upperLimit?: number;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}

export function ingestOpenAipAirspace(data: unknown): NormalizedAirspace[] {
  if (!data || typeof data !== "object") {
    return [];
  }
  const collection = data as OpenAipFeatureCollection;
  if (!Array.isArray(collection.features)) {
    return [];
  }
  return collection.features
    .map((feature, index) => buildAirspace(feature, index))
    .filter((airspace): airspace is NormalizedAirspace => airspace !== null);
}

function buildAirspace(feature: OpenAipFeature, index: number): NormalizedAirspace | null {
  const boundary = toBoundary(feature.geometry?.type, feature.geometry?.coordinates);
  if (!boundary.length) {
    return null;
  }
  return {
    identifier: feature.properties?.id || `openaip-${index + 1}`,
    name: feature.properties?.name,
    class: mapAirspaceClass(feature.properties?.class),
    lowerLimitFt: toNumber(feature.properties?.lowerLimit) ?? undefined,
    upperLimitFt: toNumber(feature.properties?.upperLimit) ?? undefined,
    boundary,
    source: OPENAIP_SOURCE,
  };
}

function toBoundary(type?: string, coordinates?: unknown): GeoPoint[] {
  if (!type || !coordinates) {
    return [];
  }
  if (type === "Polygon" && Array.isArray(coordinates)) {
    return extractPolygon(coordinates[0]);
  }
  if (type === "MultiPolygon" && Array.isArray(coordinates)) {
    const first = coordinates[0];
    if (Array.isArray(first)) {
      return extractPolygon(first[0]);
    }
  }
  return [];
}

function extractPolygon(ring: unknown): GeoPoint[] {
  if (!Array.isArray(ring)) {
    return [];
  }
  return ring
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) {
        return null;
      }
      const longitude = toNumber(point[0]);
      const latitude = toNumber(point[1]);
      if (latitude === null || longitude === null) {
        return null;
      }
      return { latitude, longitude };
    })
    .filter((point): point is GeoPoint => point !== null);
}

function mapAirspaceClass(value?: string): AirspaceClass {
  if (!value) {
    return "OTHER";
  }
  const normalized = value.toUpperCase();
  if (["A", "B", "C", "D", "E", "G"].includes(normalized)) {
    return normalized as AirspaceClass;
  }
  if (normalized.includes("SPECIAL")) {
    return "SPECIAL";
  }
  return "OTHER";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}
