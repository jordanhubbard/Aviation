import type { GeoJsonFeature } from "@aviation/shared-sdk/aviation/nav-data";
import { normalizeAirspace } from "@aviation/shared-sdk/aviation/nav-data";

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
    [key: string]: unknown;
  };
  geometry?: Record<string, unknown>;
}

export function ingestOpenAipAirspace(
  data: unknown,
): { type: "FeatureCollection"; features: GeoJsonFeature[] } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return normalizeAirspace(data);
  }
  const collection = data as OpenAipFeatureCollection;
  if (!Array.isArray(collection.features)) return normalizeAirspace(data);
  return normalizeAirspace({
    type: "FeatureCollection",
    features: collection.features.map((feature, index) => ({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        id: feature.properties?.id || `OPENAIP-${index + 1}`,
        class: mapAirspaceClass(feature.properties?.class),
        lower_limit_ft: toNumber(feature.properties?.lowerLimit),
        upper_limit_ft: toNumber(feature.properties?.upperLimit),
      },
    })),
  });
}

function mapAirspaceClass(value?: string): string {
  if (!value) return "OTHER";
  const normalized = value.trim().toUpperCase();
  if (["A", "B", "C", "D", "E", "G"].includes(normalized)) return normalized;
  return normalized.includes("SPECIAL") ? "SPECIAL" : "OTHER";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
