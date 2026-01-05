import React, { useState, useMemo } from 'react'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  IconButton,
  TextField,
  Alert,
  Tooltip,
  TableSortLabel,
} from '@mui/material'
import {
  FlightTakeoff,
  School,
  TrendingUp,
  Schedule,
  Search,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Error,
  Warning,
  NightsStay,
} from '@mui/icons-material'
import { LogbookData } from '../services/logbookService'

interface DashboardContentProps {
  logbookData: LogbookData
}

const DashboardContent: React.FC<DashboardContentProps> = ({ logbookData }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [aircraftFilter, setAircraftFilter] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Get unique aircraft for filter dropdown
  const uniqueAircraft = useMemo(() => {
    const aircraftMap = new Map()
    logbookData.entries.forEach(entry => {
      if (entry.aircraft?.registration) {
        aircraftMap.set(entry.aircraft.registration, {
          registration: entry.aircraft.registration,
          icao_type_code: entry.aircraft.icao_type_code
        })
      }
    })
    return Array.from(aircraftMap.values()).sort((a, b) => a.registration.localeCompare(b.registration))
  }, [logbookData.entries])

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    const filtered = logbookData.entries.filter(entry => {
      const matchesSearch = !searchTerm || 
        entry.aircraft?.registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.aircraft?.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.aircraft?.icao_type_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.departure?.identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.destination?.identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.remarks?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesAircraft = !aircraftFilter || entry.aircraft?.registration === aircraftFilter

      return matchesSearch && matchesAircraft
    })

    // Sort entries
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime()
          bValue = new Date(b.date).getTime()
          break
        case 'aircraft':
          aValue = a.aircraft?.registration || ''
          bValue = b.aircraft?.registration || ''
          break
        case 'route':
          aValue = `${a.departure?.identifier || ''}-${a.destination?.identifier || ''}`
          bValue = `${b.departure?.identifier || ''}-${b.destination?.identifier || ''}`
          break
        case 'total_time':
          aValue = a.total_time || 0
          bValue = b.total_time || 0
          break
        case 'pic':
          aValue = a.pic_time || 0
          bValue = b.pic_time || 0
          break
        case 'dual':
          aValue = a.dual_received || 0
          bValue = b.dual_received || 0
          break
        case 'role':
          aValue = a.pilot_role || ''
          bValue = b.pilot_role || ''
          break
        case 'landings':
          aValue = (a.landings_day || 0) + (a.landings_night || 0)
          bValue = (b.landings_day || 0) + (b.landings_night || 0)
          break
        default:
          aValue = new Date(a.date).getTime()
          bValue = new Date(b.date).getTime()
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [logbookData.entries, searchTerm, aircraftFilter, sortBy, sortOrder])

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  const formatTime = (time: number | undefined): string => {
    if (time === undefined || time === null) return '0.0'
    return time.toFixed(1)
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const StatCard = ({ title, value, subtitle, icon, color = 'primary' }: {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ReactNode
    color?: 'primary' | 'secondary' | 'success' | 'warning'
  }) => (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Box color={`${color}.main`} mr={1}>
            {icon}
          </Box>
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div" color={`${color}.main`}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  )

  return (
    <Box>
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Hours"
            value={formatTime(logbookData.stats?.total_time)}
            subtitle="Current Year"
            icon={<FlightTakeoff />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="PIC Hours"
            value={formatTime(logbookData.stats?.total_pic)}
            subtitle="Current Year"
            icon={<School />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Flights"
            value={logbookData.entries?.length || 0}
            subtitle="All Time"
            icon={<TrendingUp />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Night Hours"
            value={formatTime(logbookData.stats?.total_night)}
            subtitle="Current Year"
            icon={<Schedule />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* All Time vs Current Year Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                All Time Totals
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                  <Typography variant="h6">{formatTime(logbookData.all_time?.total_time)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">PIC Hours</Typography>
                  <Typography variant="h6">{formatTime(logbookData.all_time?.total_pic)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Cross Country</Typography>
                  <Typography variant="h6">{formatTime(logbookData.all_time?.total_cross_country)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Night Hours</Typography>
                  <Typography variant="h6">{formatTime(logbookData.all_time?.total_night)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Experience (30 days)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                  <Typography variant="h6">{formatTime(logbookData.recent_experience?.total_time)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Landings</Typography>
                  <Typography variant="h6">{logbookData.recent_experience?.total_landings || 0}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Night Hours</Typography>
                  <Typography variant="h6">{formatTime(logbookData.recent_experience?.total_night)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Cross Country</Typography>
                  <Typography variant="h6">{formatTime(logbookData.recent_experience?.total_cross_country)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Logbook Entries */}
      <Card elevation={2}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Logbook Entries ({filteredEntries.length})
            </Typography>
          </Box>

          {/* Error and Warning Summary */}
          {(() => {
            const errorEntries = filteredEntries.filter(entry => entry.error_explanation)
            const warningEntries = filteredEntries.filter(entry => entry.warning_explanation)
            const totalIssues = errorEntries.length + warningEntries.length
            
            if (totalIssues > 0) {
              return (
                <Alert severity={errorEntries.length > 0 ? "error" : "warning"} sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    {errorEntries.length > 0 && (
                      <>
                        <strong>{errorEntries.length}</strong> entries have validation errors (highlighted in red).{' '}
                      </>
                    )}
                    {warningEntries.length > 0 && (
                      <>
                        <strong>{warningEntries.length}</strong> entries have validation warnings (highlighted in yellow).{' '}
                      </>
                    )}
                    Click to expand entries for detailed information.
                  </Typography>
                </Alert>
              )
            }
            return null
          })()}

          {/* Status Legend */}
          <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              Status Indicators:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={3}>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Error color="error" fontSize="small" />
                <Typography variant="caption">Validation Error</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Warning color="warning" fontSize="small" />
                <Typography variant="caption">Warning</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={0.5}>
                <School sx={{ color: '#1976d2' }} fontSize="small" />
                <Typography variant="caption">Ground Training</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={0.5}>
                <NightsStay sx={{ color: '#7b1fa2' }} fontSize="small" />
                <Typography variant="caption">Night Flight</Typography>
              </Box>
            </Box>
          </Box>

          {/* Search and Filter Controls */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={6}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search flights..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Aircraft</InputLabel>
                <Select
                  value={aircraftFilter}
                  label="Aircraft"
                  onChange={(e) => setAircraftFilter(e.target.value)}
                >
                  <MenuItem value="">All Aircraft</MenuItem>
                  {uniqueAircraft.map((aircraft) => (
                    <MenuItem key={aircraft.registration} value={aircraft.registration}>
                      {aircraft.registration}
                      {aircraft.icao_type_code && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({aircraft.icao_type_code})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Entries Table */}
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              border: '1px solid #d0d0d0',
              borderRadius: 0,
              boxShadow: 'none',
            }}
          >
            <Table
              size="small"
              sx={{
                minWidth: 950,
                '& .MuiTableCell-root': {
                  borderRight: '1px solid #e0e0e0',
                  borderBottom: '1px solid #e0e0e0',
                  padding: '6px 12px',
                  '&:last-child': {
                    borderRight: 'none',
                  },
                },
              }}
            >
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor: '#f5f5f5',
                    '& .MuiTableCell-head': {
                      backgroundColor: '#f5f5f5',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      borderBottom: '2px solid #d0d0d0',
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableCell sx={{ width: '40px', padding: '6px 8px !important' }}></TableCell>
                  <TableCell sx={{ width: '40px', padding: '6px 8px !important', textAlign: 'center' }}>Status</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'date'}
                      direction={sortBy === 'date' ? sortOrder : 'asc'}
                      onClick={() => handleSort('date')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'aircraft'}
                      direction={sortBy === 'aircraft' ? sortOrder : 'asc'}
                      onClick={() => handleSort('aircraft')}
                    >
                      Aircraft
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'route'}
                      direction={sortBy === 'route' ? sortOrder : 'asc'}
                      onClick={() => handleSort('route')}
                    >
                      Route
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortBy === 'total_time'}
                      direction={sortBy === 'total_time' ? sortOrder : 'asc'}
                      onClick={() => handleSort('total_time')}
                    >
                      Total Time
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortBy === 'pic'}
                      direction={sortBy === 'pic' ? sortOrder : 'asc'}
                      onClick={() => handleSort('pic')}
                    >
                      PIC
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortBy === 'dual'}
                      direction={sortBy === 'dual' ? sortOrder : 'asc'}
                      onClick={() => handleSort('dual')}
                    >
                      Dual
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'role'}
                      direction={sortBy === 'role' ? sortOrder : 'asc'}
                      onClick={() => handleSort('role')}
                    >
                      Role
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortBy === 'landings'}
                      direction={sortBy === 'landings' ? sortOrder : 'asc'}
                      onClick={() => handleSort('landings')}
                    >
                      Landings
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEntries.map((entry, index) => {
                  const hasError = entry.error_explanation !== null && entry.error_explanation !== undefined
                  const hasWarning = entry.warning_explanation !== null && entry.warning_explanation !== undefined
                  const hasIssue = hasError || hasWarning
                  
                  // Check for special entry types
                  const isGroundTraining = entry.total_time === 0 && (entry.ground_training || 0) > 0
                  const hasNightTime = (entry.conditions?.night || 0) > 0
                  
                  // Determine background color: errors (red) > warnings (yellow) > ground training (light blue) > night flights (light purple) > default
                  let backgroundColor = 'inherit'
                  let hoverColor = 'rgba(0, 0, 0, 0.04)'
                  
                  if (hasError) {
                    backgroundColor = '#ffebee'  // Light red for errors
                    hoverColor = '#ffcdd2'
                  } else if (hasWarning) {
                    backgroundColor = '#fff8e1'  // Light yellow for warnings  
                    hoverColor = '#ffecb3'
                  } else if (isGroundTraining) {
                    backgroundColor = '#e3f2fd'  // Light blue for ground training
                    hoverColor = '#bbdefb'
                  } else if (hasNightTime) {
                    backgroundColor = '#f3e5f5'  // Light purple for night flights
                    hoverColor = '#e1bee7'
                  }
                  
                  return (
                  <React.Fragment key={index}>
                    <TableRow
                      sx={{
                        backgroundColor: backgroundColor,
                        '&:hover': {
                          backgroundColor: hoverColor,
                          cursor: 'pointer',
                        },
                        '& .MuiTableCell-root': {
                          fontSize: '0.875rem',
                          padding: '8px 12px',
                        },
                      }}
                    >
                      <TableCell sx={{ padding: '2px 4px !important', textAlign: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(index)}
                          sx={{ padding: '4px' }}
                        >
                          {expandedRows.has(index) ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ padding: '6px !important', textAlign: 'center' }}>
                        {hasError && (
                          <Tooltip title={entry.error_explanation || 'Invalid entry'}>
                            <Error color="error" fontSize="small" />
                          </Tooltip>
                        )}
                        {hasWarning && !hasError && (
                          <Tooltip title={entry.warning_explanation || 'Warning'}>
                            <Warning color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                        {isGroundTraining && !hasIssue && (
                          <Tooltip title="Ground Training">
                            <School sx={{ color: '#1976d2' }} fontSize="small" />
                          </Tooltip>
                        )}
                        {hasNightTime && !hasIssue && !isGroundTraining && (
                          <Tooltip title="Night Flight">
                            <NightsStay sx={{ color: '#7b1fa2' }} fontSize="small" />
                          </Tooltip>
                        )}
                        {!hasError && !hasWarning && !isGroundTraining && !hasNightTime && (
                          <span style={{ color: '#e0e0e0' }}>—</span>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{formatDate(entry.date)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          {entry.aircraft?.registration || 'N/A'}
                          {entry.aircraft?.icao_type_code && (
                            <span style={{ marginLeft: 4, color: '#666', fontSize: '0.75rem' }}>
                              ({entry.aircraft.icao_type_code})
                            </span>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          {entry.departure?.identifier || '???'} → {entry.destination?.identifier || '???'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{formatTime(entry.total_time)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{formatTime(entry.pic_time)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{formatTime(entry.dual_received)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.875rem',
                            fontWeight: entry.pilot_role === 'PIC' ? 600 : 400,
                            color: entry.pilot_role === 'PIC' ? '#1976d2' : 'inherit'
                          }}
                        >
                          {entry.pilot_role || 'PIC'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {(entry.landings_day || 0) + (entry.landings_night || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                        <Collapse in={expandedRows.has(index)} timeout="auto" unmountOnExit>
                          <Box sx={{
                            p: 2,
                            backgroundColor: '#f8f9fa',
                            borderTop: '1px solid #e0e0e0'
                          }}>
                            <Grid container spacing={3}>
                              <Grid item xs={12} md={4}>
                                <Box sx={{ borderLeft: '3px solid #1976d2', pl: 2 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    Flight Details
                                  </Typography>
                                  <Table size="small" sx={{ '& td': { border: 'none', padding: '2px 8px', fontSize: '0.875rem' } }}>
                                    <TableBody>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Solo Time:</TableCell>
                                        <TableCell align="right">{formatTime(entry.solo_time)} hrs</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Day Landings:</TableCell>
                                        <TableCell align="right">{entry.landings_day || 0}</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Night Landings:</TableCell>
                                        <TableCell align="right">{entry.landings_night || 0}</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </Box>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Box sx={{ borderLeft: '3px solid #9c27b0', pl: 2 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    Conditions
                                  </Typography>
                                  <Table size="small" sx={{ '& td': { border: 'none', padding: '2px 8px', fontSize: '0.875rem' } }}>
                                    <TableBody>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Day:</TableCell>
                                        <TableCell align="right">{formatTime(entry.conditions?.day)} hrs</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Night:</TableCell>
                                        <TableCell align="right">{formatTime(entry.conditions?.night)} hrs</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Cross Country:</TableCell>
                                        <TableCell align="right">{formatTime(entry.conditions?.cross_country)} hrs</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Actual IMC:</TableCell>
                                        <TableCell align="right">{formatTime(entry.conditions?.actual_instrument)} hrs</TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Simulated IMC:</TableCell>
                                        <TableCell align="right">{formatTime(entry.conditions?.simulated_instrument)} hrs</TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </Box>
                              </Grid>
                              {entry.remarks && (
                                <Grid item xs={12} md={4}>
                                  <Box sx={{ borderLeft: '3px solid #ff9800', pl: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                      Remarks
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                      {entry.remarks}
                                    </Typography>
                                  </Box>
                                </Grid>
                              )}
                              {hasError && (
                                <Grid item xs={12}>
                                  <Alert severity="error" sx={{ mt: 1 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      Data Validation Errors
                                    </Typography>
                                    <Typography variant="body2">
                                      {entry.error_explanation}
                                    </Typography>
                                  </Alert>
                                </Grid>
                              )}
                              {hasWarning && (
                                <Grid item xs={12}>
                                  <Alert severity="warning" sx={{ mt: 1 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      Data Validation Warnings
                                    </Typography>
                                    <Typography variant="body2">
                                      {entry.warning_explanation}
                                    </Typography>
                                  </Alert>
                                </Grid>
                              )}
                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredEntries.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                No flights found matching your criteria.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default DashboardContent
