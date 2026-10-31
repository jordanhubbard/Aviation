import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DATA_PATH = path.join(PACKAGE_ROOT, 'data', 'airports_cache.json');
const PROVENANCE_PATH = path.join(PACKAGE_ROOT, 'data', 'provenance.json');

type Provenance = {
  classification: string;
  artifact: { sha256: string; record_count: number; schema_contract: string };
  source: { provider: string; terms_url: string; license: string };
  snapshot: { acquired_at: string | null; source_sha256: string | null; freshness: string };
};

describe('bundled airport data provenance', () => {
  test('binds the public-domain source declaration to the exact checked-in snapshot', () => {
    const provenance = JSON.parse(readFileSync(PROVENANCE_PATH, 'utf8')) as Provenance;
    const bytes = readFileSync(DATA_PATH);

    expect(createHash('sha256').update(bytes).digest('hex')).toBe(provenance.artifact.sha256);
    expect(JSON.parse(bytes.toString('utf8'))).toHaveLength(provenance.artifact.record_count);
    expect(provenance.classification).toBe('redistributable-derived-snapshot');
    expect(provenance.source).toMatchObject({
      provider: 'OurAirports',
      terms_url: 'https://ourairports.com/data/',
      license: 'Public Domain',
    });
    expect(provenance.artifact.schema_contract).toContain('elevation_ft_msl');
  });

  test('fails closed rather than inventing missing snapshot freshness', () => {
    const provenance = JSON.parse(readFileSync(PROVENANCE_PATH, 'utf8')) as Provenance;

    expect(provenance.snapshot).toMatchObject({
      acquired_at: null,
      source_sha256: null,
      freshness: 'unknown',
    });
  });
});
