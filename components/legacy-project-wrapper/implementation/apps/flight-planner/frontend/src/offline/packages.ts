/** Explicit, integrity-checked offline packages. No request credentials enter storage. */
export type Asset = {
  id: string
  label: string
  role: 'route' | 'airports' | 'weather' | 'chart_original' | 'chart_preview' | 'chart_tile'
  sha256: string
  byte_length: number
  media_type: string
  url: string | null
  inline_text: string | null
  source_url: string | null
  retrieved_at: string | null
  effective_from: string | null
  effective_until: string | null
  source_sha256: string | null
  chart_id: string | null
  page: number | null
  zoom: number | null
  x: number | null
  y: number | null
}
export type ChartPackage = {
  chart_id: string
  name: string
  cycle: string
  source_url: string
  source_checked_at: string | null
  verification_state: string
  freshness: string
  effective_from: string | null
  effective_until: string | null
  source_sha256: string
  coverage: string
  pages: number[] | null
  bounds_wgs84: number[] | null
  tile_bounds_wgs84: number[] | null
  zoom: number | null
  tile_count: number | null
  limitations: string | null
}
export type Manifest = {
  schema_version: 1
  id: string
  name: string
  created_at: string
  revision_of: string | null
  route: Record<string, unknown>
  assets: Asset[]
  charts: ChartPackage[]
  total_bytes: number
  warnings: string[]
  private_documents_included: false
}
export type StoredPackage = {
  id: string
  name: string
  created_at: string
  bytes: number
  storage_bytes: number
  manifest_text: string
  manifest_sha256: string
}
export const PACKAGE_LIMIT = 128 * 1024 ** 2
export const STORAGE_LIMIT = 512 * 1024 ** 2
const DB = 'aviation-offline-v1'
const hashPattern = /^[a-f0-9]{64}$/
const roles = ['route', 'airports', 'weather', 'chart_original', 'chart_preview', 'chart_tile']
const mediaTypes = ['application/json', 'application/pdf', 'image/tiff', 'image/png']
const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
const complete = (t: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onabort = t.onerror = () => reject(t.error ?? new Error('Offline storage transaction failed'))
  })
