import { useCursorStore } from '../stores/cursorStore'

export const JoystickPanel = () => {
  const { mode, focusTarget, lastAction, calibration, setCalibration } = useCursorStore((state) => ({
    mode: state.mode,
    focusTarget: state.focusTarget,
    lastAction: state.lastAction,
    calibration: state.calibration,
    setCalibration: state.setCalibration,
  }))

  return (
    <div className="controls__joystick">
      <div className="controls__joystick-header">
        <span className="controls__joystick-title">Joystick Cursor</span>
        <span
          className={`controls__joystick-mode${mode === 'active' ? ' controls__joystick-mode--active' : ''}`}
        >
          {mode === 'active' ? 'Active' : 'Standby'}
        </span>
      </div>
      <div className="controls__joystick-meta">
        <span>Focus: {focusTarget ?? '---'}</span>
        <span>Last: {lastAction ? lastAction.toUpperCase() : '---'}</span>
      </div>
      <div className="controls__joystick-slider">
        <label className="controls__joystick-label" htmlFor="cursor-deadzone">
          Deadzone
        </label>
        <input
          id="cursor-deadzone"
          type="range"
          min="0"
          max="0.4"
          step="0.01"
          value={calibration.deadzone}
          onChange={(event) =>
            setCalibration({
              ...calibration,
              deadzone: Number.parseFloat(event.target.value),
            })
          }
        />
        <span className="controls__joystick-value">{calibration.deadzone.toFixed(2)}</span>
      </div>
      <div className="controls__joystick-slider">
        <label className="controls__joystick-label" htmlFor="cursor-sensitivity">
          Sensitivity
        </label>
        <input
          id="cursor-sensitivity"
          type="range"
          min="0.5"
          max="2.5"
          step="0.05"
          value={calibration.sensitivity}
          onChange={(event) =>
            setCalibration({
              ...calibration,
              sensitivity: Number.parseFloat(event.target.value),
            })
          }
        />
        <span className="controls__joystick-value">{calibration.sensitivity.toFixed(2)}</span>
      </div>
    </div>
  )
}
