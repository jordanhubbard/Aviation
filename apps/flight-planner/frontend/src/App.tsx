import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Container, AppBar, Toolbar, Typography, Box, Button } from '@mui/material'
import { BugReport } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import Navigation from './components/Navigation'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoadingState } from './components/shared'
import { getRuntimeEnv, githubNewIssueUrl } from './utils'

// Code splitting with React.lazy for better performance
const FlightPlannerPage = lazy(() => import('./pages/FlightPlannerPage'))
const WeatherPage = lazy(() => import('./pages/WeatherPage'))
const AirportsPage = lazy(() => import('./pages/AirportsPage'))

// Animation variants for page transitions
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
}

function App() {
  const location = useLocation()
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  const [repoUrl, setRepoUrl] = useState<string | null>(null)
  const [revision, setRevision] = useState<string | null>(null)
  const runtimeRepoUrl = getRuntimeEnv('VITE_REPO_URL')
  const runtimeSha = getRuntimeEnv('VITE_GIT_SHA')

  useEffect(() => {
    if (runtimeRepoUrl) {
      setRepoUrl(runtimeRepoUrl)
      return
    }

    void fetch('/api/meta')
      .then(async (r) => {
        if (!r.ok) return null
        const json = (await r.json()) as { repo_url?: string | null; revision?: string | null }
        return { repo_url: json.repo_url || null, revision: json.revision || null }
      })
      .then((v) => {
        if (!v) return
        if (v.repo_url) setRepoUrl(v.repo_url)
        if (v.revision) setRevision(v.revision)
      })
      .catch(() => undefined)
  }, [runtimeRepoUrl])

  const reportIssueHref = useMemo(() => {
    if (!repoUrl) return null

    const now = new Date()
    const body = [
      '## Bug report',
      '',
      'Describe what happened:',
      '',
      '## Context',
      `- URL: ${window.location.href}`,
      `- Time (UTC): ${now.toISOString()}`,
      `- Revision: ${runtimeSha || revision || 'unknown'}`,
      `- User agent: ${navigator.userAgent}`,
    ].join('\n')

    return githubNewIssueUrl(repoUrl, {
      title: 'Bug: ',
      body,
    })
  }, [repoUrl, revision, runtimeSha])

  return (
    <ErrorBoundary>
      <Box sx={{ flexGrow: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" component="header" role="banner">
          <Toolbar>
            <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
              ✈️ VFR Flight Planner
            </Typography>

            {reportIssueHref ? (
              <Button
                color="inherit"
                size="small"
                startIcon={<BugReport />}
                component="a"
                href={reportIssueHref}
                target="_blank"
                rel="noreferrer"
              >
                Report issue
              </Button>
            ) : null}
          </Toolbar>
        </AppBar>

        <Navigation />

        <Container
          maxWidth="xl"
          sx={{ mt: isSmall ? 2 : 4, mb: isSmall ? 2 : 4, flex: 1 }}
          component="main"
          role="main"
        >
          <Suspense fallback={<LoadingState message="Loading page..." />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Routes location={location}>
                  <Route path="/" element={<FlightPlannerPage />} />
                  <Route path="/weather" element={<WeatherPage />} />
                  <Route path="/airports" element={<AirportsPage />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </Container>
      </Box>
    </ErrorBoundary>
  )
}

export default App
