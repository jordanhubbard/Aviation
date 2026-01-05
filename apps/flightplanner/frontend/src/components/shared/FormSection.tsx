import React, { useCallback } from 'react'
import { Paper, Typography, Grid, Button } from '@mui/material'

interface FormSectionProps {
  title: string
  onSubmit: () => void
  buttonText: string
  children: React.ReactNode
  isLoading?: boolean
}

const FormSectionComponent: React.FC<FormSectionProps> = ({
  title,
  onSubmit,
  buttonText,
  children,
  isLoading = false,
}) => {
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSubmit()
    },
    [onSubmit],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSubmit()
      }
    },
    [onSubmit],
  )

  return (
    <Paper
      sx={{ p: { xs: 2, sm: 3 } }}
      component="form"
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <Typography variant="h6" gutterBottom component="h2">
        {title}
      </Typography>

      <Grid container spacing={2}>
        {children}

        <Grid item xs={12}>
          <Button
            variant="contained"
            size="large"
            type="submit"
            fullWidth
            disabled={isLoading}
            sx={{ mt: 2 }}
            aria-busy={isLoading}
          >
            {isLoading ? 'Loading...' : buttonText}
          </Button>
        </Grid>
      </Grid>
    </Paper>
  )
}

export const FormSection = React.memo(FormSectionComponent)
