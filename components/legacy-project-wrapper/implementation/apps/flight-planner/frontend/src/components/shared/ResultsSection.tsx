import React from 'react'
import { Paper, Typography } from '@mui/material'

interface ResultsSectionProps {
  title: string
  children: React.ReactNode
}

const ResultsSectionComponent: React.FC<ResultsSectionProps> = ({ title, children }) => {
  return (
    <Paper
      sx={{ p: { xs: 2, sm: 3 } }}
      role="region"
      aria-labelledby={`results-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <Typography
        variant="h6"
        gutterBottom
        component="h2"
        id={`results-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

export const ResultsSection = React.memo(ResultsSectionComponent)
