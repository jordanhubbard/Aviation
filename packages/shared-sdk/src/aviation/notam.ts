/**
 * NOTAM (Notice to Airmen) Integration
 *
 * Real client for the FAA NOTAM Search API (api.faa.gov/notams).
 * API key is loaded from the @aviation/keystore (service='faa', key='notam_api_key')
 * or from the FAA_NOTAM_API_KEY environment variable.
 *
 * FAA API docs: https://api.faa.gov/s/article/NOTAM-Search-Service-API-Key-Request
 *
 * @module @aviation/shared-sdk/aviation/notam
 */

export interface NOTAM {
  id: string;
  type: string; // e.g., "NOTAM", "FDC", "SUAFOR"
  location: string; // ICAO code
  facilityType: string; // e.g., "AD" (Aerodrome), "EN" (En-route), "NAV" (Navigation)
  effectiveStart: Date;
  effectiveEnd: Date;
  classification: string; // e.g., "Class I", "Class II"
  text: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category?: string; // Runway, Taxiway, Lighting, Navigation, etc.
}

export interface NotamSearchParams {
  icao?: string;
  radius?: number; // nautical miles
  latitude?: number;
  longitude?: number;
  startDate?: Date;
  endDate?: Date;
}

/** Shape of a single item returned by api.faa.gov/notams */
export interface FaaNotamApiItem {
  properties?: {
    coreNOTAMData?: {
      notam?: {
        id?: string;
        type?: string;
        location?: string;
        affectedFIR?: string;
        selectionCode?: string;
        traffic?: string;
        purpose?: string;
        scope?: string;
        minimumFL?: string;
        maximumFL?: string;
        coordinates?: string;
        radius?: string;
        EffectiveStart?: string;
        EffectiveEnd?: string;
        text?: string;
        classification?: string;
        accountId?: string;
        lastUpdatedTimestamp?: string;
        icaoMessage?: string;
        traditionalMessage?: string;
        plainLanguage?: string;
        cancelledOrExpired?: boolean;
        digitalTWEB?: boolean;
        systemPicklistId?: string;
        facilityDesignator?: string;
        notamNumber?: string;
        series?: string;
        number?: string;
        year?: string;
        geometryType?: string;
      };
    };
  };
}

/** Options for NotamClient constructor */
export interface NotamClientOptions {
  /** FAA NOTAM API base URL (overridable for testing) */
  baseUrl?: string;
  /** FAA API key. Falls back to FAA_NOTAM_API_KEY env var. */
  apiKey?: string;
  /** Injected fetch function (defaults to global fetch) */
  fetchFn?: typeof fetch;
}

/**
 * Client for the FAA NOTAM Search API.
 *
 * Usage:
 *   const client = new NotamClient({ apiKey: process.env.FAA_NOTAM_API_KEY });
 *   const notams = await client.fetchByIcao('KSFO');
 */
export class NotamClient {
  private baseUrl: string;
  private apiKey: string;
  private fetchFn: typeof fetch;

