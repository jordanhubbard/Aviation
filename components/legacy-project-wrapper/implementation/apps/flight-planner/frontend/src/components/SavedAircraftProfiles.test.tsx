import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavedAircraftProfiles from './SavedAircraftProfiles'
import { AIRCRAFT_STORAGE_KEY, saveAircraft } from '../services/aircraftProfiles'

const aircraft = { registration: 'N123AB', cruiseSpeedKt: 115, fuelBurnGph: 9, fuelOnBoardGal: 30 }
const defaults = { cruiseSpeedKt: 115, fuelBurnGph: 9, fuelOnBoardGal: 30, disabled: false }
beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  } })
  let queue = Promise.resolve()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: (_name: string, callback: () => unknown) => {
      const result = queue.then(callback); queue = result.then(() => undefined, () => undefined); return result
    },
  } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('saved aircraft controls', () => {
  it('saves explicitly, then reuses all three values after remount', async () => {
    const user = userEvent.setup(), onSelect = vi.fn()
    const view = render(<SavedAircraftProfiles {...defaults} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Save aircraft' }))
    await user.type(screen.getByLabelText('Aircraft registration'), 'n123ab')
    await user.click(screen.getByRole('button', { name: 'Save and use aircraft' }))
    expect(onSelect).toHaveBeenCalledWith(aircraft)
    view.unmount(); onSelect.mockClear()
    render(<SavedAircraftProfiles {...defaults} cruiseSpeedKt={80} onSelect={onSelect} />)
    expect(onSelect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('combobox', { name: 'Saved aircraft (this browser)' }))
    await user.click(await screen.findByRole('option', { name: 'N123AB' }))
    expect(onSelect).toHaveBeenCalledWith(aircraft)
  })
  it('keeps edits open when storage fails and does not apply unsaved values', async () => {
    const user = userEvent.setup(), onSelect = vi.fn()
    render(<SavedAircraftProfiles {...defaults} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Save aircraft' }))
    await user.type(screen.getByLabelText('Aircraft registration'), 'N123AB')
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await user.click(screen.getByRole('button', { name: 'Save and use aircraft' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save'))
    expect(screen.getByLabelText('Aircraft registration')).toHaveValue('N123AB')
    expect(onSelect).not.toHaveBeenCalled()
  })
  it('refreshes cross-window changes without silently changing the flight', async () => {
    const user = userEvent.setup(), onSelect = vi.fn()
    await saveAircraft(window.localStorage, aircraft, null)
    render(<SavedAircraftProfiles {...defaults} onSelect={onSelect} />)
    await user.click(screen.getByRole('combobox', { name: 'Saved aircraft (this browser)' }))
    await user.click(await screen.findByRole('option', { name: 'N123AB' }))
    await user.click(screen.getByRole('button', { name: 'Save aircraft' }))
    await saveAircraft(window.localStorage, { ...aircraft, fuelOnBoardGal: 12 }, aircraft)
    window.dispatchEvent(new window.StorageEvent('storage', { key: AIRCRAFT_STORAGE_KEY }))
    onSelect.mockClear()
    await user.click(screen.getByRole('button', { name: 'Save and use aircraft' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('changed in another window'))
    expect(onSelect).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Aircraft registration'))
    await user.type(screen.getByLabelText('Aircraft registration'), 'N987XY')
    expect(screen.getByRole('button', { name: 'Remove N123AB' })).toBeDisabled()
  })
})

it('protects the submitted draft while another tab owns the writer lock', async () => {
  let release: () => void = () => undefined
  const held = new Promise<void>(resolve => { release = resolve })
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name: string, callback: () => unknown) => { await held; return callback() },
  } })
  const user = userEvent.setup(), onSelect = vi.fn()
  render(<SavedAircraftProfiles {...defaults} onSelect={onSelect} />)
  await user.click(screen.getByRole('button', { name: 'Save aircraft' }))
  await user.type(screen.getByLabelText('Aircraft registration'), 'N123AB')
  await user.click(screen.getByRole('button', { name: 'Save and use aircraft' }))
  for (const label of ['Aircraft registration', 'Saved cruise speed (kt)', 'Saved fuel burn (US gal/h)', 'Saved fuel on board (US gal)']) {
    expect(screen.getByLabelText(label)).toBeDisabled()
  }
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(onSelect).not.toHaveBeenCalled()
  release()
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(aircraft))
})
