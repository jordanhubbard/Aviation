/** Portable NOTAM helpers and compatibility access to the cached NMS service. */
import { NotamReportsClient, type NotamBriefing } from './notam-reports.js';

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

export type NotamRecordInput = {
  id: unknown;
  type?: unknown;
  location: unknown;
  facilityType?: unknown;
  effectiveStart: unknown;
  effectiveEnd: unknown;
  classification?: unknown;
  text: unknown;
};

/** Stable fail-closed error emitted by portable NOTAM normalization. */
export class NotamValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'NotamValidationError';
  }
}

const requiredText = (value: unknown, code: string, field: string): string => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new NotamValidationError(code, `${field} is required`);
  return normalized;
};

const requiredCanonical = (value: unknown, code: string, field: string): string =>
  requiredText(value, code, field).toUpperCase();

const requiredInstant = (value: unknown, code: string, field: string): Date => {
  if (
    typeof value === 'string'
    && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim())
  ) {
    throw new NotamValidationError(code, `${field} must include a timezone`);
  }
  const result = value instanceof Date ? new Date(value.getTime()) : new Date(String(value ?? ''));
  if (!Number.isFinite(result.getTime())) {
    throw new NotamValidationError(code, `${field} must be a valid instant`);
  }
  return result;
};

/**
 * Validate and canonicalize one provider-neutral NOTAM record.
 *
 * Provider adapters own response-envelope extraction; this operation owns the common
 * record semantics used after extraction.
 */
export function normalizeNotamRecord(input: NotamRecordInput): NOTAM {
  const id = requiredCanonical(input.id, 'notam-id-required', 'id');
  const location = requiredCanonical(
    input.location,
    'notam-location-required',
    'location'
  );
  const text = requiredText(input.text, 'notam-text-required', 'text');
  const effectiveStart = requiredInstant(
    input.effectiveStart,
    'notam-effective-start-invalid',
    'effectiveStart'
  );
  const effectiveEnd = requiredInstant(
    input.effectiveEnd,
    'notam-effective-end-invalid',
    'effectiveEnd'
  );
  if (effectiveEnd < effectiveStart) {
    throw new NotamValidationError(
      'notam-effective-window-invalid',
      'effectiveEnd must not precede effectiveStart'
    );
  }

  const result: NOTAM = {
    id,
    type: String(input.type ?? 'NOTAM').trim().toUpperCase() || 'NOTAM',
    location,
    facilityType: String(input.facilityType ?? 'AD').trim().toUpperCase() || 'AD',
    effectiveStart,
    effectiveEnd,
    classification: String(input.classification ?? 'Unknown').trim() || 'Unknown',
    text,
    severity: 'low',
    category: categorizeNotam(text),
  };
  result.severity = categorizeNotamSeverity(result);
  return result;
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
  /** Cached Aviation NOTAM service URL (never the FAA origin). */
  baseUrl?: string;
  /** @deprecated Ignored. FAA credentials belong only to the server worker. */
  apiKey?: string;
  /** Injected fetch function (defaults to global fetch) */
  fetchFn?: typeof fetch;
}

/** Compatibility client for the cached Aviation NOTAM service.
 * Use fetchReportsByIcao to preserve permanent/unknown/source-status semantics.
 * API keys are ignored; only the worker authenticates directly to FAA.
 */
export class NotamClient {
  private readonly reports: NotamReportsClient;
  constructor(options: NotamClientOptions = {}) { this.reports = new NotamReportsClient(options); }
  async fetchReportsByIcao(icao: string): Promise<NotamBriefing> { return this.reports.fetch([icao]); }
  async fetchByIcao(icao: string, radiusNm = 0): Promise<NOTAM[]> {
    if (radiusNm !== 0) throw new Error('Cached NOTAM location matching does not establish radius coverage');
    return this.project(await this.fetchReportsByIcao(icao));
  }
  async fetchForRoute(icaos: string[]): Promise<NOTAM[]> { return this.project(await this.reports.fetch(icaos)); }
  private project(reports: NotamBriefing): NOTAM[] {
    if (!reports.production_data || !reports.complete_snapshot || !['available', 'no_reports'].includes(reports.status))
      throw new Error('Current complete production NOTAM reports required; use fetchReportsByIcao for explicit source status');
    return reports.notams.map(row => {
      if (!row.type || !row.text || !row.icao_location || !row.effective_start_utc || !row.effective_end_utc || row.permanent || row.missing_fields.length)
        throw new Error('NOTAM source cannot fit the legacy dated shape; use fetchReportsByIcao');
      return normalizeNotamRecord({ id: row.id, type: row.type, location: row.icao_location,
        facilityType: 'UNKNOWN', classification: row.classification, text: row.text,
        effectiveStart: row.effective_start_utc, effectiveEnd: row.effective_end_utc });
    });
  }
}

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

  if (
    location.trim() && rawText.trim()
    && Number.isFinite(effectiveStart.getTime())
    && Number.isFinite(effectiveEnd.getTime())
  ) {
    return normalizeNotamRecord({
      id: notamId,
      type: n.type ?? 'NOTAM',
      location,
      facilityType,
      effectiveStart,
      effectiveEnd,
      classification: n.classification ?? 'Unknown',
      text: rawText,
    });
  }

  // Preserve the adapter's historical empty-item compatibility shape. Portable
  // callers should use normalizeNotamRecord, which rejects incomplete records.
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
  includeEnroute: boolean = false,
  checkDate: Date = new Date()
): NOTAM[] {
  const canonicalRouteIcaos = routeIcaos
    .map((icao) => icao.trim().toUpperCase())
    .filter(Boolean);

  return notams.filter((notam) => {
    // Must be currently effective
    if (!isNotamEffective(notam, checkDate)) {
      return false;
    }

    // Check if NOTAM is for a location on the route
    const location = notam.location.trim().toUpperCase();
    if (canonicalRouteIcaos.some((icao) => location.startsWith(icao))) {
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

/** Compatibility helper. Failures remain unavailable; samples require an explicit call. */
export async function fetchNotams(params: NotamSearchParams, opts: NotamClientOptions = {}): Promise<NOTAM[]> {
  if (params.latitude !== undefined || params.longitude !== undefined || params.startDate || params.endDate)
    throw new Error('Location matching does not establish geographic or time-window NOTAM coverage');
  if (!params.icao) return [];
  return new NotamClient(opts).fetchByIcao(params.icao, params.radius);
}
