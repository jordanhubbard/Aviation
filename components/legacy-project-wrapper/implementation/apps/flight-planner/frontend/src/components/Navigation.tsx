import React, { useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Tabs, Tab, Box } from '@mui/material'
import { Flight, Cloud, LocalAirport } from '@mui/icons-material'

const Navigation: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: string) => {
      navigate(newValue)
    },
    [navigate],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.altKey) {
        switch (event.key) {
          case '1':
            navigate('/')
            event.preventDefault()
            break
          case '2':
            navigate('/weather')
            event.preventDefault()
            break
          case '3':
            navigate('/airports')
            event.preventDefault()
            break
          // Add more shortcuts here for G1000 controls
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [navigate])

  return (
    <Box
      sx={{ borderBottom: 1, borderColor: 'divider' }}
      component="nav"
      role="navigation"
      aria-label="Main navigation"
    >
      <Tabs
        value={location.pathname}
        onChange={handleChange}
        centered={false}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Navigation tabs"
      >
        <Tab label="Cockpit receiver" value="/cockpit" />
        <Tab label="Offline packages" value="/offline" />
        <Tab label="Sourced performance" value="/aircraft-performance" />
        <Tab
          label="Aircraft library"
          value="/aircraft-library"
          aria-label="Aircraft document library"
        />
        <Tab label="Charts / navigation" value="/charts" aria-label="Charts and navigation" />

        <Tab label="NOTAMs" value="/notams" />
        <Tab label="Flight Service filing" value="/filing" />
        <Tab label="Route assessment" value="/route-assessment" />
        <Tab
          icon={<Flight />}
          label="Flight Planner"
          value="/"
          aria-label="Flight Planner (Alt+1)"
          title="Flight Planner (Alt+1)"
        />
        <Tab
          icon={<Cloud />}
          label="Weather"
          value="/weather"
          aria-label="Weather (Alt+2)"
          title="Weather (Alt+2)"
        />
        <Tab
          icon={<LocalAirport />}
          label="Airports"
          value="/airports"
          aria-label="Airports (Alt+3)"
          title="Airports (Alt+3)"
        />
      </Tabs>
    </Box>
  )
}

export default React.memo(Navigation)
