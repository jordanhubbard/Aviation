import React, { useMemo } from 'react'
import { Box, Chip, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  AcUnit,
  BlurOn,
  Cloud,
  Grain,
  Thunderstorm,
  VisibilityOff,
  WbSunny,
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQueries } from 'react-query'

import { weatherService } from '../services'
import type { FlightCategory, FlightPlan, WeatherData } from '../types'

type Props = {
  plan: FlightPlan
}

type Row = {
  id: string
  leg: number
  from: string
  waypoint: string
  category: FlightCategory
  conditions: string
  wind: string
  vis: string
  ceiling: string
}

const toCategory = (value: string | null | undefined): FlightCategory => {
  if (value === 'VFR' || value === 'MVFR' || value === 'IFR' || value === 'LIFR') return value
  return 'UNKNOWN'
}

const categoryChipColor = (
  cat: FlightCategory,
): 'default' | 'success' | 'warning' | 'error' | 'secondary' => {
  if (cat === 'VFR') return 'success'
  if (cat === 'MVFR') return 'warning'
  if (cat === 'LIFR') return 'secondary'
  if (cat === 'IFR') return 'error'
  return 'default'
}

const WeatherIcon: React.FC<{ conditions: string; category: FlightCategory }> = ({
  conditions,
  category,
}) => {
  const c = (conditions || '').toLowerCase()

  if (c.includes('thunder')) return <Thunderstorm fontSize="small" />
  if (c.includes('snow') || c.includes('blizzard')) return <AcUnit fontSize="small" />
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower'))
    return <Grain fontSize="small" />
  if (c.includes('fog')) return <VisibilityOff fontSize="small" />
  if (c.includes('mist') || c.includes('haze') || c.includes('smoke'))
    return <BlurOn fontSize="small" />
  if (c.includes('cloud') || c.includes('overcast')) return <Cloud fontSize="small" />
  if (category === 'IFR' || category === 'LIFR') return <VisibilityOff fontSize="small" />
  return <WbSunny fontSize="small" />
}

const fmtWind = (w?: WeatherData | null) => {
  if (!w) return '—'
  const spd = w.wind_speed
  const dir = w.wind_direction
  if (spd == null || dir == null) return '—'
  const dir3 = String(Math.round(dir)).padStart(3, '0')
  return `${dir3}° @ ${Math.round(spd)} kt`
}

const fmtVis = (w?: WeatherData | null) => {
  if (!w || w.visibility == null) return '—'
  return `${w.visibility} sm`
}

const fmtCeiling = (w?: WeatherData | null) => {
  if (!w || w.ceiling == null) return '—'
  return `${Math.round(w.ceiling)} ft`
}

const RouteWaypointWeatherTable: React.FC<Props> = ({ plan }) => {
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  const waypoints = useMemo(
    () =>
      plan.route
        .filter(Boolean)
        .map((w) => w.toUpperCase())
        .slice(0, 20),
    [plan.route],
  )

  const weatherQueries = useQueries(
    waypoints.map((code) => ({
      queryKey: ['weather', code, 'summary'],
      queryFn: () => weatherService.getWeather(code, { suppressToast: true }),
      enabled: Boolean(code),
      staleTime: 5 * 60 * 1000,
      retry: 0,
    })),
  ) as Array<{ data?: WeatherData; isLoading: boolean; isError: boolean }>

  const weatherByCode = useMemo(() => {
    const m = new Map<string, WeatherData | null>()
    for (let i = 0; i < waypoints.length; i++) {
      const code = waypoints[i]
      const data = weatherQueries[i]?.data
      m.set(code, data ?? null)
    }
    return m
  }, [weatherQueries, waypoints])

  const rows = useMemo<Row[]>(() => {
    return waypoints.map((wp, idx) => {
      const w = weatherByCode.get(wp)
      const cat = toCategory(w?.flight_category ?? null)

      return {
        id: `${idx}-${wp}`,
        leg: idx,
        from: idx > 0 ? waypoints[idx - 1] : '—',
        waypoint: wp,
        category: cat,
        conditions: w?.conditions || (weatherQueries[idx]?.isLoading ? 'Loading…' : 'Unavailable'),
        wind: fmtWind(w),
        vis: fmtVis(w),
        ceiling: fmtCeiling(w),
      }
    })
  }, [waypoints, weatherByCode, weatherQueries])

  const columns = useMemo<GridColDef<Row>[]>(() => {
    const wxCol: GridColDef<Row> = {
      field: 'conditions',
      headerName: 'Weather',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              color: 'text.secondary',
              flex: '0 0 auto',
            }}
          >
            <WeatherIcon conditions={params.row.conditions} category={params.row.category} />
          </Box>
          <Box
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {params.row.conditions}
          </Box>
        </Box>
      ),
    }

    const catCol: GridColDef<Row> = {
      field: 'category',
      headerName: 'Flight rules',
      width: 130,
      renderCell: (params) => (
        <Chip
          size="small"
          variant="outlined"
          color={categoryChipColor(params.row.category)}
          label={params.row.category}
        />
      ),
    }

    if (isSmall) {
      return [
        { field: 'leg', headerName: '#', width: 60 },
        { field: 'waypoint', headerName: 'WP', width: 90 },
        catCol,
        { field: 'wind', headerName: 'Wind', width: 130 },
      ]
    }

    return [
      { field: 'leg', headerName: 'Leg', width: 80 },
      { field: 'from', headerName: 'From', width: 100 },
      { field: 'waypoint', headerName: 'To', width: 100 },
      catCol,
      wxCol,
      { field: 'wind', headerName: 'Wind', width: 140 },
      { field: 'vis', headerName: 'Vis', width: 110 },
      { field: 'ceiling', headerName: 'Ceiling', width: 120 },
    ]
  }, [isSmall])

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Waypoint weather (VFR/MVFR/IFR/LIFR)
      </Typography>
      <DataGrid
        rows={rows}
        columns={columns}
        autoHeight
        density="compact"
        disableRowSelectionOnClick
        hideFooter
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
      />
    </Box>
  )
}

export default React.memo(RouteWaypointWeatherTable)
