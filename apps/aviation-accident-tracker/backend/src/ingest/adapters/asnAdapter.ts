import { RawEvent } from '../types.js';
import fs from 'fs';
import path from 'path';
import { config } from '../../config.js';

const ASN_BASE = 'https://aviation-safety.net';
const USER_AGENT = 'AviationAccidentTracker/1.0 (+https://github.com/jordanhubbard/Aviation)';
const MAX_PAGES_PER_YEAR = 10;
const fixturePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/asn-feed.xml');

const allowFixtures = config.env !== 'production';

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

function parseRss(xml: string): RawEvent[] {
  const items = xml.split('<item>').slice(1);
  const events: RawEvent[] = [];
  for (const chunk of items) {
    const title = matchTag(chunk, 'title');
    const link = matchTag(chunk, 'link');
    const pubDate = matchTag(chunk, 'pubDate') || new Date().toISOString();
    if (!title || !link) continue;
    const reg = extractRegistration(title);
    const type = extractAircraftType(title);
    events.push({
      source: 'asn',
      id: link,
      url: link,
      fetchedAt: new Date().toISOString(),
      dateZ: new Date(pubDate).toISOString(),
      registration: reg || 'UNKNOWN',
      aircraftType: type || undefined,
      operator: extractOperator(title) || undefined,
      country: undefined,
      summary: title,
      narrative: title,
      status: 'preliminary',
    });
  }
  return events;
}

function matchTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

function extractRegistration(text: string): string | undefined {
  const m = text.match(/\b([A-Z0-9]{4,7}|N[0-9]{1,5}[A-Z]{0,2})\b/);
  return m ? m[1] : undefined;
}

function extractAircraftType(text: string): string | undefined {
  const m = text.match(/\b(A[0-9]{3}|B[0-9]{3}|[A-Z]{2,4}-?[0-9]{1,3})\b/);
  return m ? m[0] : undefined;
}

function extractOperator(text: string): string | undefined {
  const atIdx = text.toLowerCase().indexOf(' at ');
  if (atIdx > 0) return text.slice(0, atIdx).trim();
  return undefined;
}

function parseAsnListPage(html: string, fetchedAt: string): RawEvent[] {
  const rows = [...html.matchAll(/<tr class="list">([\\s\\S]*?)<\\/tr>/g)];
  const events: RawEvent[] = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td class="list">([\\s\\S]*?)<\\/td>/g)].map((m) => m[1]);
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

  if (!allowFixtures) {
    return [];
  }

  try {
    const xml = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseRss(xml);
    if (parsed.length >= 1) return parsed;
  } catch (err) {
    console.warn('[asn] fixture read failed', err);
  }

  return [];
}
