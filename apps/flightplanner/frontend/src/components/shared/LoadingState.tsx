import React from 'react'
import { Box, CircularProgress, Typography, Paper } from '@mui/material'

interface LoadingStateProps {
  message?: string
}

const LoadingStateComponent: React.FC<LoadingStateProps> = ({ message = 'Loading...' }) => {
  return (
    <Paper sx={{ p: 3 }} role="status" aria-live="polite" aria-busy="true">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          gap: 2,
        }}
      >
        <CircularProgress aria-label="Loading" />
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Box>
    </Paper>
  )
}

export const LoadingState = React.memo(LoadingStateComponent)
