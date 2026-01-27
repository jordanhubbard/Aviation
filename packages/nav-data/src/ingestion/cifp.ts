import {
  NormalizedProcedure,
  ProcedureAltitudeConstraint,
  ProcedureLeg,
  ProcedureSpeedConstraint,
  ProcedureType,
} from "./types";

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
  const type = inferProcedureType(trimmed);
  const name = extractProcedureName(trimmed, identifier);
  const parsed = parseProcedureLegs(trimmed);
  return {
    identifier,
    airportIcao,
    type,
    name,
    transition: parsed.transition,
    fixes: parsed.fixes,
    legs: parsed.legs,
    rawRecord: trimmed,
    source: CIFP_SOURCE,
  };
}

function extractAirportIcao(record: string): string | undefined {
  const match = record.match(/[A-Z]{4}/);
  return match ? match[0] : undefined;
}

function extractProcedureName(record: string, fallback: string): string {
  const tokens = record.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    return tokens[1];
  }
  return fallback;
}

function inferProcedureType(record: string): ProcedureType {
  const upper = record.toUpperCase();
  if (upper.includes("SID") || upper.includes("DP") || upper.includes("DEP")) {
    return "SID";
  }
  if (upper.includes("STAR") || upper.includes("ARR")) {
    return "STAR";
  }
  if (
    upper.includes("APP") ||
    upper.includes("IAP") ||
    upper.includes("ILS") ||
    upper.includes("RNAV") ||
    upper.includes("VOR") ||
    upper.includes("LOC") ||
    upper.includes("NDB")
  ) {
    return "APPROACH";
  }
  return "OTHER";
}

function parseProcedureLegs(record: string): {
  fixes?: string[];
  legs?: ProcedureLeg[];
  transition?: string;
} {
  const tokens = record.split(/\s+/).filter(Boolean);
  const legs: ProcedureLeg[] = [];
  let transition: string | undefined;
  let currentLeg: ProcedureLeg | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].toUpperCase();
    if (token === "TRANS" || token === "TRANSITION") {
      const nextToken = tokens[index + 1];
      if (nextToken) {
        transition = nextToken.toUpperCase();
      }
      continue;
    }
    if (isFixToken(token)) {
      currentLeg = { fix: token };
      legs.push(currentLeg);
      continue;
    }
    if (!currentLeg) {
      continue;
    }
    const pathType = parsePathType(token);
    if (pathType) {
      currentLeg.pathType = pathType;
      continue;
    }
    const altitudeConstraint = parseAltitudeConstraint(token);
    if (altitudeConstraint) {
      currentLeg.altitudeConstraint = altitudeConstraint;
      continue;
    }
    const speedConstraint = parseSpeedConstraint(token);
    if (speedConstraint) {
      currentLeg.speedConstraint = speedConstraint;
    }
  }

  if (!legs.length) {
    return {};
  }

  return {
    fixes: legs.map((leg) => leg.fix),
    legs,
    transition,
  };
}

function isFixToken(token: string): boolean {
  return /^[A-Z0-9]{3,5}$/.test(token);
}

function parsePathType(token: string): string | undefined {
  const pathTypes = new Set([
    "IF",
    "TF",
    "CF",
    "DF",
    "AF",
    "RF",
    "HF",
    "HM",
    "HA",
    "VA",
    "VI",
    "VM",
  ]);
  return pathTypes.has(token) ? token : undefined;
}

function parseAltitudeConstraint(
  token: string,
): ProcedureAltitudeConstraint | undefined {
  const match = token.match(/^([ABC])(\d{3,5})$/);
  if (!match) {
    return undefined;
  }
  const [, code, digits] = match;
  const value = parseAltitudeValue(digits);
  const type =
    code === "A"
      ? "AT"
      : code === "B"
        ? "AT_OR_ABOVE"
        : "AT_OR_BELOW";
  return {
    type,
    altitudeFt: value,
  };
}

function parseAltitudeValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return value.length <= 3 ? parsed * 100 : parsed;
}

function parseSpeedConstraint(
  token: string,
): ProcedureSpeedConstraint | undefined {
  const match = token.match(/^(?:S|SPD)?(\d{2,3})(?:KT|KTS)?$/);
  if (!match || token.length <= 3) {
    return undefined;
  }
  return {
    type: token.startsWith("S") ? "AT" : "AT_OR_BELOW",
    speedKts: Number.parseInt(match[1], 10),
  };
}
