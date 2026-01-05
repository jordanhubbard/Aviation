import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ModeSelector from './ModeSelector'

describe('ModeSelector', () => {
  it('calls onChange when toggling modes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<ModeSelector mode="route" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /local flight/i }))

    expect(onChange).toHaveBeenCalledWith('local')
  })
})
