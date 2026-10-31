import { RawEvent } from '../types.js';
import { config } from '../../config.js';

const ASN_BASE = 'https://aviation-safety.net';
const USER_AGENT = 'AviationAccidentTracker/1.0 (+https://github.com/jordanhubbard/Aviation)';
const MAX_PAGES_PER_YEAR = 10;

const entityMap: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&#160;': ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&[a-zA-Z#0-9]+;/g, (entity) => entityMap[entity] ?? entity);
}

function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseDate(value: string): Date | null {
  const parsed = new Date(`${value} UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseFatalities(value: string): { fatalities: number; injuries: number } {
  const cleaned = value.replace(/\s/g, '');
  if (!cleaned) return { fatalities: 0, injuries: 0 };

  const separator = cleaned.includes('+') ? '+' : cleaned.includes('/') ? '/' : null;
  if (separator) {
    const [fatal, injured] = cleaned.split(separator);
    return {
      fatalities: Number.parseInt(fatal, 10) || 0,
      injuries: Number.parseInt(injured, 10) || 0,
    };
  }

  return {
    fatalities: Number.parseInt(cleaned, 10) || 0,
    injuries: 0,
  };
}

function extractAirportCodes(location: string): { airportIata?: string; airportIcao?: string } {
  const match = location.match(/\(([^)]+)\)/);
  if (!match) return {};

  const candidates = match[1].split('/').map((code) => code.trim());
  let airportIata: string | undefined;
  let airportIcao: string | undefined;

  for (const code of candidates) {
    if (/^[A-Z]{4}$/.test(code)) airportIcao = code;
    if (/^[A-Z]{3}$/.test(code)) airportIata = code;
  }

  return { airportIata, airportIcao };
}

export function parseAsnListPage(html: string, fetchedAt: string): RawEvent[] {
  const rowPattern = new RegExp('<tr class="list">([\\s\\S]*?)</tr>', 'g');
  const cellPattern = new RegExp('<td class="list">([\\s\\S]*?)</td>', 'g');
  const rows = [...html.matchAll(rowPattern)];
  const events: RawEvent[] = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(cellPattern)].map((m) => m[1]);
    if (cells.length < 6) continue;

    const dateCell = cells[0];
    const dateText = stripHtml(dateCell);
    const date = parseDate(dateText);
    if (!date) continue;

    const linkMatch = dateCell.match(/href=([^\s>]+)/i);
    const linkPath = linkMatch ? linkMatch[1].replace(/["']/g, '') : '';
    const url = linkPath ? `${ASN_BASE}${linkPath}` : `${ASN_BASE}/database/`;

    const aircraftType = stripHtml(cells[1]);
    const registration = stripHtml(cells[2]) || 'UNKNOWN';
    const operator = stripHtml(cells[3]);
    const fatalText = stripHtml(cells[4]);
    const location = stripHtml(cells[5]);
    const { airportIata, airportIcao } = extractAirportCodes(location);
    const { fatalities, injuries } = parseFatalities(fatalText);
    const summary = [aircraftType, registration, location].filter(Boolean).join(' - ');

    events.push({
      source: 'asn',
      id: url,
      url,
      fetchedAt,
      dateZ: date.toISOString(),
      registration,
      aircraftType: aircraftType || undefined,
      operator: operator || undefined,
      airportIata,
      airportIcao,
      fatalities,
      injuries,
      summary: summary || undefined,
      narrative: summary || undefined,
      status: 'preliminary',
    });
  }

  return events;
}

function hasNextPage(html: string, year: number, nextPage: number): boolean {
  const pattern = new RegExp(`/database/year/${year}/${nextPage}(?!\\d)`);
  return pattern.test(html);
}

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) {
    throw new Error(`ASN page HTTP ${resp.status}`);
  }
  return resp.text();
}

export async function fetchRecentAsn(): Promise<RawEvent[]> {
  const now = new Date();
  const fetchedAt = now.toISOString();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - config.ingestion.windowDays);
  const cutoffYear = cutoff.getUTCFullYear();
  const events: RawEvent[] = [];

  try {
    for (let year = now.getUTCFullYear(); year >= cutoffYear; year--) {
      for (let page = 1; page <= MAX_PAGES_PER_YEAR; page++) {
        const url = `${ASN_BASE}/database/year/${year}/${page}`;
        const html = await fetchHtml(url);
        const pageEvents = parseAsnListPage(html, fetchedAt);
        if (!pageEvents.length) break;

        let shouldStop = false;
        for (const event of pageEvents) {
          if (new Date(event.dateZ) < cutoff) {
            shouldStop = true;
            break;
          }
          events.push(event);
        }

        if (shouldStop || !hasNextPage(html, year, page + 1)) {
          break;
        }
      }
    }

    if (events.length > 0) {
      return events;
    }
  } catch (err) {
    console.warn('[asn] live scrape failed', err);
  }

  return [];
}
