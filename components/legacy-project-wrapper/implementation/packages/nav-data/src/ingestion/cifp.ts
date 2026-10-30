import type {
  ProcedureLeg,
  ProcedureRecord,
} from "@aviation/shared-sdk/aviation/nav-data";
import { normalizeProcedure } from "@aviation/shared-sdk/aviation/nav-data";

export function ingestCifpProcedures(content: string | string[]): ProcedureRecord[] {
  const lines = Array.isArray(content) ? content : content.split(/\r?\n/);
  return lines.flatMap((line) => {
    const procedure = buildProcedure(line);
    return procedure ? [procedure] : [];
  });
}

function buildProcedure(line: string): ProcedureRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const identifier = tokens[0];
  const airportIcao = tokens.find((token) => /^[A-Z]{4}$/.test(token.toUpperCase()));
  const procedureType = inferProcedureType(trimmed);
  if (!airportIcao) throw new Error(`CIFP record lacks an airport ICAO: ${identifier}`);
  if (!procedureType) throw new Error(`CIFP record has an unsupported procedure type: ${identifier}`);
  const parsed = parseProcedureLegs(tokens.slice(1), airportIcao);
  return normalizeProcedure({
    identifier,
    airport_icao: airportIcao,
    procedure_type: procedureType,
    transitions: parsed.transition ? [parsed.transition] : [],
    legs: parsed.legs,
  });
}

function inferProcedureType(record: string): ProcedureRecord["procedure_type"] | null {
  const upper = record.toUpperCase();
  if (/\b(SID|DP|DEP)\b/.test(upper)) return "SID";
  if (/\b(STAR|ARR)\b/.test(upper)) return "STAR";
  if (/\b(APP|IAP|ILS|RNAV|VOR|LOC|NDB)\b/.test(upper)) return "APPROACH";
  return null;
}

function parseProcedureLegs(
  tokens: string[],
  airportIcao: string,
): { legs: ProcedureLeg[]; transition?: string } {
  const legs: ProcedureLeg[] = [];
  let transition: string | undefined;
  let currentLeg: ProcedureLeg | undefined;
  const metadata = new Set([
    airportIcao.toUpperCase(), "SID", "DP", "DEP", "STAR", "ARR",
    "APP", "IAP", "ILS", "RNAV", "VOR", "LOC", "NDB",
  ]);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].toUpperCase();
    if (token === "TRANS" || token === "TRANSITION") {
      transition = tokens[index + 1]?.toUpperCase();
      index += 1;
      continue;
    }
    if (metadata.has(token)) continue;
    if (isPathType(token) && currentLeg) {
      currentLeg.path_type = token;
      continue;
    }
    const altitude = parseAltitudeConstraint(token);
    if (altitude && currentLeg) {
      currentLeg.altitude_constraint = altitude.constraint;
      currentLeg.altitude_ft = altitude.altitude;
      continue;
    }
    if (/^[A-Z0-9]{3,5}$/.test(token)) {
      currentLeg = { fix: token };
      legs.push(currentLeg);
    }
  }
  return { legs, transition };
}

function isPathType(token: string): boolean {
  return new Set(["IF", "TF", "CF", "DF", "AF", "RF", "HF", "HM", "HA", "VA", "VI", "VM"]).has(token);
}

function parseAltitudeConstraint(
  token: string,
): { constraint: string; altitude: number } | null {
  const match = token.match(/^([ABC])(\d{3,5})$/);
  if (!match) return null;
  const altitude = match[2].length <= 3
    ? Number.parseInt(match[2], 10) * 100
    : Number.parseInt(match[2], 10);
  const kind = match[1] === "A" ? "AT" : match[1] === "B" ? "AT_OR_ABOVE" : "AT_OR_BELOW";
  return { constraint: `${kind} ${altitude}`, altitude };
}
