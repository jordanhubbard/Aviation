export interface MapMarkerInput {
  id: string;
  lat: number;
  lon: number;
  title?: string;
  subtitle?: string;
  category?: string;
  severity?: string;
  status?: string;
  onClickId?: string;
}

export interface ClusterOptions {
  showCoverageOnHover?: boolean;
  maxClusterRadius?: number;
  disableClusteringAtZoom?: number;
}

export interface NormalizedMarker {
  id: string;
  position: [number, number];
  tooltip?: string;
  popup?: string;
  category?: string;
  severity?: string;
  status?: string;
  payload?: Record<string, unknown>;
}

export function normalizeMarkers(inputs: MapMarkerInput[]): NormalizedMarker[] {
  return inputs.map((m) => ({
    id: m.id,
    position: [m.lat, m.lon],
    tooltip: m.title,
    popup: m.subtitle,
    category: m.category,
    severity: m.severity,
    status: m.status,
    payload: m.onClickId ? { onClickId: m.onClickId } : undefined,
  }));
}

export function defaultClusterOptions(overrides?: ClusterOptions): ClusterOptions {
  return {
    showCoverageOnHover: false,
    maxClusterRadius: 60,
    disableClusteringAtZoom: 12,
    ...overrides,
  };
}
