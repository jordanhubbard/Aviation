import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import { freshnessStatus, NavDataCatalog } from '../nav-data/index.js';

const contract = loadConformanceContract<any>('nav-data');

describe('aviation.nav-data Component conformance', () => {
  it('uses the versioned Component-owned vector schema', () => {
    expect(contract.schema).toBe('aviation/nav-data-acceptance-vectors@1');
  });

  it('normalizes records and airspace deterministically', () => {
    const catalog = new NavDataCatalog(contract.bundle);
    expect(catalog.bundle.navaids.map((record) => record.identifier)).toEqual(contract.expected.navaid_identifiers);
    expect(catalog.bundle.navaids.map((record) => record.type)).toEqual(contract.expected.navaid_types);
    expect(catalog.bundle.procedures.map((record) => record.identifier)).toEqual(contract.expected.procedure_identifiers);
    expect(catalog.bundle.procedures.map((record) => record.procedure_type)).toEqual(contract.expected.procedure_types);
    expect(catalog.bundle.airspace.features.map((feature) => feature.properties.id)).toEqual(contract.expected.airspace_feature_ids);
  });

  it('searches navaids in stable ingestion order', () => {
    const catalog = new NavDataCatalog(contract.bundle);
    expect(catalog.searchNavaids(contract.expected.search.query).map((record) => record.identifier))
      .toEqual(contract.expected.search.identifiers);
  });

  it('filters procedures by airport, type, and runway', () => {
    const catalog = new NavDataCatalog(contract.bundle);
    const filter = contract.expected.procedure_filter;
    expect(catalog.proceduresForAirport(filter.airport_icao, filter.procedure_type, filter.runway)
      .map((record) => record.identifier)).toEqual(filter.identifiers);
  });

  it('reports provenance, counts, and freshness', () => {
    const catalog = new NavDataCatalog(contract.bundle);
    const status = catalog.status('2026-10-30T12:00:00Z');
    expect(Object.fromEntries(Object.keys(contract.expected.status).map((key) => [key, status[key]])))
      .toEqual(contract.expected.status);
  });

  for (const vector of contract.freshness) {
    it(`freshness: ${vector.id}`, () => {
      expect(freshnessStatus(vector.metadata, vector.at)).toBe(vector.expected);
    });
  }
});
