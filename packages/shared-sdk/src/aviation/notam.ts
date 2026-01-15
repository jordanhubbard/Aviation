/**
 * NOTAM (Notice to Airmen) Integration
 *
 * Provides utilities for fetching and parsing NOTAMs from FAA sources.
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

/**
 * Categorize NOTAM by severity based on keywords
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

/**
 * Mock NOTAM data for development/testing
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
 * Fetch NOTAMs from FAA API (stub - requires API key and implementation)
 */
export async function fetchNotams(params: NotamSearchParams): Promise<NOTAM[]> {
  // For now, return mock data
  // In production, this would call the actual FAA NOTAM Search API
  // https://notams.aim.faa.gov/notamSearch/

  if (params.icao) {
    return fetchMockNotams(params.icao);
  }

  console.warn('NOTAM fetching not fully implemented. Using mock data.');
  return [];
}
