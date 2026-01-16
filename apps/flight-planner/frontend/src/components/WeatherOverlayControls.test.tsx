import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import toast from 'react-hot-toast'

import WeatherOverlayControls, { type WeatherOverlays } from './WeatherOverlayControls'

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}))

const baseOverlays: WeatherOverlays = {
  clouds: { enabled: false, opacity: 0.6 },
  wind: { enabled: false, opacity: 0.7 },
  precipitation: { enabled: false, opacity: 0.7 },
  temperature: { enabled: false, opacity: 0.6 },
}

describe('WeatherOverlayControls', () => {
  it('blocks enabling overlays when api key is missing', async () => {
    const user = userEvent.setup()
    ;(window as unknown as { __ENV__?: unknown }).__ENV__ = {}

    const setOverlays = vi.fn()
    render(<WeatherOverlayControls overlays={baseOverlays} setOverlays={setOverlays} />)

    await user.click(screen.getByRole('checkbox', { name: 'Clouds' }))

    expect((toast as unknown as { error: unknown }).error).toHaveBeenCalled()
    expect(setOverlays).not.toHaveBeenCalled()
  })

  it('enables overlays when api key is available', async () => {
    const user = userEvent.setup()
    ;(window as unknown as { __ENV__?: unknown }).__ENV__ = { VITE_OPENWEATHERMAP_API_KEY: 'test' }

    const setOverlays = vi.fn()
    render(<WeatherOverlayControls overlays={baseOverlays} setOverlays={setOverlays} />)

    await user.click(screen.getByRole('checkbox', { name: 'Clouds' }))
    expect(setOverlays).toHaveBeenCalled()

    const next = setOverlays.mock.calls[0][0] as WeatherOverlays
    expect(next.clouds.enabled).toBe(true)
  })
})
