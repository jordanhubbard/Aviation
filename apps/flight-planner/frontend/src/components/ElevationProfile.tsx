import React, { useMemo } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { LineChart } from '@mui/x-charts/LineChart'

import type { FlightPlan } from '../types'
import { useTerrainProfile } from '../hooks'
import { haversineNm } from '../utils'

type Props = {
  plan: FlightPlan
}

const ElevationProfile: React.FC<Props> = ({ plan }) => {
  const routePoints = useMemo(() => {
    if (!plan.segments || plan.segments.length === 0) {
      return [plan.origin_coords, plan.destination_coords]
    }

    const pts: Array<[number, number]> = [plan.segments[0].start]
    for (const seg of plan.segments) pts.push(seg.end)
    return pts
  }, [plan])

  const sampled = useMemo(() => {
    const max = 60
    if (routePoints.length <= max) return routePoints
    const step = Math.ceil(routePoints.length / max)
    return routePoints.filter((_p, idx) => idx % step === 0)
  }, [routePoints])

  const query = useTerrainProfile(sampled)

  const chartData = useMemo(() => {
    const points = query.data?.points
    if (!points || points.length < 2) return null

    const x: number[] = []
    const y: Array<number | null> = []

    let cum = 0
    x.push(0)
    y.push(points[0].elevation_ft)

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const cur = points[i]
      cum += haversineNm([prev.latitude, prev.longitude], [cur.latitude, cur.longitude])
      x.push(Number(cum.toFixed(2)))
      y.push(cur.elevation_ft)
    }

    return { x, y }
  }, [query.data])

  if (query.isLoading) {
    return <Typography variant="body2">Loading elevation profile…</Typography>
  }

  if (query.isError) {
    return <Alert severity="info">Elevation profile unavailable.</Alert>
  }

  if (!chartData) {
    return <Typography variant="body2">No elevation data available.</Typography>
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Elevation profile
      </Typography>
      <LineChart
        xAxis={[{ data: chartData.x, label: 'Distance (nm)' }]}
        series={[{ data: chartData.y, label: 'Elevation (ft)', showMark: false }]}
        height={220}
        margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
      />
    </Box>
  )
}

export default React.memo(ElevationProfile)