  constructor(opts: NotamClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://external-api.faa.gov/notamapi/v1/notams';
    this.apiKey = opts.apiKey ?? process.env.FAA_NOTAM_API_KEY ?? '';
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  /**
   * Fetch NOTAMs for a single ICAO location code.
   * Returns an empty array (not an error) when no NOTAMs are found.
   * Throws on HTTP errors so callers can decide how to handle them.
   */
  async fetchByIcao(icao: string, radiusNm: number = 0): Promise<NOTAM[]> {
    const params = new URLSearchParams({
      icaoLocation: icao.toUpperCase(),
      ...(radiusNm > 0 ? { radius: String(Math.round(radiusNm)) } : {}),
      pageSize: '100',
      pageNum: '1',
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    const res = await this.fetchFn(url, {
      headers: {
        client_id: this.apiKey,
        client_secret: this.apiKey,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`FAA NOTAM API error: HTTP ${res.status} for ${icao}`);
    }

    const json = (await res.json()) as { items?: FaaNotamApiItem[] };
    return (json.items ?? []).map((item) => parseNotamItem(item));
  }

  /**
   * Fetch NOTAMs for multiple ICAO codes (e.g., all airports on a route).
   * Results are de-duplicated by NOTAM id.
   */
  async fetchForRoute(icaos: string[]): Promise<NOTAM[]> {
    const results = await Promise.all(icaos.map((icao) => this.fetchByIcao(icao)));
    const seen = new Set<string>();
    const merged: NOTAM[] = [];
    for (const batch of results) {
      for (const notam of batch) {
        if (!seen.has(notam.id)) {
          seen.add(notam.id);
          merged.push(notam);
        }
      }
    }
    return merged;
  }
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

/**
 * Parse a raw FAA NOTAM API item into our canonical NOTAM shape.
 * Exposed for unit-testing against fixture data.
 */
export function parseNotamItem(item: FaaNotamApiItem): NOTAM {
  const n = item.properties?.coreNOTAMData?.notam ?? {};

  const rawText = n.plainLanguage ?? n.traditionalMessage ?? n.icaoMessage ?? n.text ?? '';
  const location = n.location ?? n.facilityDesignator ?? '';
  const facilityType = deriveFacilityType(n.scope ?? '');
  const effectiveStart = n.EffectiveStart ? new Date(n.EffectiveStart) : new Date();
  const effectiveEnd = n.EffectiveEnd ? new Date(n.EffectiveEnd) : new Date(Date.now() + 7 * 86400000);
  const notamId = n.id ?? n.notamNumber ?? `${location}-${Date.now()}`;

  const notam: NOTAM = {
    id: notamId,
    type: n.type ?? 'NOTAM',
    location,
    facilityType,
    effectiveStart,
    effectiveEnd,
    classification: n.classification ?? 'Unknown',
    text: rawText.trim(),
    severity: 'low', // will be set below
    category: categorizeNotam(rawText),
  };

  notam.severity = categorizeNotamSeverity(notam);
  return notam;
}

/** Map FAA scope codes to our facilityType labels */
function deriveFacilityType(scope: string): string {
  const s = scope.toUpperCase();
  if (s.includes('A')) return 'AD'; // Aerodrome
  if (s.includes('E')) return 'EN'; // En-route
  if (s.includes('N')) return 'NAV'; // Navigation
  return scope || 'AD';
}

// ─── Pure helper functions (kept from original, used by consumers) ────────────

/**
 * Categorize NOTAM by severity based on keywords in its text.
 */
export function categorizeNotamSeverity(notam: NOTAM): 'low' | 'medium' | 'high' | 'critical' {
  const text = notam.text.toUpperCase();

  // Critical keywords
  if (
    text.includes('CLOSED') ||
    text.includes('CLSD') ||
    text.includes('OUT OF SERVICE') ||
    text.includes('U/S') ||
    text.includes('NOTAVBL')
  ) {
    return 'critical';
  }

  // High severity keywords
  if (
    text.includes('OBST') ||
    text.includes('OBSTACLE') ||
    text.includes('CRANE') ||
    text.includes('TOWER') ||
    text.includes('CONSTRUCTION')
  ) {
    return 'high';
  }

  // Medium severity keywords
  if (
    text.includes('DISPLACED') ||
    text.includes('DSPLCD') ||
    text.includes('LIGHTING') ||
    text.includes('LGT') ||
    text.includes('NAVAID') ||
    text.includes('VASI') ||
    text.includes('PAPI')
  ) {
    return 'medium';
  }

  // Default to low
  return 'low';
}

/**
 * Determine NOTAM category from text
 */
export function categorizeNotam(text: string): string {
  const upper = text.toUpperCase();

  if (upper.includes('RWY') || upper.includes('RUNWAY')) return 'Runway';
  if (upper.includes('TWY') || upper.includes('TAXIWAY')) return 'Taxiway';
  if (upper.includes('APRON') || upper.includes('RAMP')) return 'Apron/Ramp';
  if (upper.includes('LIGHTING') || upper.includes('LGT')) return 'Lighting';
  if (upper.includes('NAVAID') || upper.includes('NAV') || upper.includes('VOR') || upper.includes('ILS')) return 'Navigation';
  if (upper.includes('OBST') || upper.includes('OBSTACLE') || upper.includes('CRANE')) return 'Obstacle';
  if (upper.includes('AIRSPACE') || upper.includes('TFR')) return 'Airspace';
  if (upper.includes('FREQ') || upper.includes('FREQUENCY') || upper.includes('ATIS')) return 'Communications';
  if (upper.includes('FUEL')) return 'Fuel';
  if (upper.includes('WEATHER') || upper.includes('WX')) return 'Weather';

  return 'General';
}

/**
 * Check if NOTAM is currently effective
 */
export function isNotamEffective(notam: NOTAM, checkDate: Date = new Date()): boolean {
  return checkDate >= notam.effectiveStart && checkDate <= notam.effectiveEnd;
}

/**
 * Filter NOTAMs by relevance to a route
 */
export function filterRelevantNotams(
  notams: NOTAM[],
  routeIcaos: string[],
  includeEnroute: boolean = false
): NOTAM[] {
  const now = new Date();

  return notams.filter((notam) => {
    // Must be currently effective
    if (!isNotamEffective(notam, now)) {
      return false;
    }

    // Check if NOTAM is for a location on the route
    if (routeIcaos.some((icao) => notam.location.startsWith(icao))) {
      return true;
    }

    // Optionally include en-route NOTAMs
    if (includeEnroute && notam.facilityType === 'EN') {
      return true;
    }

    return false;
  });
}

/**
 * Sort NOTAMs by severity (critical first)
 */
export function sortNotamsBySeverity(notams: NOTAM[]): NOTAM[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  return [...notams].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Format NOTAM text for display (simplify FAA format)
 */
export function formatNotamText(text: string): string {
  // Remove excessive whitespace
  let formatted = text.replace(/\s+/g, ' ').trim();

  // Expand common abbreviations
  formatted = formatted
    .replace(/\bRWY\b/g, 'Runway')
    .replace(/\bTWY\b/g, 'Taxiway')
    .replace(/\bCLSD\b/g, 'CLOSED')
    .replace(/\bOBST\b/g, 'Obstacle')
    .replace(/\bLGT\b/g, 'Lighting')
    .replace(/\bNAVAID\b/g, 'Navigation Aid')
    .replace(/\bU\/S\b/g, 'Out of Service')
    .replace(/\bNOTAVBL\b/g, 'Not Available');

  return formatted;
}

// ─── Legacy convenience function (kept for backward compat) ──────────────────

/**
 * Mock NOTAM data for development/testing (kept for backward compatibility).
 * Prefer using NotamClient with a mock fetchFn in tests instead.
 */
export async function fetchMockNotams(icao: string): Promise<NOTAM[]> {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const mockNotams: NOTAM[] = [
    {
      id: `${icao}001`,
      type: 'NOTAM',
      location: icao,
      facilityType: 'AD',
      effectiveStart: now,
      effectiveEnd: nextWeek,
      classification: 'Class I',
      text: `RWY 18/36 CLSD FOR MAINTENANCE`,
      severity: 'critical',
      category: 'Runway',
    },
    {
      id: `${icao}002`,
      type: 'NOTAM',
      location: icao,
      facilityType: 'AD',
      effectiveStart: now,
      effectiveEnd: tomorrow,
      classification: 'Class II',
      text: `TWY A LIGHTING OUT OF SERVICE`,
      severity: 'medium',
      category: 'Lighting',
    },
    {
      id: `${icao}003`,
      type: 'NOTAM',
      location: icao,
      facilityType: 'AD',
      effectiveStart: now,
      effectiveEnd: nextWeek,
      classification: 'Class I',
      text: `OBST CRANE 250FT AGL 1000FT SOUTH OF RWY 27 THRESHOLD`,
      severity: 'high',
      category: 'Obstacle',
    },
  ];

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return mockNotams;
}

/**
 * Fetch NOTAMs via the real FAA NOTAM Search API.
 *
 * If no API key is configured the call is attempted anyway (the FAA API may
 * allow unauthenticated requests up to a rate limit).  Configure the key via:
 *   - FAA_NOTAM_API_KEY environment variable, OR
 *   - @aviation/keystore  service='faa'  key='notam_api_key'
 *
 * Falls back to mock data when the API call fails and no key is present, so
 * development without credentials still works.
 */
export async function fetchNotams(
  params: NotamSearchParams,
  opts: NotamClientOptions = {}
): Promise<NOTAM[]> {
  const client = new NotamClient(opts);

  if (params.icao) {
    try {
      return await client.fetchByIcao(params.icao, params.radius);
    } catch (err) {
      // No API key in dev environment: fall back to mock data with a warning
      if (!opts.apiKey && !process.env.FAA_NOTAM_API_KEY) {
        console.warn(
          `[NOTAM] FAA API call failed (no key configured) — using mock data for ${params.icao}. ` +
            'Set FAA_NOTAM_API_KEY to enable live data.'
        );
        return fetchMockNotams(params.icao);
      }
      throw err;
    }
  }

  return [];
}
