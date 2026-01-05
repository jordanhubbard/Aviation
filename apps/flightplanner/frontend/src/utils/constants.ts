// Theme Constants
export const THEME_CONSTANTS = {
  iconSize: {
    small: 20,
    medium: 40,
    large: 64,
  },
  spacing: {
    xs: 0.5,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
  },
  opacity: {
    disabled: 0.3,
    hover: 0.7,
    active: 1,
  },
} as const

// API Constants
export const API_CONSTANTS = {
  timeout: 120000, // 120 seconds
  retryCount: 2,
  staleTime: {
    short: 5 * 60 * 1000, // 5 minutes
    medium: 10 * 60 * 1000, // 10 minutes
    long: 30 * 60 * 1000, // 30 minutes
  },
} as const

// Validation Constants
export const VALIDATION_CONSTANTS = {
  airportCode: {
    minLength: 3,
    maxLength: 5,
    pattern: /^[A-Z0-9]+$/,
  },
} as const

// Local Storage Keys
export const STORAGE_KEYS = {
  searchHistory: 'vfr_search_history',
  favorites: 'vfr_favorites',
  recentAirports: 'vfr_recent_airports',
  preferences: 'vfr_user_preferences',
} as const

// UI Constants
export const UI_CONSTANTS = {
  maxListHeight: 400,
  defaultAircraftType: 'C172',
  toastDuration: 3000,
} as const
