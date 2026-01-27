import { create } from 'zustand'

export type MapOverlay = 'weather' | 'terrain' | 'traffic'
export type PfdInsetMode = 'none' | 'map'

type UiState = {
  mapRangeNm: number
  activeOverlays: MapOverlay[]
  pfdInset: PfdInsetMode
  showMfdMenu: boolean
}

type UiActions = {
  setMapRangeNm: (rangeNm: number) => void
  toggleOverlay: (overlay: MapOverlay) => void
  setPfdInset: (mode: PfdInsetMode) => void
  setMfdMenuOpen: (open: boolean) => void
  reset: () => void
}

const defaultState: UiState = {
  mapRangeNm: 25,
  activeOverlays: ['terrain'],
  pfdInset: 'none',
  showMfdMenu: false,
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  ...defaultState,
  setMapRangeNm: (mapRangeNm) => set({ mapRangeNm }),
  toggleOverlay: (overlay) =>
    set((state) => ({
      activeOverlays: state.activeOverlays.includes(overlay)
        ? state.activeOverlays.filter((entry) => entry !== overlay)
        : [...state.activeOverlays, overlay],
    })),
  setPfdInset: (pfdInset) => set({ pfdInset }),
  setMfdMenuOpen: (showMfdMenu) => set({ showMfdMenu }),
  reset: () => set(defaultState),
}))

export const useMapRange = () => useUiStore((state) => state.mapRangeNm)
export const useActiveOverlays = () => useUiStore((state) => state.activeOverlays)
export const usePfdInset = () => useUiStore((state) => state.pfdInset)
export const useMfdMenuOpen = () => useUiStore((state) => state.showMfdMenu)
