import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import FlightPlanningForm from './FlightPlanningForm'

vi.mock('../hooks/useAirports', () => ({ useAirportSearch: () => ({ data: [] }) }))
vi.mock('./ImportExportUI', () => ({ default: () => null }))

describe('VFR flight planning', () => {
  it('plans a route from airport inputs without instrument procedure controls or requests', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
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

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'route', origin: 'KDWA', destination: 'KPAO',
    }))
    expect(request.mock.calls.some(([url]) => String(url).includes('procedures'))).toBe(false)
  })
})
