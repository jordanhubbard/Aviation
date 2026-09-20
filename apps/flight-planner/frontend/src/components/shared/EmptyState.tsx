import React from 'react'
import { Paper, Typography, Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

interface EmptyStateProps {
  // Typed so cloneElement can inject styling props under React 19's stricter types.
  icon: React.ReactElement<{ sx?: SxProps<Theme> }>
  message: string
}

const EmptyStateComponent: React.FC<EmptyStateProps> = ({ icon, message }) => {
  return (
    <Paper
      sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}
      role="status"
      aria-live="polite"
    >
      <Box sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} aria-hidden="true">
        {React.cloneElement(icon, { sx: { fontSize: 64 } })}
      </Box>
      <Typography variant="h6">{message}</Typography>
    </Paper>
  )
}

export const EmptyState = React.memo(EmptyStateComponent)
