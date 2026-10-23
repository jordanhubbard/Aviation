import { useAutopilot } from '../stores/autopilotStore'

const lateralModes = ['ROL', 'HDG', 'NAV', 'APR', 'BC'] as const
const verticalModes = ['PIT', 'VS', 'ALT', 'ALTS', 'GS', 'GP'] as const

export const AutopilotPanel = () => {
  const {
    state,
    navAvailable,
    selectedAltitude,
    altitudeCaptureArmed,
    toggleMaster,
    setLateralMode,
    setVerticalMode,
    toggleApproachArmed,
    resetModes,
  } = useAutopilot()

  const isLateralDisabled = (mode: (typeof lateralModes)[number]) => {
    if (mode === 'NAV') return !navAvailable
    if (mode === 'APR') return !navAvailable || !state.approachArmed
    if (mode === 'BC') return !navAvailable || !state.approachArmed || state.lateralMode !== 'APR'
    return false
  }

  const isVerticalDisabled = (mode: (typeof verticalModes)[number]) => {
    if (mode === 'ALTS') return !altitudeCaptureArmed
    if (mode === 'GS' || mode === 'GP') {
      return (
        !navAvailable ||
        !state.approachArmed ||
        !(state.verticalMode === 'VS' || state.verticalMode === 'ALTS' || state.verticalMode === mode)
      )
    }
    return false
  }

  const altitudeLabel = selectedAltitude !== null ? Math.round(selectedAltitude).toString() : '---'

  return (
    <div className="autopilot">
      <div className="autopilot__header">
        <h3 className="autopilot__title">Autopilot Modes</h3>
        <button
          className={`autopilot__master${state.masterOn ? ' autopilot__master--on' : ''}`}
          type="button"
          onClick={toggleMaster}
        >
          AP
        </button>
      </div>
      <div className="autopilot__grid">
        <div className="autopilot__section">
          <span className="autopilot__label">Lateral</span>
          <div className="autopilot__buttons">
            {lateralModes.map((mode) => (
              <button
                key={mode}
                className={`autopilot__button${
                  state.lateralMode === mode ? ' autopilot__button--active' : ''
                }`}
                type="button"
                disabled={isLateralDisabled(mode)}
                onClick={() => setLateralMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="autopilot__section">
          <span className="autopilot__label">Vertical</span>
          <div className="autopilot__buttons">
            {verticalModes.map((mode) => (
              <button
                key={mode}
                className={`autopilot__button${
                  state.verticalMode === mode ? ' autopilot__button--active' : ''
                }`}
                type="button"
                disabled={isVerticalDisabled(mode)}
                onClick={() => setVerticalMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="autopilot__section">
        <span className="autopilot__label">Nav Inputs</span>
        <div className="autopilot__nav-controls">
          <span className={`autopilot__chip${navAvailable ? ' autopilot__chip--active' : ''}`}>FPL</span>
          <button
            type="button"
            className={`autopilot__button${state.approachArmed ? ' autopilot__button--active' : ''}`}
            onClick={toggleApproachArmed}
            disabled={!navAvailable}
          >
            APR ARM
          </button>
        </div>
      </div>
      <div className="autopilot__section">
        <span className="autopilot__label">Altitude Capture</span>
        <div className="autopilot__nav-controls">
          <span
            className={`autopilot__chip${altitudeCaptureArmed ? ' autopilot__chip--active' : ''}`}
          >
            ALT SEL {altitudeLabel}
          </span>
          <span
            className={`autopilot__chip${state.verticalMode === 'ALT' ? ' autopilot__chip--active' : ''}`}
          >
            ALT CAP
          </span>
        </div>
      </div>
      <button className="autopilot__reset" type="button" onClick={resetModes}>
        Reset Modes
      </button>
    </div>
  )
}
