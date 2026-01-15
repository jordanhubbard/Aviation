import React, { useState } from 'react'
import {
  Grid,
  Card,
  CardContent,
  Box,
  Chip,
  Divider,
  Typography,
  Alert,
  Button,
  Paper,
  LinearProgress,
} from '@mui/material'
import { Flight, Schedule, Speed } from '@mui/icons-material'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingState, ResultsSection } from '../components/shared'
import FlightPlanningForm from '../components/FlightPlanningForm'
import RouteMap from '../components/RouteMap'
import LocalMap from '../components/LocalMap'
import RouteLegsTable from '../components/RouteLegsTable'
import ElevationProfile from '../components/ElevationProfile'
import WeatherPanels from '../components/WeatherPanels'
import AlternateAirports from '../components/AlternateAirports'
import RouteWaypointWeatherTable from '../components/RouteWaypointWeatherTable'
import WeatherOverlayControls, { type WeatherOverlays } from '../components/WeatherOverlayControls'
import { useApiMutation } from '../hooks'
import { flightPlannerService } from '../services'
import { formatUtcMinute } from '../utils'
import type {
  FlightPlan,
  FlightPlanRequest,
  LocalPlanRequest,
  LocalPlanResponse,
  RoutePlanRequest,
} from '../types'

const FlightPlannerPage: React.FC = () => {
  const [lastMode, setLastMode] = useState<'local' | 'route'>('route')
  const [lastRequest, setLastRequest] = useState<FlightPlanRequest | null>(null)
  const [overlays, setOverlays] = useState<WeatherOverlays>({
    clouds: { enabled: false, opacity: 0.6 },
    wind: { enabled: false, opacity: 0.7 },
    precipitation: { enabled: false, opacity: 0.7 },
    temperature: { enabled: false, opacity: 0.6 },
  })

  const [routePlan, setRoutePlan] = useState<FlightPlan | null>(null)
  const [partialRoutePlan, setPartialRoutePlan] = useState<FlightPlan | null>(null)
  const [routeStreamProgress, setRouteStreamProgress] = useState<
    Array<{ phase?: string | null; message?: string | null; percent?: number | null }>
  >([])
  const [routeStreamError, setRouteStreamError] = useState<Error | null>(null)
  const [routeStreamMessage, setRouteStreamMessage] = useState<string | null>(null)
  const [routeStreamPercent, setRouteStreamPercent] = useState<number | null>(null)
  const [routeAbortController, setRouteAbortController] = useState<AbortController | null>(null)
  const [isRouteStreaming, setIsRouteStreaming] = useState(false)

  const localPlanMutation = useApiMutation<LocalPlanResponse, LocalPlanRequest>(
    (data) => flightPlannerService.plan<LocalPlanResponse>(data),
    {
      successMessage: 'Local plan generated successfully!',
    },
  )

  const isLoading = isRouteStreaming || localPlanMutation.isLoading
  const error = routeStreamError || localPlanMutation.error

  const cancelRoutePlanning = () => {
    routeAbortController?.abort()
    setIsRouteStreaming(false)
  }

  const startRoutePlanningStream = async (req: RoutePlanRequest) => {
    routeAbortController?.abort()

    const controller = new AbortController()
    setRouteAbortController(controller)
    setRouteStreamError(null)
    setRouteStreamProgress([])
    setRouteStreamMessage('Starting...')
    setRouteStreamPercent(null)
    setPartialRoutePlan(null)
    setRoutePlan(null)
    setIsRouteStreaming(true)

    try {
      await flightPlannerService.planStream<FlightPlan>(
        req,
        {
          onProgress: (ev) => {
            setRouteStreamProgress((prev) => {
              const next = [...prev, ev]
              return next.length > 100 ? next.slice(-100) : next
            })
            if (ev.message) setRouteStreamMessage(ev.message)
            if (typeof ev.percent === 'number') setRouteStreamPercent(ev.percent)
          },
          onPartialPlan: (plan) => {
            setPartialRoutePlan(plan)
          },
          onDone: (plan) => {
            setRoutePlan(plan)
            setPartialRoutePlan(null)
            setIsRouteStreaming(false)
            toast.success('Route planned successfully!')
          },
          onError: (ev) => {
            setIsRouteStreaming(false)
            setRouteStreamError(new Error(ev.detail || `Request failed (${ev.status_code || 500})`))
          },
        },
        controller.signal,
      )
    } catch (e) {
      setIsRouteStreaming(false)
      if (e instanceof DOMException && e.name === 'AbortError') {
        return
      }
      setRouteStreamError(e instanceof Error ? e : new Error('Request failed'))
    }
  }

  const planFlight = (req: FlightPlanRequest) => {
    setLastRequest(req)
    setLastMode(req.mode)
    if (req.mode === 'route') {
      void startRoutePlanningStream(req)
      return
    }

    localPlanMutation.mutate(req)
  }

  const localPlan = localPlanMutation.data
  const displayedRoutePlan = routePlan || partialRoutePlan

  return (
    <Box>
      <PageHeader icon={<Flight />} title="VFR Flight Planner" />

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <FlightPlanningForm isLoading={isLoading} onSubmit={planFlight} />
        </Grid>

        <Grid item xs={12} md={8}>
          {error ? (
            <Paper sx={{ p: 3 }} role="alert">
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    disabled={!lastRequest}
                    onClick={() => lastRequest && planFlight(lastRequest)}
                  >
                    Retry
                  </Button>
                }
              >
                {error.message || 'Request failed. Please try again.'}
              </Alert>
            </Paper>
          ) : lastMode === 'route' && displayedRoutePlan ? (
            <ResultsSection title="Route Results">
              {isRouteStreaming ? (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Planning route...
                  </Typography>
                  <LinearProgress
                    variant={routeStreamPercent != null ? 'determinate' : 'indeterminate'}
                    value={routeStreamPercent != null ? Math.round(routeStreamPercent * 100) : 0}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {routeStreamMessage || 'Working...'}
                  </Typography>

                  {routeStreamProgress.length ? (
                    <Box sx={{ mb: 1 }}>
                      {routeStreamProgress.slice(-5).map((p, idx) => (
                        <Typography
                          key={idx}
                          variant="caption"
                          display="block"
                          color="text.secondary"
                        >
                          {p.message}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                  <Button variant="outlined" size="small" onClick={cancelRoutePlanning}>
                    Cancel
                  </Button>
                </Paper>
              ) : null}

              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Route: {displayedRoutePlan.route.join(' → ')}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    {displayedRoutePlan.route.map((waypoint, index) => (
                      <Chip
                        key={index}
                        label={waypoint}
                        variant="outlined"
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    {displayedRoutePlan.departure_time_utc ? (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Departure (UTC): {formatUtcMinute(displayedRoutePlan.departure_time_utc)}
                          {displayedRoutePlan.arrival_time_utc
                            ? ` → ${formatUtcMinute(displayedRoutePlan.arrival_time_utc)}`
                            : ''}
                        </Typography>
                      </Grid>
                    ) : null}
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Speed sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body2">
                          Distance: {displayedRoutePlan.distance_nm} nm
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Schedule sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body2">
                          Time: {displayedRoutePlan.time_hr} hr
                        </Typography>
                      </Box>
                    </Grid>

                    {displayedRoutePlan.groundspeed_kt != null && (
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Speed sx={{ mr: 1, fontSize: 20 }} />
                          <Typography variant="body2">
                            Groundspeed: {displayedRoutePlan.groundspeed_kt} kt
                          </Typography>
                        </Box>
                      </Grid>
                    )}

                    {displayedRoutePlan.headwind_kt != null && (
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Speed sx={{ mr: 1, fontSize: 20 }} />
                          <Typography variant="body2">
                            {displayedRoutePlan.headwind_kt >= 0 ? 'Headwind' : 'Tailwind'}:{' '}
                            {Math.abs(displayedRoutePlan.headwind_kt)} kt
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>

              {!isRouteStreaming ? (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <RouteWaypointWeatherTable plan={displayedRoutePlan} />
                  </CardContent>
                </Card>
              ) : null}

              <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
                <Grid item xs={12} md={4}>
                  <WeatherOverlayControls
                    overlays={overlays}
                    setOverlays={setOverlays}
                    disabled={isLoading}
                  />
                </Grid>

                <Grid item xs={12} md={8}>
                  <RouteMap plan={displayedRoutePlan} overlays={overlays} />
                </Grid>
              </Grid>

              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <RouteLegsTable plan={displayedRoutePlan} />
                </CardContent>
              </Card>

              {!isRouteStreaming ? (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <ElevationProfile plan={displayedRoutePlan} />
                  </CardContent>
                </Card>
              ) : null}

              {!isRouteStreaming ? (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <WeatherPanels airports={displayedRoutePlan.route} />
                  </CardContent>
                </Card>
              ) : null}

              {!isRouteStreaming &&
              displayedRoutePlan.alternates &&
              displayedRoutePlan.alternates.length > 0 ? (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <AlternateAirports alternates={displayedRoutePlan.alternates} />
                  </CardContent>
                </Card>
              ) : null}
            </ResultsSection>
          ) : lastMode === 'local' && localPlan ? (
            <ResultsSection title="Local Results">
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Center: {localPlan.airport} (radius {localPlan.radius_nm} nm)
                  </Typography>
                  {localPlan.planned_at_utc ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Planned at (UTC): {formatUtcMinute(localPlan.planned_at_utc)}
                    </Typography>
                  ) : null}
                  <Box sx={{ mb: 2 }}>
                    {localPlan.nearby_airports.slice(0, 20).map((ap) => (
                      <Chip
                        key={ap.icao || ap.iata}
                        label={`${ap.icao || ap.iata} (${ap.distance_nm.toFixed(1)} nm)`}
                        variant="outlined"
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>

              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={12} md={4}>
                  <WeatherOverlayControls
                    overlays={overlays}
                    setOverlays={setOverlays}
                    disabled={isLoading}
                  />
                </Grid>

                <Grid item xs={12} md={8}>
                  <LocalMap plan={localPlan} overlays={overlays} />
                </Grid>
              </Grid>
            </ResultsSection>
          ) : (
            <>
              {isLoading ? (
                lastMode === 'route' && isRouteStreaming ? (
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Planning route...
                    </Typography>
                    <LinearProgress
                      variant={routeStreamPercent != null ? 'determinate' : 'indeterminate'}
                      value={routeStreamPercent != null ? Math.round(routeStreamPercent * 100) : 0}
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {routeStreamMessage || 'Working...'}
                    </Typography>

                    {routeStreamProgress.length ? (
                      <Box sx={{ mb: 1 }}>
                        {routeStreamProgress.slice(-5).map((p, idx) => (
                          <Typography
                            key={idx}
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            {p.message}
                          </Typography>
                        ))}
                      </Box>
                    ) : null}
                    <Button variant="outlined" size="small" onClick={cancelRoutePlanning}>
                      Cancel
                    </Button>
                  </Paper>
                ) : (
                  <LoadingState
                    message={
                      lastMode === 'route' ? 'Planning route...' : 'Planning local flight...'
                    }
                  />
                )
              ) : (
                <EmptyState
                  icon={<Flight />}
                  message="Select a planning mode and enter details to generate a plan"
                />
              )}
            </>
          )}
        </Grid>
      </Grid>
    </Box>
  )
}

export default FlightPlannerPage
