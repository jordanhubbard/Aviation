import { createContext, useContext, useEffect, useState } from 'react'

import { useFlightPlanStore } from './flightPlanStore'
import { useFlightTelemetry } from './flightStore'

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
  selectedAltitude: number | null
  altitudeCaptureArmed: boolean
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

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const navModes: LateralMode[] = ['NAV', 'APR', 'BC']
const glideModes: VerticalMode[] = ['GS', 'GP']

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

const resolveVerticalMode = (
  current: VerticalMode,
  target: VerticalMode,
  altitudeCaptureArmed: boolean,
  altitudeCaptureActive: boolean,
  glideAvailable: boolean,
): VerticalMode => {
  if (target === 'PIT' || target === 'VS' || target === 'ALT') {
    return target
  }
  if (target === 'ALTS') {
    if (altitudeCaptureActive) return 'ALT'
    return altitudeCaptureArmed ? 'ALTS' : current
  }
  if (target === 'GS' || target === 'GP') {
    if (!glideAvailable) return current
    if (current === 'VS' || current === 'ALTS' || current === target) {
      return target
    }
  }
  return current
}

const AutopilotContext = createContext<AutopilotContextValue | null>(null)

export const AutopilotProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AutopilotState>(defaultState)
  const navAvailable = useFlightPlanStore(
    (store) => store.navigation.isActive && !store.navigation.isSuspended,
  )
  const telemetry = useFlightTelemetry()
  const selectedAltitude = isNumber(telemetry?.targets.altitude_ft)
    ? telemetry.targets.altitude_ft
    : null
  const currentAltitude = isNumber(telemetry?.position.altitude_ft)
    ? telemetry.position.altitude_ft
    : null
  const altitudeDelta =
    selectedAltitude !== null && currentAltitude !== null
      ? selectedAltitude - currentAltitude
      : null
  const altitudeDistance = altitudeDelta !== null ? Math.abs(altitudeDelta) : null
  const altitudeCaptureActive = altitudeDistance !== null && altitudeDistance <= 50
  const altitudeCaptureArmed = altitudeDistance !== null && altitudeDistance <= 1000

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
      verticalMode: resolveVerticalMode(
        prev.masterOn ? prev.verticalMode : 'PIT',
        mode,
        altitudeCaptureArmed,
        altitudeCaptureActive,
        navAvailable && prev.approachArmed,
      ),
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

  useEffect(() => {
    if (!altitudeCaptureArmed && !altitudeCaptureActive) return
    setState((prev) => {
      if (!prev.masterOn || glideModes.includes(prev.verticalMode)) {
        return prev
      }
      if (
        altitudeCaptureActive &&
        (prev.verticalMode === 'ALTS' || prev.verticalMode === 'VS' || prev.verticalMode === 'PIT')
      ) {
        return {
          ...prev,
          verticalMode: 'ALT',
        }
      }
      if (altitudeCaptureArmed && (prev.verticalMode === 'PIT' || prev.verticalMode === 'VS')) {
        return {
          ...prev,
          verticalMode: 'ALTS',
        }
      }
      return prev
    })
  }, [altitudeCaptureActive, altitudeCaptureArmed])

  useEffect(() => {
    if (navAvailable && state.approachArmed) return
    setState((prev) => {
      if (!glideModes.includes(prev.verticalMode)) {
        return prev
      }
      const fallback = altitudeCaptureArmed ? 'ALTS' : 'VS'
      return {
        ...prev,
        verticalMode: prev.masterOn ? fallback : prev.verticalMode,
      }
    })
  }, [navAvailable, state.approachArmed, altitudeCaptureArmed])

  const value: AutopilotContextValue = {
    state,
    navAvailable,
    selectedAltitude,
    altitudeCaptureArmed,
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
