import React from 'react'
import { Typography, Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'

interface PageHeaderProps {
  icon: React.ReactElement
  title: string
}

const PageHeaderComponent: React.FC<PageHeaderProps> = ({ icon, title }) => {
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Typography variant={isSmall ? 'h5' : 'h4'} gutterBottom component="h1">
      <Box component="span" sx={{ mr: 1, verticalAlign: 'middle' }} aria-hidden="true">
        {React.cloneElement(icon, { sx: { verticalAlign: 'middle' }, 'aria-hidden': 'true' })}
      </Box>
      {title}
    </Typography>
  )
}

export const PageHeader = React.memo(PageHeaderComponent)
