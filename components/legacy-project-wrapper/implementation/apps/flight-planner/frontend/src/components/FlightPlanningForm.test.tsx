import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import FlightPlanningForm from './FlightPlanningForm'

const airports = vi.hoisted(() => ({ data: [] as { icao: string; iata: string; name: string }[] }))
vi.mock('../hooks/useAirports', () => ({ useAirportSearch: () => airports }))
vi.mock('./ImportExportUI', () => ({ default: () => null }))
beforeEach(() => {
  airports.data = []
})

describe('VFR flight planning', () => {
  it('plans a route from airport inputs without instrument procedure controls or requests', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } }),
      )
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<FlightPlanningForm isLoading={false} onSubmit={onSubmit} />)

    await user.type(screen.getByRole('combobox', { name: 'Origin' }), 'KDWA')
    await user.type(screen.getByRole('combobox', { name: 'Destination' }), 'KPAO')
    expect(screen.queryByRole('combobox', { name: /procedure/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/procedure type/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plan Route' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'route',
        origin: 'KDWA',
        destination: 'KPAO',
      }),
    )
    expect(request.mock.calls.some(([url]) => String(url).includes('procedures'))).toBe(false)
    expect(screen.getByRole('link', { name: 'Charts for origin' })).toHaveAttribute(
      'href',
      '/charts?airport=KDWA',
    )
    expect(screen.getByRole('link', { name: 'Charts for destination' })).toHaveAttribute(
      'href',
      '/charts?airport=KPAO',
    )
    expect(screen.getByRole('link', { name: 'Charts for origin' })).toHaveAttribute(
      'target',
      '_blank',
    )
  })

  it('carries an IATA association only when the returned airport data identifies one ICAO', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))
    airports.data = [{ icao: 'KSFO', iata: 'SFO', name: 'San Francisco' }]
    const user = userEvent.setup()
    render(<FlightPlanningForm isLoading={false} onSubmit={vi.fn()} />)
    await user.type(screen.getByRole('combobox', { name: 'Origin' }), 'SFO')
    expect(screen.getByRole('link', { name: 'Charts for origin' })).toHaveAttribute(
      'href',
      '/charts?airport=KSFO',
    )
  })

  it('leaves an unresolved IATA code for explicit selection in the chart browser', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))
    const user = userEvent.setup()
    render(<FlightPlanningForm isLoading={false} onSubmit={vi.fn()} />)
    await user.type(screen.getByRole('combobox', { name: 'Origin' }), 'SFO')
    expect(screen.getByRole('link', { name: 'Charts for origin' })).toHaveAttribute(
      'href',
      '/charts',
    )
  })
})

it('uses an explicitly applied cruise fuel flow without enabling fuel-stop routing', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'))
  const onSubmit = vi.fn(),
    user = userEvent.setup()
  render(<FlightPlanningForm isLoading={false} onSubmit={onSubmit} />)
  const reference = {
    schema: 'aviation/performance-reference@1',
    dataset_id: 'perf_' + 'a'.repeat(64),
    content_sha256: 'b'.repeat(64),
    icao: 'SR22',
    variant: 'Synthetic source variant',
    configuration: 'Synthetic source configuration',
    registration: null,
    table_id: 'cruise',
    metric: 'cruise_fuel_flow_gph',
    units: 'US gal/h',
    value: 18.1,
    conditions: { weight_lb: 2900, rpm: 2500, pressure_altitude_ft: 6000, isa_deviation_c: 0 },
    source: {
      document_id: 'doc_' + 'c'.repeat(32),
      sha256: 'd'.repeat(64),
      revision: 'Synthetic source revision',
      pages: [173],
    },
    reviewer: 'Synthetic reviewer',
    reviewed_at: '2026-11-17T00:00:00Z',
    calculated_at: '2026-11-17T00:01:00Z',
    approved_for_flight: false,
    warnings: [],
    notes: [],
    limitations: 'Synthetic research reference',
  }
  const element = document.querySelector('aviation-performance-reference')!
  act(() => {
    fireEvent(
      element,
      new CustomEvent('performance-reference-apply', {
        detail: {
          reference,
          operator_fields: [
            'weight_lb',
            'rpm',
            'pressure_altitude_ft',
            'isa_deviation_c',
            'variant',
            'configuration',
          ],
        },
      }),
    )
  })
  expect(screen.getByLabelText('Fuel burn (gph)')).toHaveValue(18.1)
  expect(screen.getByLabelText('Use entered fuel burn for route estimate')).toBeChecked()
  expect(screen.getByLabelText('Add fuel stops')).not.toBeChecked()
  await user.type(screen.getByRole('combobox', { name: 'Origin' }), 'KDWA')
  await user.type(screen.getByRole('combobox', { name: 'Destination' }), 'KPAO')
  await user.click(screen.getByRole('button', { name: 'Plan Route' }))
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ fuel_burn_gph: 18.1, plan_fuel_stops: false }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Release reference associations; retain current inputs' }),
  )
  await user.click(screen.getByRole('button', { name: 'Plan Route' }))
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ fuel_burn_gph: 18.1, plan_fuel_stops: false }),
  )
})
