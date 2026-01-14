import { RawEvent } from '../types.js';
import fs from 'fs';
import path from 'path';

// ASN publishes an RSS feed. We attempt to fetch and parse, but fall back to fixtures
// to keep the ingest path deterministic when offline.
const ASN_FEED = 'https://aviation-safety.net/rss/'; // RSS 2.0
const fixturePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/asn-feed.xml');

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
  // Heuristic: text before first " at " or " near "
  const atIdx = text.toLowerCase().indexOf(' at ');
  if (atIdx > 0) return text.slice(0, atIdx).trim();
  return undefined;
}

const fallbackNow = new Date().toISOString();
const FALLBACK: RawEvent[] = Array.from({ length: 10 }).map((_, i) => ({
  source: 'asn',
  id: `asn-fallback-${i + 1}`,
  url: `https://aviation-safety.net/sample/${i + 1}`,
  fetchedAt: fallbackNow,
  dateZ: fallbackNow,
  registration: i % 2 === 0 ? 'N' + (1000 + i) : 'G-TEST',
  aircraftType: i % 2 === 0 ? 'B738' : 'A320',
  operator: i % 2 === 0 ? 'Sample Air' : 'Example Airways',
  country: i % 2 === 0 ? 'US' : 'GB',
  summary: `Fallback ASN record ${i + 1}`,
  narrative: 'Fallback ingestion; replace with real parsed data when online.',
  status: 'preliminary',
}));

export async function fetchRecentAsn(): Promise<RawEvent[]> {
  try {
    const resp = await fetch(ASN_FEED, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`ASN feed HTTP ${resp.status}`);
    const xml = await resp.text();
    const parsed = parseRss(xml);
    if (parsed.length >= 1) return parsed.slice(0, 40);
    // fall through to fixture
  } catch (err) {
    console.warn('[asn] falling back to fixtures', err);
  }
  try {
    const xml = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseRss(xml);
    if (parsed.length >= 1) return parsed;
  } catch (err) {
    console.warn('[asn] fixture read failed', err);
  }
  return FALLBACK;
}
