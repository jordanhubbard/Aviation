import React from 'react'
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Chip,
  IconButton,
} from '@mui/material'
import { Star, Clear } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import type { Favorite } from '../../hooks'

interface FavoritesListProps {
  favorites: Favorite[]
  onSelect: (code: string) => void
  onRemove: (code: string) => void
  emptyMessage?: string
  title?: string
}

const FavoritesListComponent: React.FC<FavoritesListProps> = ({
  favorites,
  onSelect,
  onRemove,
  emptyMessage = 'No favorites yet',
  title = 'Favorites',
}) => {
  if (favorites.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Star sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.3 }} />
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Star sx={{ color: 'warning.main' }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Chip label={favorites.length} size="small" />
      </Box>
      <List dense>
        <AnimatePresence>
          {favorites.map((favorite) => (
            <motion.div
              key={favorite.code}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <ListItem
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="remove from favorites"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(favorite.code)
                    }}
                  >
                    <Clear fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => onSelect(favorite.code)}>
                  <ListItemText
                    primary={favorite.code}
                    secondary={favorite.name || new Date(favorite.addedAt).toLocaleDateString()}
                  />
                </ListItemButton>
              </ListItem>
            </motion.div>
          ))}
        </AnimatePresence>
      </List>
    </Paper>
  )
}

export const FavoritesList = React.memo(FavoritesListComponent)
