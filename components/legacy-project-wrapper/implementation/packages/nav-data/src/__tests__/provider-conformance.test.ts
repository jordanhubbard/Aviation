import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NavDataCatalog } from "@aviation/shared-sdk/aviation/nav-data";
import * as providerPackage from "../index";
import { ingestNavData } from "../index";

const packagedPath = fileURLToPath(new URL("../../conformance/provider-adapters.json", import.meta.url));
const authorityPath = fileURLToPath(new URL(
  "../../../../../../../components/aviation-nav-data/acceptance/provider-adapters.json",
  import.meta.url,
));
const contract = JSON.parse(readFileSync(packagedPath, "utf8"));
if (existsSync(authorityPath)) {
  const authority = JSON.parse(readFileSync(authorityPath, "utf8"));
  if (!isDeepStrictEqual(contract, authority)) {
    throw new Error("packaged provider vectors differ from Component authority");
  }
}

describe("aviation.nav-data provider adapters", () => {
  it("emits only shared SDK airport and nav-data contracts", () => {
    const result = ingestNavData(contract.input, contract.metadata);
    const catalog = new NavDataCatalog(result.bundle);
    expect(result.bundle.metadata.source).toBe(contract.expected.source);
    expect(result.airports.map((airport) => airport.icao)).toEqual(contract.expected.airport_codes);
    expect(result.bundle.navaids[0]).toMatchObject(contract.expected.navaid);
    expect(result.bundle.procedures[0]).toMatchObject(contract.expected.procedure);
    expect(result.bundle.airspace.features[0].properties).toMatchObject(contract.expected.airspace);
    expect(catalog.searchNavaids("francisco").map((record) => record.identifier))
      .toEqual(contract.expected.search_identifiers);
  });

  it("fails invalid provider coordinates through common SDK validation", () => {
    expect(() => ingestNavData({
      ourAirports: {
        navaidsCsv: "ident,name,type,latitude_deg,longitude_deg\nBAD,Bad Fix,FIX,91,0",
      },
    })).toThrow("latitude must be in [-90, 90]");
  });

  it("does not expose a second database, cache, or search implementation", () => {
    expect(providerPackage).not.toHaveProperty("NavDatabase");
    expect(providerPackage).not.toHaveProperty("NavDatabaseCache");
    expect(providerPackage).not.toHaveProperty("searchNavaids");
    expect(providerPackage).not.toHaveProperty("listProceduresForAirport");
  });
});
