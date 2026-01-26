import { useAutopilot } from '../stores/autopilotStore'

const lateralModes = ['ROL', 'HDG', 'NAV', 'APR', 'BC'] as const
const verticalModes = ['PIT', 'VS', 'ALT', 'ALTS', 'GS', 'GP'] as const

export const AutopilotPanel = () => {
  const { state, toggleMaster, setLateralMode, setVerticalMode, resetModes } = useAutopilot()

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
                onClick={() => setVerticalMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="autopilot__reset" type="button" onClick={resetModes}>
        Reset Modes
      </button>
    </div>
  )
}
