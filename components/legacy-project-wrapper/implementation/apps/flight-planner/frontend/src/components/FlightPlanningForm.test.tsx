import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
