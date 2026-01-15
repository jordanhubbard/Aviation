import React, { useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Tabs, Tab, Box, useMediaQuery } from '@mui/material'
import { Flight, Cloud, LocalAirport } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'

const Navigation: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

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
        centered={!isSmall}
        variant={isSmall ? 'scrollable' : 'standard'}
        scrollButtons={isSmall ? 'auto' : false}
        allowScrollButtonsMobile
        aria-label="Navigation tabs"
      >
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
