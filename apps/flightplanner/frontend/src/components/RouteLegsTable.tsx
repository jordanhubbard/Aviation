import React, { useMemo } from 'react'
import { Box, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'

import type { FlightPlan } from '../types'
import { formatUtcMinute, haversineNm } from '../utils'

type Props = {
  plan: FlightPlan
}

type LegRow = {
  id: number
  leg: number
  from: string
  to: string
  distance_nm: number
  groundspeed_kt?: number
  ete_minutes?: number
  depart_time_utc?: string | null
  arrive_time_utc?: string | null
  elapsed_minutes?: number
  refuel_minutes?: number
  fuel_stop?: boolean
  type?: string
  vfr_altitude?: number
}

const fmtMinutes = (mins?: number | null) => {
  if (mins == null || !Number.isFinite(mins)) return '—'
  const total = Math.max(0, Math.round(mins))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

const RouteLegsTable: React.FC<Props> = ({ plan }) => {
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  const hasWaypointLegs = Boolean(plan.legs && plan.legs.length)
  const points = useMemo(() => {
    if (!plan.segments || plan.segments.length === 0) {
      return [plan.origin_coords, plan.destination_coords]
    }

    const pts: Array<[number, number]> = [plan.segments[0].start]
    for (const seg of plan.segments) pts.push(seg.end)
    return pts
  }, [plan])

  const rows = useMemo<LegRow[]>(() => {
    if (hasWaypointLegs) {
      return (plan.legs || []).map((l, idx) => ({
        id: idx,
        leg: idx + 1,
        from: l.from_code,
        to: l.to_code,
        distance_nm: l.distance_nm,
        groundspeed_kt: l.groundspeed_kt,
        ete_minutes: l.ete_minutes,
        depart_time_utc: l.depart_time_utc,
        arrive_time_utc: l.arrive_time_utc,
        type: l.type || undefined,
        vfr_altitude: l.vfr_altitude ?? undefined,
        elapsed_minutes: l.elapsed_minutes,
        refuel_minutes: l.refuel_minutes,
        fuel_stop: l.fuel_stop,
      }))
    }

    const out: LegRow[] = []
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      const seg = plan.segments?.[i]

      out.push({
        id: i,
        leg: i + 1,
        from: `${a[0].toFixed(3)}, ${a[1].toFixed(3)}`,
        to: `${b[0].toFixed(3)}, ${b[1].toFixed(3)}`,
        distance_nm: Number(haversineNm(a, b).toFixed(1)),
        type: seg?.type || 'cruise',
        vfr_altitude: seg?.vfr_altitude ?? 0,
      })
    }
    return out
  }, [hasWaypointLegs, plan.legs, plan.segments, points])

  const columns = useMemo<GridColDef<LegRow>[]>(() => {
    if (hasWaypointLegs) {
      const hasAltType = Boolean(plan.legs?.some((l) => l.vfr_altitude != null || l.type != null))
      if (isSmall) {
        const base: GridColDef<LegRow>[] = [
          { field: 'leg', headerName: 'Leg', width: 70 },
          { field: 'to', headerName: 'To', width: 90 },
          {
            field: 'ete_minutes',
            headerName: 'ETE',
            width: 90,
            valueFormatter: (p) => fmtMinutes(p.value as number),
          },
          {
            field: 'elapsed_minutes',
            headerName: 'Elapsed',
            width: 110,
            valueFormatter: (p) => fmtMinutes(p.value as number),
          },
        ]

        if (!hasAltType) return base

        return [
          { field: 'leg', headerName: 'Leg', width: 70 },
          { field: 'to', headerName: 'To', width: 90 },
          { field: 'vfr_altitude', headerName: 'Alt', width: 90 },
          { field: 'type', headerName: 'Type', width: 100 },
        ]
      }

      const base: GridColDef<LegRow>[] = [
        { field: 'leg', headerName: 'Leg', width: 70 },
        { field: 'from', headerName: 'From', width: 100 },
        { field: 'to', headerName: 'To', width: 100 },
        {
          field: 'depart_time_utc',
          headerName: 'Depart (UTC)',
          width: 140,
          valueFormatter: (p) => formatUtcMinute(p.value as string),
        },
        {
          field: 'arrive_time_utc',
          headerName: 'Arrive (UTC)',
          width: 140,
          valueFormatter: (p) => formatUtcMinute(p.value as string),
        },
        { field: 'distance_nm', headerName: 'Distance (nm)', width: 130 },
        { field: 'groundspeed_kt', headerName: 'GS (kt)', width: 90 },
        {
          field: 'ete_minutes',
          headerName: 'ETE',
          width: 90,
          valueFormatter: (p) => fmtMinutes(p.value as number),
        },
        {
          field: 'refuel_minutes',
          headerName: 'Refuel',
          width: 90,
          valueFormatter: (p) => {
            const n = p.value as number
            if (!Number.isFinite(n) || n <= 0) return '—'
            return `+${Math.round(n)}m`
          },
        },
        {
          field: 'elapsed_minutes',
          headerName: 'Elapsed',
          width: 110,
          valueFormatter: (p) => fmtMinutes(p.value as number),
        },
      ]

      if (!hasAltType) return base
      return [
        { field: 'leg', headerName: 'Leg', width: 70 },
        { field: 'from', headerName: 'From', width: 100 },
        { field: 'to', headerName: 'To', width: 100 },
        {
          field: 'depart_time_utc',
          headerName: 'Depart (UTC)',
          width: 140,
          valueFormatter: (p) => formatUtcMinute(p.value as string),
        },
        {
          field: 'arrive_time_utc',
          headerName: 'Arrive (UTC)',
          width: 140,
          valueFormatter: (p) => formatUtcMinute(p.value as string),
        },
        { field: 'distance_nm', headerName: 'Distance (nm)', width: 130 },
        { field: 'vfr_altitude', headerName: 'Alt (ft)', width: 110 },
        { field: 'type', headerName: 'Type', width: 110 },
        {
          field: 'ete_minutes',
          headerName: 'ETE',
          width: 90,
          valueFormatter: (p) => fmtMinutes(p.value as number),
        },
        {
          field: 'refuel_minutes',
          headerName: 'Refuel',
          width: 90,
          valueFormatter: (p) => {
            const n = p.value as number
            if (!Number.isFinite(n) || n <= 0) return '—'
            return `+${Math.round(n)}m`
          },
        },
        {
          field: 'elapsed_minutes',
          headerName: 'Elapsed',
          width: 110,
          valueFormatter: (p) => fmtMinutes(p.value as number),
        },
      ]
    }

    if (isSmall) {
      return [
        { field: 'leg', headerName: 'Leg', width: 70 },
        { field: 'distance_nm', headerName: 'NM', width: 90 },
        { field: 'vfr_altitude', headerName: 'Alt', width: 90 },
        { field: 'type', headerName: 'Type', width: 100 },
      ]
    }

    return [
      { field: 'leg', headerName: 'Leg', width: 70 },
      { field: 'from', headerName: 'From (lat, lon)', flex: 1, minWidth: 160 },
      { field: 'to', headerName: 'To (lat, lon)', flex: 1, minWidth: 160 },
      { field: 'distance_nm', headerName: 'Distance (nm)', width: 130 },
      { field: 'vfr_altitude', headerName: 'Alt (ft)', width: 110 },
      { field: 'type', headerName: 'Type', width: 110 },
    ]
  }, [hasWaypointLegs, isSmall, plan.legs])

  const totalElapsed = useMemo(() => {
    if (!hasWaypointLegs) return null
    const last = rows[rows.length - 1]
    return last?.elapsed_minutes ?? null
  }, [hasWaypointLegs, rows])

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Legs
      </Typography>
      <DataGrid
        rows={rows}
        columns={columns}
        autoHeight
        density="compact"
        disableRowSelectionOnClick
        hideFooter
        getRowClassName={(p) => (p.row.fuel_stop ? 'fuel-stop-row' : '')}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '& .fuel-stop-row': {
            bgcolor: 'rgba(255, 193, 7, 0.15)',
          },
        }}
      />

      {totalElapsed != null ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Total elapsed: {fmtMinutes(totalElapsed)}
        </Typography>
      ) : null}
    </Box>
  )
}

export default React.memo(RouteLegsTable)
