import React, { useCallback } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import { Star, StarBorder } from '@mui/icons-material'

interface FavoriteButtonProps {
  isFavorite: boolean
  onToggle: () => void
  size?: 'small' | 'medium' | 'large'
  label?: string
}

const FavoriteButtonComponent: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  size = 'medium',
  label,
}) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation() // Prevent triggering parent click events
      onToggle()
    },
    [onToggle],
  )

  const tooltipText = isFavorite ? 'Remove from favorites' : 'Add to favorites'
  const ariaLabel = label
    ? `${isFavorite ? 'Remove' : 'Add'} ${label} ${isFavorite ? 'from' : 'to'} favorites`
    : tooltipText

  return (
    <Tooltip title={tooltipText}>
      <IconButton
        onClick={handleClick}
        size={size}
        aria-label={ariaLabel}
        sx={{
          color: isFavorite ? 'warning.main' : 'action.disabled',
          '&:hover': {
            color: isFavorite ? 'warning.dark' : 'warning.light',
          },
        }}
      >
        {isFavorite ? <Star /> : <StarBorder />}
      </IconButton>
    </Tooltip>
  )
}

export const FavoriteButton = React.memo(FavoriteButtonComponent)
