import React, { useState, useCallback } from 'react'
import {
  Grid,
  TextField,
  Card,
  CardContent,
  Box,
  Chip,
  Typography,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { LocalAirport, Search, LocationOn } from '@mui/icons-material'
import toast from 'react-hot-toast'
import { useQuery } from 'react-query'
import {
  PageHeader,
  FormSection,
  EmptyState,
  LoadingState,
  ResultsSection,
  SearchHistoryDropdown,
  FavoriteButton,
} from '../components/shared'
import AirportAirspaceMap from '../components/AirportAirspaceMap'
import { useApiMutation, useSearchHistory, useFavorites, useForecast } from '../hooks'
import { airportService, airspaceService } from '../services'
import { validateRequired } from '../utils'
import type { Airport } from '../types'

const AIRSPACE_RADIUS_NM = 20

const AirportsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchError, setSearchError] = useState<string>('')
  const [showHistory, setShowHistory] = useState(false)
  const [forecastDays, setForecastDays] = useState<number>(1)

  const { addToHistory, getRecentSearches, clearHistory } = useSearchHistory()
  const { isFavorite, addFavorite, removeFavorite } = useFavorites()

  const searchMutation = useApiMutation<Airport[], string>(
    (query) => airportService.search(query),
    {
      successMessage: undefined,
      onSuccess: (data) => {
        toast.success(`Found ${data.length} airport${data.length !== 1 ? 's' : ''}`)
        addToHistory(searchTerm, 'airport')
      },
    },
  )

  const detailsMutation = useApiMutation<Airport, string>((icao) => airportService.getDetails(icao))

  const handleSearch = () => {
    const validation = validateRequired(searchTerm, 'Search term')
    if (!validation.valid) {
      setSearchError(validation.error || '')
      toast.error(validation.error || 'Invalid search term')
      return
    }

    setSearchError('')
    setShowHistory(false)
    searchMutation.mutate(searchTerm)
  }

  const handleSelectAirport = (icao: string) => {
    setForecastDays(1)
    detailsMutation.mutate(icao)
  }

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value)
    if (searchError) setSearchError('')
  }

  const handleFavoriteToggle = useCallback(
    (airport: Airport) => {
      if (isFavorite(airport.icao)) {
        removeFavorite(airport.icao)
        toast.success('Removed from favorites')
      } else {
        addFavorite(airport.icao, airport.name)
        toast.success('Added to favorites')
      }
    },
    [isFavorite, addFavorite, removeFavorite],
  )

  const handleHistorySelect = useCallback(
    (query: string) => {
      setSearchTerm(query)
      setShowHistory(false)
      // Auto-search
      searchMutation.mutate(query)
    },
    [searchMutation],
  )

  const recentSearches = getRecentSearches('airport', 5)

  const airports = searchMutation.data || []
  const selectedAirport = detailsMutation.data

  const airspaceQuery = useQuery(
    ['airspace', selectedAirport?.icao, selectedAirport?.latitude, selectedAirport?.longitude],
    () =>
      airspaceService.getNearby({
        lat: selectedAirport?.latitude as number,
        lon: selectedAirport?.longitude as number,
        radiusNm: AIRSPACE_RADIUS_NM,
      }),
    {
      enabled:
        !!selectedAirport &&
        typeof selectedAirport.latitude === 'number' &&
        typeof selectedAirport.longitude === 'number',
      staleTime: 30 * 60 * 1000,
      retry: 1,
    },
  )

  const forecast = useForecast(selectedAirport?.icao || '', forecastDays)

  const columns: GridColDef[] = [
    {
      field: 'favorite',
      headerName: '',
      width: 64,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <FavoriteButton
          isFavorite={isFavorite(params.row.icao)}
          onToggle={() => handleFavoriteToggle(params.row as Airport)}
          size="small"
          label={params.row.icao}
        />
      ),
    },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 220 },
    { field: 'icao', headerName: 'ICAO', width: 90 },
    { field: 'iata', headerName: 'IATA', width: 80 },
    { field: 'city', headerName: 'City', width: 140 },
    { field: 'country', headerName: 'Country', width: 110 },
    { field: 'type', headerName: 'Type', width: 140 },
  ]

  return (
    <Box>
      <PageHeader icon={<LocalAirport />} title="Airport Information" />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormSection
            title="Search Airports"
            onSubmit={handleSearch}
            buttonText="Search Airports"
            isLoading={searchMutation.isLoading}
          >
            <Grid item xs={12}>
              <Box sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  label="Search"
                  placeholder="Airport name, city, or code"
                  value={searchTerm}
                  onChange={(e) => handleSearchTermChange(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                  helperText={searchError || 'Enter airport name, city, or ICAO/IATA code'}
                  error={!!searchError}
                  disabled={searchMutation.isLoading}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'action.disabled' }} />,
                  }}
                />
                {showHistory && recentSearches.length > 0 && (
                  <SearchHistoryDropdown
                    items={recentSearches}
                    onSelect={handleHistorySelect}
                    onClear={() => {
                      clearHistory()
                      toast.success('Search history cleared')
                    }}
                    emptyMessage="No recent airport searches"
                  />
                )}
              </Box>
            </Grid>
          </FormSection>

          {searchMutation.isLoading ? (
            <Box sx={{ mt: 3 }}>
              <LoadingState message="Searching airports..." />
            </Box>
          ) : airports.length > 0 ? (
            <Box sx={{ mt: 3 }}>
              <ResultsSection title={`Search Results (${airports.length})`}>
                <Box sx={{ height: 440 }}>
                  <DataGrid
                    rows={airports}
                    columns={columns}
                    getRowId={(row) => row.icao || row.iata || `${row.latitude},${row.longitude}`}
                    disableRowSelectionOnClick
                    onRowClick={(params) =>
                      handleSelectAirport(String(params.row.icao || params.row.iata))
                    }
                    pageSizeOptions={[10, 20, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 20, page: 0 } },
                    }}
                  />
                </Box>
              </ResultsSection>
            </Box>
          ) : null}
        </Grid>

        <Grid item xs={12} md={6}>
          {detailsMutation.isLoading ? (
            <LoadingState message="Loading airport details..." />
          ) : selectedAirport ? (
            <ResultsSection title="Airport Details">
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Typography variant="h5" gutterBottom>
                      {selectedAirport.name}
                    </Typography>
                    <FavoriteButton
                      isFavorite={isFavorite(selectedAirport.icao)}
                      onToggle={() => handleFavoriteToggle(selectedAirport)}
                      label={selectedAirport.icao}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Chip label={selectedAirport.icao} color="primary" sx={{ mr: 1 }} />
                    {selectedAirport.iata && (
                      <Chip label={selectedAirport.iata} color="secondary" sx={{ mr: 1 }} />
                    )}
                    <Chip label={selectedAirport.type} variant="outlined" />
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LocationOn sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body1">
                          {selectedAirport.city}, {selectedAirport.country}
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Latitude
                      </Typography>
                      <Typography variant="body1">
                        {selectedAirport.latitude.toFixed(6)}°
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Longitude
                      </Typography>
                      <Typography variant="body1">
                        {selectedAirport.longitude.toFixed(6)}°
                      </Typography>
                    </Grid>

                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Elevation
                      </Typography>
                      <Typography variant="body1">{selectedAirport.elevation} ft</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Map (within {AIRSPACE_RADIUS_NM} NM) + airspace overlay
              </Typography>
              <AirportAirspaceMap
                airport={selectedAirport}
                radiusNm={AIRSPACE_RADIUS_NM}
                airspace={airspaceQuery.data}
              />

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Forecast (days: {forecastDays})
                </Typography>
                <Slider
                  value={forecastDays}
                  min={1}
                  max={7}
                  step={1}
                  marks
                  onChange={(_e, v) => setForecastDays(v as number)}
                  aria-label="Forecast days"
                />

                {forecast.isLoading ? (
                  <LoadingState message="Loading forecast..." />
                ) : forecast.isError ? (
                  <Typography variant="body2" color="text.secondary">
                    Forecast unavailable.
                  </Typography>
                ) : forecast.data ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date (UTC)</TableCell>
                        <TableCell align="right">High (°F)</TableCell>
                        <TableCell align="right">Low (°F)</TableCell>
                        <TableCell align="right">Precip (mm)</TableCell>
                        <TableCell align="right">Max wind (kt)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {forecast.data.daily.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell>{d.date}</TableCell>
                          <TableCell align="right">{d.temp_max_f ?? '—'}</TableCell>
                          <TableCell align="right">{d.temp_min_f ?? '—'}</TableCell>
                          <TableCell align="right">{d.precipitation_mm ?? '—'}</TableCell>
                          <TableCell align="right">{d.wind_speed_max_kt ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </Box>
            </ResultsSection>
          ) : (
            <EmptyState
              icon={<LocalAirport />}
              message="Search for airports and select one to view details"
            />
          )}
        </Grid>
      </Grid>
    </Box>
  )
}

export default AirportsPage
