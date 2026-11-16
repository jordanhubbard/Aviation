/** Browser-local planning preferences, not manufacturer/POH performance data. */
export type SavedAircraft = {
  registration: string
  cruiseSpeedKt: number
  fuelBurnGph: number
  fuelOnBoardGal: number
}
export const AIRCRAFT_STORAGE_KEY = 'aviation.flight-planner.aircraft.v1'
const MAX_AIRCRAFT = 64
export class AircraftProfileConflict extends Error {}

type AircraftStorage = Pick<Storage, 'getItem' | 'setItem'>
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
const amount = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

export function normalizeRegistration(value: string): string {
  const registration = value.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(registration)) {
    throw new Error('Enter a registration using up to 16 letters, numbers or hyphens.')
  }
  return registration
}
export function validateSavedAircraft(value: unknown): SavedAircraft {
  if (!object(value) || !exact(value, ['registration', 'cruiseSpeedKt', 'fuelBurnGph', 'fuelOnBoardGal']) ||
      typeof value.registration !== 'string' || normalizeRegistration(value.registration) !== value.registration ||
      !amount(value.cruiseSpeedKt, Number.MIN_VALUE, 1000) ||
      !amount(value.fuelBurnGph, Number.MIN_VALUE, 5000) || !amount(value.fuelOnBoardGal, 0, 50000)) {
    throw new Error('Enter valid cruise speed (kt), fuel burn (US gal/h) and fuel on board (US gal).')
  }
  return { registration: value.registration, cruiseSpeedKt: value.cruiseSpeedKt,
    fuelBurnGph: value.fuelBurnGph, fuelOnBoardGal: value.fuelOnBoardGal }
}
export function readSavedAircraft(storage: Pick<Storage, 'getItem'>): SavedAircraft[] {
  const raw = storage.getItem(AIRCRAFT_STORAGE_KEY)
  if (raw === null) return []
  if (raw.length > 65536) throw new Error('Saved aircraft data is too large.')
  const value: unknown = JSON.parse(raw)
  if (!object(value) || !exact(value, ['version', 'aircraft']) || value.version !== 1 ||
      !Array.isArray(value.aircraft) || value.aircraft.length > MAX_AIRCRAFT) {
    throw new Error('Saved aircraft data is unavailable.')
  }
  const aircraft = value.aircraft.map(validateSavedAircraft)
  if (new Set(aircraft.map(item => item.registration)).size !== aircraft.length) {
    throw new Error('Saved aircraft contains duplicate registrations.')
  }
  return aircraft
}
function saveAircraftUnlocked(storage: AircraftStorage, input: SavedAircraft, expected: SavedAircraft | null): SavedAircraft[] {
  const aircraft = validateSavedAircraft({ ...input, registration: normalizeRegistration(input.registration) })
  // Fresh read prevents a stale form from discarding other saved registrations.
  const current = readSavedAircraft(storage)
  const prior = current.find(item => item.registration === aircraft.registration)
  if (expected === null && prior) throw new AircraftProfileConflict('This registration is already saved. Select it before editing.')
  if (expected !== null && (!prior || JSON.stringify(prior) !== JSON.stringify(validateSavedAircraft(expected)))) {
    throw new AircraftProfileConflict('This aircraft changed in another window. Reopen the saved aircraft before saving.')
  }
  const next = current.filter(item => item.registration !== aircraft.registration).concat(aircraft)
    .sort((a, b) => a.registration.localeCompare(b.registration))
  if (next.length > MAX_AIRCRAFT) throw new AircraftProfileConflict('Up to 64 aircraft can be saved in this browser.')
  storage.setItem(AIRCRAFT_STORAGE_KEY, JSON.stringify({ version: 1, aircraft: next }))
  return next
}
function removeAircraftUnlocked(storage: AircraftStorage, expected: SavedAircraft): SavedAircraft[] {
  const current = readSavedAircraft(storage), prior = current.find(item => item.registration === expected.registration)
  if (!prior || JSON.stringify(prior) !== JSON.stringify(validateSavedAircraft(expected))) {
    throw new AircraftProfileConflict('This aircraft changed in another window. Reopen it before removing.')
  }
  const next = current.filter(item => item.registration !== expected.registration)
  storage.setItem(AIRCRAFT_STORAGE_KEY, JSON.stringify({ version: 1, aircraft: next }))
  return next
}

export type AircraftWriterLock = { request: <T>(name: string, callback: () => T | Promise<T>) => Promise<T> }
const LOCK_NAME = 'aviation.flight-planner.aircraft.writer.v1'
export function aircraftWriterAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function'
}
function withWriter<T>(operation: () => T, locks?: AircraftWriterLock): Promise<T> {
  const writer = locks ?? (typeof navigator === 'undefined' ? undefined : navigator.locks)
  if (!writer) return Promise.reject(new AircraftProfileConflict('Saving aircraft requires a browser with secure cross-window storage support. Flight inputs remain available.'))
  return writer.request(LOCK_NAME, operation)
}
export function saveAircraft(storage: AircraftStorage, input: SavedAircraft, expected: SavedAircraft | null, locks?: AircraftWriterLock): Promise<SavedAircraft[]> {
  return withWriter(() => saveAircraftUnlocked(storage, input, expected), locks)
}
export function removeAircraft(storage: AircraftStorage, expected: SavedAircraft, locks?: AircraftWriterLock): Promise<SavedAircraft[]> {
  return withWriter(() => removeAircraftUnlocked(storage, expected), locks)
}
