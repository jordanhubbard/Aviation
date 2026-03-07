import { parseCsvRecords } from "./csv";
import { NormalizedAirport, NormalizedNavaid, NavaidType } from "./types";

const OUR_AIRPORTS_SOURCE = "ourairports";

export function ingestOurAirportsAirports(csv: string): NormalizedAirport[] {
  return parseCsvRecords(csv)
    .map((row) => {
      const icao = row.ident?.toUpperCase();
      const latitude = toNumber(row.latitude_deg ?? row.latitude);
      const longitude = toNumber(row.longitude_deg ?? row.longitude);
      if (!icao || latitude === null || longitude === null) {
        return null;
      }
      return {
        icao,
        iata: row.iata_code?.toUpperCase() || undefined,
        name: row.name || icao,
        latitude,
        longitude,
        elevationFt: toNumber(row.elevation_ft) ?? undefined,
        type: row.type || undefined,
        country: row.iso_country || undefined,
        source: OUR_AIRPORTS_SOURCE,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null) as NormalizedAirport[];
}

export function ingestOurAirportsNavaids(csv: string): NormalizedNavaid[] {
  return parseCsvRecords(csv)
    .map((row) => {
      const identifier = row.ident?.toUpperCase();
      const latitude = toNumber(row.latitude_deg ?? row.latitude);
      const longitude = toNumber(row.longitude_deg ?? row.longitude);
      if (!identifier || latitude === null || longitude === null) {
        return null;
      }
      return {
        identifier,
        name: row.name || undefined,
        type: mapNavaidType(row.type),
        latitude,
        longitude,
        frequency: toNumber(row.frequency_khz ?? row.frequency)
          ?? toNumber(row.frequency_mhz),
        frequencyUnit: row.frequency_khz
          ? "kHz"
          : row.frequency_mhz
            ? "MHz"
            : undefined,
        source: OUR_AIRPORTS_SOURCE,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null) as NormalizedNavaid[];
}

function toNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapNavaidType(value?: string): NavaidType {
  if (!value) {
    return "OTHER";
  }
  const upper = value.toUpperCase();
  if (upper.includes("VOR")) {
    return "VOR";
  }
  if (upper.includes("NDB")) {
    return "NDB";
  }
  if (upper.includes("DME")) {
    return "DME";
  }
  if (upper.includes("TACAN")) {
    return "TACAN";
  }
  if (upper.includes("FIX")) {
    return "FIX";
  }
  return "OTHER";
}
