import create from 'zustand'

export type DisplayTheme = 'day' | 'night' | 'high-contrast'

export type MapOverlay = 'weather' | 'terrain' | 'traffic'
export type PfdInsetMode = 'none' | 'map'

type UiState = {
  mapRangeNm: number
  activeOverlays: MapOverlay[]
  pfdInset: PfdInsetMode
  showMfdMenu: boolean
  theme: DisplayTheme
}

type UiActions = {
  setMapRangeNm: (rangeNm: number) => void
  toggleOverlay: (overlay: MapOverlay) => void
  setPfdInset: (mode: PfdInsetMode) => void
  setMfdMenuOpen: (open: boolean) => void
  setTheme: (theme: DisplayTheme) => void
  reset: () => void
}

const THEME_STORAGE_ID = ['g1000', 'theme', 'preference'].join('-')
const DEFAULT_THEME: DisplayTheme = 'day'

const loadThemePreference = (): DisplayTheme => {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_ID)
    if (stored === 'day' || stored === 'night' || stored === 'high-contrast') {
      return stored
    }
  } catch {
    return DEFAULT_THEME
  }
  return DEFAULT_THEME
}

const persistThemePreference = (theme: DisplayTheme) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_ID, theme)
  } catch {
    return
  }
}

const defaultState: UiState = {
  mapRangeNm: 25,
  activeOverlays: ['terrain'],
  pfdInset: 'none',
  showMfdMenu: false,
  theme: DEFAULT_THEME,
}

const initialState: UiState = {
  ...defaultState,
  theme: loadThemePreference(),
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  ...initialState,
  setMapRangeNm: (mapRangeNm) => set({ mapRangeNm }),
  toggleOverlay: (overlay) =>
    set((state) => ({
      activeOverlays: state.activeOverlays.includes(overlay)
        ? state.activeOverlays.filter((entry) => entry !== overlay)
        : [...state.activeOverlays, overlay],
    })),
  setPfdInset: (pfdInset) => set({ pfdInset }),
  setMfdMenuOpen: (showMfdMenu) => set({ showMfdMenu }),
  setTheme: (theme) => {
    persistThemePreference(theme)
    set({ theme })
  },
  reset: () => {
    persistThemePreference(defaultState.theme)
    set(defaultState)
  },
}))

export const useMapRange = () => useUiStore((state) => state.mapRangeNm)
export const useActiveOverlays = () => useUiStore((state) => state.activeOverlays)
export const usePfdInset = () => useUiStore((state) => state.pfdInset)
export const useMfdMenuOpen = () => useUiStore((state) => state.showMfdMenu)
export const useThemePreference = () => useUiStore((state) => state.theme)
