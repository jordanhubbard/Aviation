import { describe, expect, it } from 'vitest'
import { validateManifest, type Manifest } from './packages'

function manifest(): Manifest {
  return {
    schema_version: 1,
    id: 'offline_' + 'a'.repeat(32),
    name: 'Bay route',
    created_at: '2026-11-16T20:00:00Z',
    revision_of: null,
    route: { airports: ['KSFO', 'KSQL'] },
    charts: [],
    total_bytes: 6,
    warnings: [],
    private_documents_included: false,
    assets: ['route', 'airports', 'weather'].map((role, i) => ({
      id: `asset_${i}`,
      label: role,
      role,
      sha256: 'a'.repeat(64),
      byte_length: 2,
      media_type: 'application/json',
      url: null,
      inline_text: '{}',
      source_url: null,
      retrieved_at: '2026-11-16T20:00:00Z',
      effective_from: null,
      effective_until: null,
      source_sha256: null,
      chart_id: null,
      page: null,
      zoom: null,
      x: null,
      y: null,
    })) as Manifest['assets'],
  }
}
describe('offline manifest admission boundary', () => {
  it('accepts only complete source snapshots with consistent sizes', () => {
    expect(validateManifest(manifest()).assets).toHaveLength(3)
    const wrongSize = manifest()
    wrongSize.total_bytes++
    expect(() => validateManifest(wrongSize)).toThrow('size')
    const duplicate = manifest()
    duplicate.assets[1].id = duplicate.assets[0].id
    expect(() => validateManifest(duplicate)).toThrow('asset')
    const missing = manifest()
    missing.assets[1].role = 'weather'
    expect(() => validateManifest(missing)).toThrow('snapshot')
  })
  for (const url of [
    '/api/aircraft-library/documents/private/original',
    'https://example.com/file',
    '//example.com/file',
    '/api/charts/chart/members/0?sha256=' + 'a'.repeat(64) + '&token=secret',
    '/api/offline/assets/' + 'b'.repeat(64),
  ]) {
    it(`rejects private, redirected, credential-bearing or mismatched download path: ${url}`, () => {
      const m = manifest()
      m.assets.push({
        ...m.assets[0],
        id: 'asset_3',
        role: 'chart_original',
        inline_text: null,
        url,
        source_sha256: 'a'.repeat(64),
      })
      m.total_bytes += 2
      expect(() => validateManifest(m)).toThrow('permitted public asset')
    })
  }
  it('requires pinned original identity and separate rendered identity', () => {
    const m = manifest()
    m.assets.push({
      ...m.assets[0],
      id: 'asset_3',
      role: 'chart_original',
      media_type: 'application/pdf',
      inline_text: null,
      url: '/api/charts/chart/members/0?sha256=' + 'a'.repeat(64),
      source_sha256: 'a'.repeat(64),
    })
    m.total_bytes += 2
    expect(validateManifest(m).assets).toHaveLength(4)
    const derived = {
      ...m.assets[3],
      id: 'asset_4',
      role: 'chart_preview' as const,
      media_type: 'image/png',
      url: '/api/offline/assets/' + 'b'.repeat(64),
      sha256: 'b'.repeat(64),
    }
    m.assets.push(derived)
    m.total_bytes += 2
    expect(validateManifest(m).assets[4].source_sha256).toBe('a'.repeat(64))
    m.assets[4].source_sha256 = null
    expect(() => validateManifest(m)).toThrow('permitted public asset')
  })
  it('rejects private exports, unsupported versions and unsafe sizes', () => {
    expect(() => validateManifest({ ...manifest(), private_documents_included: true })).toThrow(
      'manifest',
    )
    expect(() => validateManifest({ ...manifest(), schema_version: 2 })).toThrow('manifest')
    const m = manifest()
    m.assets[0].byte_length = Infinity
    expect(() => validateManifest(m)).toThrow('asset')
  })
})
