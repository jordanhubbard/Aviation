import { createContext, useContext, useMemo, useState } from 'react'

export type LateralMode = 'ROL' | 'HDG' | 'NAV' | 'APR' | 'BC'
export type VerticalMode = 'PIT' | 'VS' | 'ALT' | 'ALTS' | 'GS' | 'GP'

export type AutopilotState = {
  masterOn: boolean
  lateralMode: LateralMode
  verticalMode: VerticalMode
}

type AutopilotContextValue = {
  state: AutopilotState
  toggleMaster: () => void
  setLateralMode: (mode: LateralMode) => void
  setVerticalMode: (mode: VerticalMode) => void
  resetModes: () => void
}

const defaultState: AutopilotState = {
  masterOn: false,
  lateralMode: 'ROL',
  verticalMode: 'PIT',
}

const AutopilotContext = createContext<AutopilotContextValue | null>(null)

export const AutopilotProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AutopilotState>(defaultState)

  const toggleMaster = () => {
    setState((prev) => ({
      ...prev,
      masterOn: !prev.masterOn,
    }))
  }

  const setLateralMode = (mode: LateralMode) => {
    setState((prev) => ({
      ...prev,
      masterOn: true,
      lateralMode: mode,
    }))
  }

  const setVerticalMode = (mode: VerticalMode) => {
    setState((prev) => ({
      ...prev,
      masterOn: true,
      verticalMode: mode,
    }))
  }

  const resetModes = () => {
    setState(defaultState)
  }

  const value = useMemo(
    () => ({ state, toggleMaster, setLateralMode, setVerticalMode, resetModes }),
    [state],
  )

  return <AutopilotContext.Provider value={value}>{children}</AutopilotContext.Provider>
}

export const useAutopilot = () => {
  const context = useContext(AutopilotContext)
  if (!context) {
    throw new Error('useAutopilot must be used within AutopilotProvider')
  }
  return context
}
