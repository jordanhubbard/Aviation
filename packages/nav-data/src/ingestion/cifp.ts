import { NormalizedProcedure } from "./types";

const CIFP_SOURCE = "faa-cifp";

export function ingestCifpProcedures(content: string | string[]): NormalizedProcedure[] {
  const lines = Array.isArray(content) ? content : content.split(/\r?\n/);
  return lines
    .map((line, index) => buildProcedure(line, index))
    .filter((procedure): procedure is NormalizedProcedure => procedure !== null);
}

function buildProcedure(line: string, index: number): NormalizedProcedure | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const identifier = trimmed.slice(0, 12).trim() || `cifp-${index + 1}`;
  const airportIcao = extractAirportIcao(trimmed);
  return {
    identifier,
    airportIcao,
    type: "OTHER",
    rawRecord: trimmed,
    source: CIFP_SOURCE,
  };
}

function extractAirportIcao(record: string): string | undefined {
  const match = record.match(/[A-Z]{4}/);
  return match ? match[0] : undefined;
}
