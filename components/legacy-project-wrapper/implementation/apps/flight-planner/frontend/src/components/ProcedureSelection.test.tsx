import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ProcedureSelection, { loadProcedures } from './ProcedureSelection'

describe('loadProcedures', () => {
  it('rejects a non-OK response before its error body reaches Autocomplete', async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(loadProcedures('KOAK', 'SID', request)).rejects.toThrow(
      'Procedures unavailable (HTTP 404)',
    )
  })

  it('rejects a successful response that is not a procedure list', async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ procedures: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(loadProcedures('KOAK', 'SID', request)).rejects.toThrow(
      'Procedures response is not a valid list',
    )
  })
})

describe('ProcedureSelection', () => {
  it('keeps the autocomplete usable when procedures are unavailable', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    )

    render(<ProcedureSelection airportCode="KOAK" />)

    await screen.findByText('Procedures are unavailable for this airport.')
    await user.click(screen.getByRole('combobox', { name: 'Procedure' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Procedure' })).toHaveFocus())
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
