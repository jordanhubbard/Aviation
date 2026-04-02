import { create } from 'zustand'

export type MfdPage =
  | 'map'
  | 'engine'
  | 'nearest'
  | 'flight-plan'
  | 'procedures'
  | 'trip'
  | 'menu'

export type MapOrientation = 'north-up' | 'track-up' | 'heading-up'

export const MAP_RANGE_OPTIONS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

const ORIENTATIONS: MapOrientation[] = ['north-up', 'track-up', 'heading-up']

type MfdState = {
  activePage: MfdPage
  mapRangeIndex: number
  mapOrientation: MapOrientation
}

type MfdActions = {
  setActivePage: (page: MfdPage) => void
  stepRange: (delta: number) => void
  cycleOrientation: (direction: number) => void
}

export const useMfdStore = create<MfdState & MfdActions>((set, get) => ({
  activePage: 'map',
  mapRangeIndex: Math.max(0, MAP_RANGE_OPTIONS.indexOf(20)),
  mapOrientation: 'north-up',
  setActivePage: (page) => set({ activePage: page }),
  stepRange: (delta) => {
    if (!Number.isFinite(delta) || delta === 0) return
    const { mapRangeIndex } = get()
    const nextIndex = Math.max(0, Math.min(MAP_RANGE_OPTIONS.length - 1, mapRangeIndex + delta))
    set({ mapRangeIndex: nextIndex })
  },
  cycleOrientation: (direction) => {
    if (!Number.isFinite(direction) || direction === 0) return
    const { mapOrientation } = get()
    const currentIndex = ORIENTATIONS.indexOf(mapOrientation)
    const nextIndex = (currentIndex + (direction > 0 ? 1 : -1) + ORIENTATIONS.length) % ORIENTATIONS.length
    set({ mapOrientation: ORIENTATIONS[nextIndex] })
  },
}))
