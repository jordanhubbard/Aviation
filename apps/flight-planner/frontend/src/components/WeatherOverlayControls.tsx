import React from 'react'
import { Box, FormControlLabel, FormGroup, Slider, Switch, Typography } from '@mui/material'
import toast from 'react-hot-toast'

import { getRuntimeEnv } from '../utils'

export type WeatherOverlayKey = 'clouds' | 'wind' | 'precipitation' | 'temperature'

export type WeatherOverlayConfig = {
  enabled: boolean
  opacity: number
}

export type WeatherOverlays = Record<WeatherOverlayKey, WeatherOverlayConfig>

type Props = {
  overlays: WeatherOverlays
  setOverlays: (next: WeatherOverlays) => void
  disabled?: boolean
}

const LABELS: Record<WeatherOverlayKey, string> = {
  clouds: 'Clouds',
  wind: 'Wind',
  precipitation: 'Precipitation',
  temperature: 'Temperature',
}

const WeatherOverlayControls: React.FC<Props> = ({ overlays, setOverlays, disabled }) => {
  const apiKey = getRuntimeEnv('VITE_OPENWEATHERMAP_API_KEY')
  const apiKeyAvailable = Boolean(apiKey)

  const toggle = (key: WeatherOverlayKey) => {
    // Wind barbs can be sourced from our backend without an OpenWeatherMap key.
    // The raster tile overlays (clouds/precip/temp + wind tiles) require OWM.
    if (!apiKeyAvailable && key !== 'wind' && !overlays[key].enabled) {
      toast.error('Set VITE_OPENWEATHERMAP_API_KEY to enable weather tile overlays')
      return
    }
    setOverlays({
      ...overlays,
      [key]: { ...overlays[key], enabled: !overlays[key].enabled },
    })
  }

  const setOpacity = (key: WeatherOverlayKey, opacity: number) => {
    setOverlays({
      ...overlays,
      [key]: { ...overlays[key], opacity },
    })
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Weather overlays
      </Typography>

      {!apiKeyAvailable && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Weather tile overlays require <code>VITE_OPENWEATHERMAP_API_KEY</code> (wind barbs do
          not).
        </Typography>
      )}

      <FormGroup>
        {(Object.keys(overlays) as WeatherOverlayKey[]).map((key) => (
          <Box key={key} sx={{ mb: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={overlays[key].enabled}
                  onChange={() => toggle(key)}
                  disabled={disabled}
                />
              }
              label={LABELS[key]}
            />

            <Box sx={{ pl: 4, pr: 2, opacity: overlays[key].enabled ? 1 : 0.5 }}>
              <Slider
                value={overlays[key].opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(_e, v) => setOpacity(key, v as number)}
                disabled={disabled || !overlays[key].enabled}
                aria-label={`${LABELS[key]} opacity`}
              />
            </Box>
          </Box>
        ))}
      </FormGroup>
    </Box>
  )
}

export default React.memo(WeatherOverlayControls)
