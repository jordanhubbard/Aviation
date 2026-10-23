export type ApproachType = 'GPS' | 'ILS' | 'VOR' | 'RNAV'

export type ApproachState = {
  selectedApproach: string | null
  approachType: ApproachType | null
  isArmed: boolean
  isCaptured: boolean
  hasGlideslope: boolean
}

const glideApproachTypes: ApproachType[] = ['ILS', 'GPS']

const buildInitialState = (): ApproachState => ({
  selectedApproach: null,
  approachType: null,
  isArmed: false,
  isCaptured: false,
  hasGlideslope: false,
})

const computeHasGlideslope = (type: ApproachType | null): boolean => {
  return type !== null && glideApproachTypes.includes(type)
}

export type ApproachService = {
  selectApproach(name: string, type: ApproachType): ApproachState
  armApproach(): ApproachState
  captureApproach(): ApproachState
  cancelApproach(): ApproachState
  getState(): ApproachState
  hasGlideslope(): boolean
}

export function createApproachService(): ApproachService {
  let state: ApproachState = buildInitialState()

  return {
    selectApproach(name: string, type: ApproachType): ApproachState {
      state = {
        selectedApproach: name,
        approachType: type,
        isArmed: false,
        isCaptured: false,
        hasGlideslope: computeHasGlideslope(type),
      }
      return { ...state }
    },

    armApproach(): ApproachState {
      if (!state.selectedApproach) {
        return { ...state }
      }
      state = {
        ...state,
        isArmed: true,
        isCaptured: false,
      }
      return { ...state }
    },

    captureApproach(): ApproachState {
      if (!state.isArmed) {
        return { ...state }
      }
      state = {
        ...state,
        isCaptured: true,
      }
      return { ...state }
    },

    cancelApproach(): ApproachState {
      state = buildInitialState()
      return { ...state }
    },

    getState(): ApproachState {
      return { ...state }
    },

    hasGlideslope(): boolean {
      return state.hasGlideslope
    },
  }
}
