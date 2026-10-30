import { ingestCifpProcedures } from "./cifp";
import { ingestOpenAipAirspace } from "./openaip";
import { ingestOurAirportsAirports, ingestOurAirportsNavaids } from "./ourairports";
import { normalizeNavDataBundle } from "@aviation/shared-sdk/aviation/nav-data";
import type {
  NavDataIngestionInput,
  NavDataIngestionMetadata,
  NavDataIngestionResult,
} from "./types";

export function ingestNavData(
  input: NavDataIngestionInput,
  metadata: NavDataIngestionMetadata = {},
): NavDataIngestionResult {
  const sources: string[] = [];
  if (input.ourAirports?.airportsCsv || input.ourAirports?.navaidsCsv) {
    sources.push("ourairports");
  }
  if (input.openAip?.airspace) sources.push("openaip");
  if (input.faaCifp?.records) sources.push("faa-cifp");

  const airports = input.ourAirports?.airportsCsv
    ? ingestOurAirportsAirports(input.ourAirports.airportsCsv)
    : [];
  const bundle = normalizeNavDataBundle({
    metadata: {
      ...metadata,
      source: metadata.source?.trim() || sources.join("+") || "empty-provider-set",
    },
    navaids: input.ourAirports?.navaidsCsv
      ? ingestOurAirportsNavaids(input.ourAirports.navaidsCsv)
      : [],
    procedures: input.faaCifp?.records
      ? ingestCifpProcedures(input.faaCifp.records)
      : [],
    airspace: input.openAip?.airspace
      ? ingestOpenAipAirspace(input.openAip.airspace)
      : { type: "FeatureCollection", features: [] },
  });
  return { airports, bundle };
}

export { ingestCifpProcedures } from "./cifp";
export { ingestOpenAipAirspace } from "./openaip";
export { ingestOurAirportsAirports, ingestOurAirportsNavaids } from "./ourairports";
export type {
  NavDataIngestionInput,
  NavDataIngestionMetadata,
  NavDataIngestionResult,
} from "./types";
