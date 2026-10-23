import React from 'react'
import {
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Paper,
  Typography,
  IconButton,
  Box,
} from '@mui/material'
import { History, Clear } from '@mui/icons-material'

interface SearchHistoryItem {
  query: string
  timestamp: number
}

interface SearchHistoryDropdownProps {
  items: SearchHistoryItem[]
  onSelect: (query: string) => void
  onClear?: () => void
  emptyMessage?: string
}

const SearchHistoryDropdownComponent: React.FC<SearchHistoryDropdownProps> = ({
  items,
  onSelect,
  onClear,
  emptyMessage = 'No recent searches',
}) => {
  if (items.length === 0) {
    return (
      <Paper
        sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          mt: 0.5,
          zIndex: 1000,
          maxHeight: 300,
          overflow: 'auto',
        }}
        elevation={3}
      >
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <History sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        </Box>
      </Paper>
    )
  }

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        mt: 0.5,
        zIndex: 1000,
        maxHeight: 300,
        overflow: 'auto',
      }}
      elevation={3}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Recent Searches
        </Typography>
        {onClear && (
          <IconButton size="small" onClick={onClear} aria-label="Clear history">
            <Clear fontSize="small" />
          </IconButton>
        )}
      </Box>
      <List dense>
        {items.map((item, index) => (
          <ListItem key={`${item.query}-${index}`} disablePadding>
            <ListItemButton onClick={() => onSelect(item.query)}>
              <History sx={{ mr: 2, fontSize: 20, color: 'text.secondary' }} />
              <ListItemText
                primary={item.query}
                secondary={new Date(item.timestamp).toLocaleDateString()}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  )
}

export const SearchHistoryDropdown = React.memo(SearchHistoryDropdownComponent)