async function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error('This browser does not support offline storage')
  const opening = indexedDB.open(DB, 1)
  opening.onupgradeneeded = () => {
    opening.result.createObjectStore('packages', { keyPath: 'id' })
    opening.result.createObjectStore('assets', { keyPath: ['package_id', 'asset_id'] })
  }
  const db = await request(opening)
  db.onversionchange = () => db.close()
  return db
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new Error('Offline verification requires HTTPS or localhost')
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
export function validateManifest(input: unknown): Manifest {
  const m = input as Manifest
  if (
    !m ||
    m.schema_version !== 1 ||
    !/^offline_[a-f0-9]{32}$/.test(m.id) ||
    typeof m.name !== 'string' ||
    !m.name.trim() ||
    m.name.length > 100 ||
    !Number.isFinite(Date.parse(m.created_at)) ||
    m.private_documents_included !== false ||
    !Array.isArray(m.assets) ||
    m.assets.length < 3 ||
    m.assets.length > 647 ||
    !Array.isArray(m.charts) ||
    m.charts.length > 4 ||
    !Array.isArray(m.warnings)
  )
    throw new Error('Invalid offline manifest')
  const ids = new Set<string>()
  let total = 0
  for (const a of m.assets) {
    if (
      !a ||
      typeof a.id !== 'string' ||
      !/^asset_\d+$/.test(a.id) ||
      ids.has(a.id) ||
      typeof a.label !== 'string' ||
      !hashPattern.test(a.sha256) ||
      !roles.includes(a.role) ||
      !mediaTypes.includes(a.media_type) ||
      !Number.isSafeInteger(a.byte_length) ||
      a.byte_length < 0 ||
      a.byte_length > PACKAGE_LIMIT
    )
      throw new Error('Invalid offline asset')
    ids.add(a.id)
    total += a.byte_length
    if ((typeof a.inline_text === 'string') === (typeof a.url === 'string'))
      throw new Error('Offline assets require exactly one content source')
    if (typeof a.url === 'string') {
      const original =
        /^\/api\/charts\/[A-Za-z0-9_-]{1,100}\/members\/\d{1,2}\?sha256=([a-f0-9]{64})$/.exec(a.url)
      const derived = /^\/api\/offline\/assets\/([a-f0-9]{64})$/.exec(a.url)
      if (
        !(
          original &&
          a.role === 'chart_original' &&
          original[1] === a.sha256 &&
          a.source_sha256 === a.sha256
        ) &&
        !(
          derived &&
          ['chart_preview', 'chart_tile'].includes(a.role) &&
          derived[1] === a.sha256 &&
          hashPattern.test(a.source_sha256 ?? '')
        )
      )
        throw new Error('Offline download URL is not a permitted public asset')
    } else if (
      !['route', 'airports', 'weather'].includes(a.role) ||
      a.media_type !== 'application/json'
    )
      throw new Error('Private or unexpected inline asset')
  }
  if (
    !Number.isSafeInteger(m.total_bytes) ||
    m.total_bytes !== total ||
    total > PACKAGE_LIMIT ||
    !['route', 'airports', 'weather'].every(
      (role) => m.assets.filter((a) => a.role === role).length === 1,
    )
  )
    throw new Error('Offline package size or source snapshot mismatch')
  return m
}
async function writer<T>(work: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error('Offline packages require secure cross-window storage locks')
  return navigator.locks.request('aviation-offline-writer', work)
}
async function all(db: IDBDatabase): Promise<StoredPackage[]> {
  return request(db.transaction('packages').objectStore('packages').getAll())
}
export async function listPackages(): Promise<StoredPackage[]> {
  const db = await database()
  try {
    return (await all(db)).sort((a, b) => b.created_at.localeCompare(a.created_at))
  } finally {
    db.close()
  }
}
async function cleanup(db: IDBDatabase) {
  const keep = new Set((await all(db)).map((p) => p.id))
  const t = db.transaction('assets', 'readwrite'),
    done = complete(t)
  const cursor = t.objectStore('assets').openCursor()
  cursor.onsuccess = () => {
    const c = cursor.result
    if (c) {
      if (!keep.has(c.value.package_id)) c.delete()
      c.continue()
    }
  }
  await done
}
async function readBytes(
  response: Response,
  max: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (!response.ok || response.redirected || !response.body)
    throw new Error(`Offline asset unavailable (HTTP ${response.status})`)
  const declared = response.headers.get('Content-Length')
  if (declared && Number(declared) !== max) throw new Error('Offline asset length changed')
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > max) throw new Error('Offline asset exceeded declared size')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of chunks) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}
export async function installPackage(
  input: unknown,
  signal: AbortSignal,
  progress: (done: number, total: number, label: string) => void,
): Promise<void> {
  const manifest = validateManifest(input)
  const text = JSON.stringify(manifest),
    encoded = new TextEncoder().encode(text)
  const overhead = encoded.length + manifest.assets.length * 1024 + 16384
  const storageBytes = manifest.total_bytes + overhead
  await writer(async () => {
    const db = await database()
    try {
      await cleanup(db)
      const saved = await all(db)
      if (saved.some((p) => p.id === manifest.id))
        throw new Error('This immutable package is already installed')
      if (
        saved.length >= 32 ||
        saved.reduce((sum, p) => sum + p.storage_bytes, 0) + storageBytes > STORAGE_LIMIT
      )
        throw new Error('Offline package storage limit reached; delete a package first')
      const estimate = await navigator.storage?.estimate()
      if (
        estimate?.quota !== undefined &&
        estimate.usage !== undefined &&
        estimate.quota - estimate.usage < storageBytes + 1024 ** 2
      )
        throw new Error('Browser storage quota is insufficient')
      let bytesDone = 0
      for (const asset of manifest.assets) {
        signal.throwIfAborted()
        progress(bytesDone, manifest.total_bytes, asset.label)
        const bytes =
          asset.inline_text !== null
            ? new TextEncoder().encode(asset.inline_text)
            : await readBytes(
                await fetch(asset.url!, {
                  credentials: 'omit',
                  redirect: 'error',
                  cache: 'no-store',
                  signal,
                }),
                asset.byte_length,
                signal,
              )
        if (bytes.length !== asset.byte_length || (await sha256(bytes)) !== asset.sha256)
          throw new Error(`Integrity check failed: ${asset.label}`)
        signal.throwIfAborted()
        const t = db.transaction('assets', 'readwrite'),
          done = complete(t)
        t.objectStore('assets').put({
          package_id: manifest.id,
          asset_id: asset.id,
          blob: new Blob([new Uint8Array(bytes).buffer], { type: asset.media_type }),
        })
        await done
        bytesDone += bytes.length
      }
      signal.throwIfAborted()
      const manifestHash = await sha256(encoded)
      const t = db.transaction('packages', 'readwrite'),
        done = complete(t)
      t.objectStore('packages').add({
        id: manifest.id,
        name: manifest.name,
        created_at: manifest.created_at,
        bytes: manifest.total_bytes,
        storage_bytes: storageBytes,
        manifest_text: text,
        manifest_sha256: manifestHash,
      } satisfies StoredPackage)
      await done
      progress(bytesDone, manifest.total_bytes, 'Complete')
    } catch (error) {
      await cleanup(db).catch(() => undefined)
      throw error
    } finally {
      db.close()
    }
  })
}
export async function packageBlob(packageId: string, asset: Asset): Promise<Blob> {
  const db = await database()
  try {
    const row = await request(
      db.transaction('assets').objectStore('assets').get([packageId, asset.id]),
    )
    if (
      !row?.blob ||
      row.blob.size !== asset.byte_length ||
      (await sha256(new Uint8Array(await row.blob.arrayBuffer()))) !== asset.sha256
    )
      throw new Error(`Saved asset missing or corrupt: ${asset.label}`)
    return row.blob
  } finally {
    db.close()
  }
}
export async function openPackage(
  id: string,
  progress: (done: number, total: number, label: string) => void,
): Promise<Manifest> {
  const db = await database()
  let row: StoredPackage
  try {
    row = await request(db.transaction('packages').objectStore('packages').get(id))
  } finally {
    db.close()
  }
  if (!row || (await sha256(new TextEncoder().encode(row.manifest_text))) !== row.manifest_sha256)
    throw new Error('Saved package manifest missing or corrupt')
  const manifest = validateManifest(JSON.parse(row.manifest_text))
  if (manifest.id !== id) throw new Error('Saved package identity mismatch')
  let done = 0
  for (const asset of manifest.assets) {
    progress(done, manifest.total_bytes, `Verifying ${asset.label}`)
    await packageBlob(id, asset)
    done += asset.byte_length
  }
  progress(done, manifest.total_bytes, 'Verified')
  return manifest
}
export async function deletePackage(id: string): Promise<void> {
  await writer(async () => {
    const db = await database()
    try {
      const t = db.transaction('packages', 'readwrite'),
        done = complete(t)
      t.objectStore('packages').delete(id)
      await done
      await cleanup(db)
    } finally {
      db.close()
    }
  })
}
