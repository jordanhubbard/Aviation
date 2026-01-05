import React, { useMemo, useState } from 'react'
import {
  Autocomplete,
  Checkbox,
  FormControlLabel,
  Grid,
  Slider,
  TextField,
  Typography,
} from '@mui/material'
import toast from 'react-hot-toast'

import { useAirportSearch } from '../hooks/useAirports'
import { validateAirportCode } from '../utils'
import type { Airport, FlightPlanRequest, LocalPlanRequest, RoutePlanRequest } from '../types'
import { FormSection } from './shared'
import ModeSelector, { type PlanMode } from './ModeSelector'

type Props = {
  isLoading: boolean
  onSubmit: (req: FlightPlanRequest) => void
}

const optionLabel = (a: Airport) => {
  const code = a.icao || a.iata
  if (a.name) return `${code} — ${a.name}`
  return code
}

const FlightPlanningForm: React.FC<Props> = ({ isLoading, onSubmit }) => {
  const [mode, setMode] = useState<PlanMode>('route')

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [airport, setAirport] = useState('')

  const [speed, setSpeed] = useState<number>(110)
  const [altitude, setAltitude] = useState<number>(5500)
  const [radiusNm, setRadiusNm] = useState<number>(25)

  const [avoidAirspaces, setAvoidAirspaces] = useState(false)
  const [avoidTerrain, setAvoidTerrain] = useState(false)
  const [applyWind, setApplyWind] = useState(true)

  const [planFuelStops, setPlanFuelStops] = useState(false)
  const [fuelBurnGph, setFuelBurnGph] = useState<number>(8.5)
  const [fuelOnBoardGal, setFuelOnBoardGal] = useState<number>(40)
  const [reserveMinutes, setReserveMinutes] = useState<number>(45)

  const [forecastDays, setForecastDays] = useState<number>(3)

  const originSearch = useAirportSearch(origin)
  const destinationSearch = useAirportSearch(destination)
  const airportSearch = useAirportSearch(airport)

  const originOptions = useMemo(() => originSearch.data || [], [originSearch.data])
  const destinationOptions = useMemo(() => destinationSearch.data || [], [destinationSearch.data])
  const airportOptions = useMemo(() => airportSearch.data || [], [airportSearch.data])

  const submit = () => {
    if (mode === 'route') {
      const originValidation = validateAirportCode(origin)
      const destinationValidation = validateAirportCode(destination)

      if (!originValidation.valid) {
        toast.error(originValidation.error || 'Invalid origin airport')
        return
      }
      if (!destinationValidation.valid) {
        toast.error(destinationValidation.error || 'Invalid destination airport')
        return
      }
      if (!Number.isFinite(speed) || speed <= 0) {
        toast.error('Speed must be greater than 0')
        return
      }

      const originCode = originValidation.normalized as string
      const destinationCode = destinationValidation.normalized as string

      const req: RoutePlanRequest = {
        mode: 'route',
        origin: originCode,
        destination: destinationCode,
        speed,
        speed_unit: 'knots',
        altitude,
        avoid_airspaces: avoidAirspaces,
        avoid_terrain: avoidTerrain,
        apply_wind: applyWind,
        include_alternates: true,
        plan_fuel_stops: planFuelStops,
        fuel_burn_gph: planFuelStops ? fuelBurnGph : undefined,
        fuel_on_board_gal: planFuelStops ? fuelOnBoardGal : undefined,
        reserve_minutes: planFuelStops ? reserveMinutes : undefined,
      }
      onSubmit(req)
      return
    }

    const airportValidation = validateAirportCode(airport)
    if (!airportValidation.valid) {
      toast.error(airportValidation.error || 'Invalid airport')
      return
    }

    const airportCode = airportValidation.normalized as string

    const req: LocalPlanRequest = {
      mode: 'local',
      airport: airportCode,
      radius_nm: radiusNm,
    }
    onSubmit(req)
  }

  return (
    <FormSection
      title="Planning"
      onSubmit={submit}
      buttonText={mode === 'route' ? 'Plan Route' : 'Plan Local Flight'}
      isLoading={isLoading}
    >
      <Grid item xs={12}>
        <ModeSelector mode={mode} onChange={setMode} disabled={isLoading} />
      </Grid>

      {mode === 'route' ? (
        <>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              options={originOptions}
              inputValue={origin}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : optionLabel(opt))}
              onInputChange={(_e, v) => setOrigin(v.toUpperCase())}
              onChange={(_e, v) => {
                if (typeof v === 'string') setOrigin(v.toUpperCase())
                else if (v) setOrigin((v.icao || v.iata).toUpperCase())
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Origin"
                  placeholder="KPAO"
                  disabled={isLoading}
                  helperText="Enter ICAO/IATA code or search"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              options={destinationOptions}
              inputValue={destination}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : optionLabel(opt))}
              onInputChange={(_e, v) => setDestination(v.toUpperCase())}
              onChange={(_e, v) => {
                if (typeof v === 'string') setDestination(v.toUpperCase())
                else if (v) setDestination((v.icao || v.iata).toUpperCase())
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Destination"
                  placeholder="KSQL"
                  disabled={isLoading}
                  helperText="Enter ICAO/IATA code or search"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Cruise Speed (kt)"
              type="number"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={isLoading}
              inputProps={{ min: 1 }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Cruise Altitude (ft)"
              type="number"
              value={altitude}
              onChange={(e) => setAltitude(Number(e.target.value))}
              disabled={isLoading}
              inputProps={{ min: 0, step: 500 }}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={avoidAirspaces}
                  onChange={(e) => setAvoidAirspaces(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label="Avoid airspace"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={avoidTerrain}
                  onChange={(e) => setAvoidTerrain(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label="Avoid terrain"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={applyWind}
                  onChange={(e) => setApplyWind(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label="Apply wind to groundspeed/time"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={planFuelStops}
                  onChange={(e) => setPlanFuelStops(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label="Add fuel stops"
            />
          </Grid>

          {planFuelStops ? (
            <>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Fuel burn (gph)"
                  type="number"
                  value={fuelBurnGph}
                  onChange={(e) => setFuelBurnGph(Number(e.target.value))}
                  disabled={isLoading}
                  inputProps={{ min: 0.1, step: 0.1 }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Fuel on board at takeoff (gal)"
                  type="number"
                  value={fuelOnBoardGal}
                  onChange={(e) => setFuelOnBoardGal(Number(e.target.value))}
                  disabled={isLoading}
                  inputProps={{ min: 0.1, step: 0.1 }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Reserve (minutes)"
                  type="number"
                  value={reserveMinutes}
                  onChange={(e) => setReserveMinutes(Number(e.target.value))}
                  disabled={isLoading}
                  inputProps={{ min: 0, step: 5 }}
                />
              </Grid>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              options={airportOptions}
              inputValue={airport}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : optionLabel(opt))}
              onInputChange={(_e, v) => setAirport(v.toUpperCase())}
              onChange={(_e, v) => {
                if (typeof v === 'string') setAirport(v.toUpperCase())
                else if (v) setAirport((v.icao || v.iata).toUpperCase())
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Airport"
                  placeholder="KPAO"
                  disabled={isLoading}
                  helperText="Enter ICAO/IATA code or search"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Radius (NM)"
              type="number"
              value={radiusNm}
              onChange={(e) => setRadiusNm(Number(e.target.value))}
              disabled={isLoading}
              inputProps={{ min: 1 }}
            />
          </Grid>
        </>
      )}

      <Grid item xs={12}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Forecast days: {forecastDays}
        </Typography>
        <Slider
          value={forecastDays}
          min={1}
          max={7}
          step={1}
          marks
          onChange={(_e, v) => setForecastDays(v as number)}
          disabled={isLoading}
          aria-label="Forecast days"
        />
      </Grid>
    </FormSection>
  )
}

export default React.memo(FlightPlanningForm)
