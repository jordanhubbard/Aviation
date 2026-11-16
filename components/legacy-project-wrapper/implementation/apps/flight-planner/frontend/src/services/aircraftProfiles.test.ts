import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIRCRAFT_STORAGE_KEY, AircraftProfileConflict, readSavedAircraft, removeAircraft, saveAircraft, type SavedAircraft } from './aircraftProfiles'

beforeEach(() => {
  let queue = Promise.resolve()
  vi.stubGlobal('navigator', { locks: { request: (_name: string, callback: () => unknown) => {
    const result = queue.then(callback); queue = result.then(() => undefined, () => undefined); return result
  } } })
})

const cessna: SavedAircraft = { registration: 'N123AB', cruiseSpeedKt: 110, fuelBurnGph: 8.5, fuelOnBoardGal: 32 }
function store() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

describe('browser-local aircraft records', () => {
  it('normalizes registrations and preserves other records on a fresh read', async () => {
    const storage = store()
    await saveAircraft(storage, { ...cessna, registration: ' n123ab ' }, null)
    await saveAircraft(storage, { ...cessna, registration: 'G-TEST' }, null)
    await saveAircraft(storage, { ...cessna, fuelOnBoardGal: 20 }, cessna)
    expect(readSavedAircraft(storage)).toEqual([{ ...cessna, registration: 'G-TEST' }, { ...cessna, fuelOnBoardGal: 20 }])
  })
  it('rejects duplicate saves and stale edits/deletes while keeping the latest record', async () => {
    const storage = store()
    await saveAircraft(storage, cessna, null)
    await expect(saveAircraft(storage, cessna, null)).rejects.toThrow(AircraftProfileConflict)
    const updated = { ...cessna, fuelOnBoardGal: 18 }
    await saveAircraft(storage, updated, cessna)
    await expect(saveAircraft(storage, cessna, cessna)).rejects.toThrow(AircraftProfileConflict)
    await expect(removeAircraft(storage, cessna)).rejects.toThrow(AircraftProfileConflict)
    expect(readSavedAircraft(storage)).toEqual([updated])
    expect(await removeAircraft(storage, updated)).toEqual([])
  })
  it.each(['broken JSON', JSON.stringify({ version: 2, aircraft: [] }), JSON.stringify({ version: 1, aircraft: [cessna, cessna] })])('preserves unreadable data rather than replacing it', async raw => {
    const storage = store()
    storage.setItem(AIRCRAFT_STORAGE_KEY, raw)
    await expect(saveAircraft(storage, cessna, null)).rejects.toThrow()
    expect(storage.getItem(AIRCRAFT_STORAGE_KEY)).toBe(raw)
  })
  it.each([0, -1, NaN, Infinity, 1001])('rejects invalid cruise speed %s without a write', async speed => {
    const storage = store()
    await expect(saveAircraft(storage, { ...cessna, cruiseSpeedKt: speed }, null)).rejects.toThrow()
    expect(storage.getItem(AIRCRAFT_STORAGE_KEY)).toBeNull()
  })
  it('surfaces a failed write and retains the previous saved values', async () => {
    const storage = store()
    await saveAircraft(storage, cessna, null)
    const failed = { ...storage, setItem: () => { throw new Error('quota') } }
    await expect(saveAircraft(failed, { ...cessna, fuelOnBoardGal: 10 }, cessna)).rejects.toThrow('quota')
    expect(readSavedAircraft(storage)).toEqual([cessna])
  })
})

it('serializes overlapping saves and rejects a stale save after deletion', async () => {
  const storage = store()
  await Promise.all([
    saveAircraft(storage, cessna, null),
    saveAircraft(storage, { ...cessna, registration: 'G-TEST' }, null),
  ])
  expect(readSavedAircraft(storage)).toHaveLength(2)
  const outcomes = await Promise.allSettled([
    removeAircraft(storage, cessna),
    saveAircraft(storage, { ...cessna, fuelOnBoardGal: 19 }, cessna),
  ])
  expect(outcomes.map(result => result.status)).toEqual(['fulfilled', 'rejected'])
  expect(readSavedAircraft(storage).map(item => item.registration)).toEqual(['G-TEST'])
})

it('does not write when cross-window locking is unavailable', async () => {
  vi.stubGlobal('navigator', {})
  const storage = store()
  await expect(saveAircraft(storage, cessna, null)).rejects.toThrow('secure cross-window storage support')
  expect(storage.getItem(AIRCRAFT_STORAGE_KEY)).toBeNull()
})
