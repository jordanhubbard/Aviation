import type { Airport } from "@aviation/shared-sdk/aviation/airports";
import { normalizeAirportRecords } from "@aviation/shared-sdk/aviation/airports/bundled";
import type { NavaidRecord } from "@aviation/shared-sdk/aviation/nav-data";
import { normalizeNavaid } from "@aviation/shared-sdk/aviation/nav-data";
import { parseCsvRecords } from "./csv";

export function ingestOurAirportsAirports(csv: string): Airport[] {
  return normalizeAirportRecords(parseCsvRecords(csv).map((row) => ({
    icao: row.ident,
    iata: row.iata_code,
    name: row.name,
    country: row.iso_country,
    latitude: row.latitude_deg ?? row.latitude,
    longitude: row.longitude_deg ?? row.longitude,
    elevation: row.elevation_ft,
    type: row.type,
  })));
}

export function ingestOurAirportsNavaids(csv: string): NavaidRecord[] {
  return parseCsvRecords(csv).map((row) => normalizeNavaid({
    identifier: row.ident,
    name: row.name,
    type: mapNavaidType(row.type),
    latitude: row.latitude_deg ?? row.latitude,
    longitude: row.longitude_deg ?? row.longitude,
    frequency: normalizeFrequency(row),
  }));
}

function normalizeFrequency(row: Record<string, string>): number | undefined {
  const raw = row.frequency_mhz || row.frequency_khz || row.frequency;
  if (!raw) return undefined;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return undefined;
  return row.frequency_khz ? value / 1000 : value;
}

function mapNavaidType(value?: string): string {
  if (!value) return "OTHER";
  const upper = value.toUpperCase();
  if (upper.includes("VOR")) return "VOR";
  if (upper.includes("NDB")) return "NDB";
  if (upper.includes("DME")) return "DME";
  if (upper.includes("TACAN")) return "TACAN";
  if (upper.includes("FIX")) return "FIX";
  return "OTHER";
}
