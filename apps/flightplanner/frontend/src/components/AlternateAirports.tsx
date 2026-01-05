import React from 'react'
import { Box, Chip, Grid, Typography } from '@mui/material'

import type { AlternateAirport } from '../types'

type Props = {
  alternates?: AlternateAirport[] | null
}

const AlternateAirports: React.FC<Props> = ({ alternates }) => {
  if (!alternates || alternates.length === 0) return null

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Alternates
      </Typography>

      <Grid container spacing={1}>
        {alternates.map((alt) => (
          <Grid item xs={12} sm={6} key={alt.code}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Chip label={alt.code} size="small" variant="outlined" />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {alt.distance_nm} nm
              </Typography>
              {alt.weather?.visibility_sm != null && (
                <Typography variant="body2" color="text.secondary">
                  Vis {alt.weather.visibility_sm} sm
                </Typography>
              )}
              {alt.weather?.ceiling_ft != null && (
                <Typography variant="body2" color="text.secondary">
                  Ceil {alt.weather.ceiling_ft} ft
                </Typography>
              )}
            </Box>
            {alt.name ? (
              <Typography variant="caption" color="text.secondary">
                {alt.name}
              </Typography>
            ) : null}
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default React.memo(AlternateAirports)
