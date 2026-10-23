import React from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { FlightTakeoff } from '@mui/icons-material'

interface LoadingSpinnerProps {
  message?: string
  size?: number
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 40 
}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
    >
      <Box position="relative">
        <CircularProgress size={size} />
        <FlightTakeoff
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: size * 0.4,
            color: 'primary.main',
          }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  )
}

export default LoadingSpinner
