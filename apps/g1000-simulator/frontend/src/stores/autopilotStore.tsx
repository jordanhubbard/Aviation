import { createContext, useContext, useEffect, useState } from 'react'

import { useFlightPlanStore } from './flightPlanStore'

export type LateralMode = 'ROL' | 'HDG' | 'NAV' | 'APR' | 'BC'
export type VerticalMode = 'PIT' | 'VS' | 'ALT' | 'ALTS' | 'GS' | 'GP'

export type AutopilotState = {
  masterOn: boolean
  lateralMode: LateralMode
  verticalMode: VerticalMode
  approachArmed: boolean
}

type AutopilotContextValue = {
  state: AutopilotState
  navAvailable: boolean
  toggleMaster: () => void
  setLateralMode: (mode: LateralMode) => void
  setVerticalMode: (mode: VerticalMode) => void
  toggleApproachArmed: () => void
  resetModes: () => void
}

const defaultState: AutopilotState = {
  masterOn: false,
  lateralMode: 'ROL',
  verticalMode: 'PIT',
  approachArmed: false,
}

const navModes: LateralMode[] = ['NAV', 'APR', 'BC']

const resolveLateralMode = (
  current: LateralMode,
  target: LateralMode,
  navAvailable: boolean,
  approachArmed: boolean,
): LateralMode => {
  if (target === 'ROL' || target === 'HDG') {
    return target
  }
  if (target === 'NAV') {
    return navAvailable ? 'NAV' : current
  }
  if (!navAvailable || !approachArmed) {
    return current
  }
  if (target === 'APR') {
    return current === 'NAV' || current === 'APR' ? 'APR' : 'NAV'
  }
  if (target === 'BC') {
    return current === 'APR' || current === 'BC' ? 'BC' : current
  }
  return current
}

const AutopilotContext = createContext<AutopilotContextValue | null>(null)

export const AutopilotProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AutopilotState>(defaultState)
  const navAvailable = useFlightPlanStore(
    (store) => store.navigation.isActive && !store.navigation.isSuspended,
  )

  const toggleMaster = () => {
    setState((prev) => ({
      ...prev,
      masterOn: prev.masterOn ? false : true,
      lateralMode: prev.masterOn ? prev.lateralMode : 'ROL',
      verticalMode: prev.masterOn ? prev.verticalMode : 'PIT',
    }))
  }

  const setLateralMode = (mode: LateralMode) => {
    setState((prev) => ({
      ...prev,
      masterOn: true,
      lateralMode: resolveLateralMode(
        prev.masterOn ? prev.lateralMode : 'ROL',
        mode,
        navAvailable,
        prev.approachArmed,
      ),
    }))
  }

  const setVerticalMode = (mode: VerticalMode) => {
    setState((prev) => ({
      ...prev,
      masterOn: true,
      verticalMode: mode,
    }))
  }

  const toggleApproachArmed = () => {
    if (!navAvailable) return
    setState((prev) => {
      const approachArmed = !prev.approachArmed
      const requiresApproach = prev.lateralMode === 'APR' || prev.lateralMode === 'BC'
      const fallback = navAvailable ? 'NAV' : 'ROL'
      return {
        ...prev,
        approachArmed,
        lateralMode: !approachArmed && requiresApproach ? fallback : prev.lateralMode,
      }
    })
  }

  const resetModes = () => {
    setState(defaultState)
  }

  useEffect(() => {
    if (navAvailable) return
    setState((prev) => {
      if (!prev.approachArmed && !navModes.includes(prev.lateralMode)) {
        return prev
      }
      return {
        ...prev,
        approachArmed: false,
        lateralMode: navModes.includes(prev.lateralMode) && prev.masterOn ? 'ROL' : prev.lateralMode,
      }
    })
  }, [navAvailable])

  const value: AutopilotContextValue = {
    state,
    navAvailable,
    toggleMaster,
    setLateralMode,
    setVerticalMode,
    toggleApproachArmed,
    resetModes,
  }

  return <AutopilotContext.Provider value={value}>{children}</AutopilotContext.Provider>
}

export const useAutopilot = () => {
  const context = useContext(AutopilotContext)
  if (!context) {
    throw new Error('useAutopilot must be used within AutopilotProvider')
  }
  return context
}
