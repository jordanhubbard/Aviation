import React from 'react'
import { Alert, Box, Card, CardContent, Divider, Grid, Typography, Chip } from '@mui/material'

import { useForecast, useWeather } from '../hooks'

type AirportWeatherCardProps = {
  airport: string
}

const AirportWeatherCard: React.FC<AirportWeatherCardProps> = ({ airport }) => {
  const weather = useWeather(airport)
  const forecast = useForecast(airport, 3)

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {airport}
        </Typography>

        {weather.isLoading ? (
          <Typography variant="body2">Loading current weather…</Typography>
        ) : weather.isError ? (
          <Alert severity="warning">Unable to load current weather.</Alert>
        ) : weather.data ? (
          <Box>
            {weather.data.flight_category ? (
              <Box sx={{ mb: 1 }}>
                <Chip
                  size="small"
                  label={weather.data.flight_category}
                  color={
                    weather.data.flight_category === 'VFR'
                      ? 'success'
                      : weather.data.flight_category === 'MVFR'
                        ? 'warning'
                        : 'error'
                  }
                  variant="outlined"
                />
              </Box>
            ) : null}
            <Typography variant="body2">{weather.data.conditions}</Typography>
            <Typography variant="body2">Temp: {weather.data.temperature}°F</Typography>
            <Typography variant="body2">
              Wind: {weather.data.wind_speed} kt @ {weather.data.wind_direction}°
            </Typography>
            <Typography variant="body2">Visibility: {weather.data.visibility} sm</Typography>
            <Typography variant="body2">Ceiling: {weather.data.ceiling} ft</Typography>

            {weather.data.metar ? (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  METAR
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                >
                  {weather.data.metar}
                </Typography>
              </Box>
            ) : null}
          </Box>
        ) : null}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          3-day forecast
        </Typography>

        {forecast.isLoading ? (
          <Typography variant="body2">Loading forecast…</Typography>
        ) : forecast.isError ? (
          <Typography variant="body2" color="text.secondary">
            Forecast unavailable.
          </Typography>
        ) : forecast.data ? (
          <Box>
            {forecast.data.daily.slice(0, 3).map((d) => (
              <Box key={d.date} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {d.date}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  High {d.temp_max_f ?? '—'}°F / Low {d.temp_min_f ?? '—'}°F, Wind max{' '}
                  {d.wind_speed_max_kt ?? '—'} kt
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  )
}

type Props = {
  airports: string[]
}

const WeatherPanels: React.FC<Props> = ({ airports }) => {
  const unique = Array.from(new Set(airports.filter(Boolean).map((a) => a.toUpperCase()))).slice(
    0,
    4,
  )

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Weather
      </Typography>
      <Grid container spacing={2}>
        {unique.map((airport) => (
          <Grid key={airport} item xs={12} md={6}>
            <AirportWeatherCard airport={airport} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default React.memo(WeatherPanels)
