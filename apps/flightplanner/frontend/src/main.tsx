import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'

import { installFrontendBeadsErrorReporting } from './utils/beadsReporting'

const reloadOnceKey = 'flightplanner:reload-once:preload-error'

const reloadOnce = () => {
  try {
    if (sessionStorage.getItem(reloadOnceKey) === '1') return
    sessionStorage.setItem(reloadOnceKey, '1')
  } catch {
    // Ignore storage failures; best-effort only.
  }

  window.location.reload()
}

// Create a theme instance
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
})

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

installFrontendBeadsErrorReporting()

// If a new deploy happens while a user has a page open, the old HTML can reference
// chunk filenames that no longer exist, causing dynamic import failures.
window.addEventListener('vite:preloadError', (ev) => {
  ev.preventDefault()
  reloadOnce()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
          <Toaster position="top-right" />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
