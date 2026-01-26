import { useAutopilot } from '../../stores/autopilotStore'

export const AutopilotStatus = () => {
  const { state } = useAutopilot()

  return (
    <div className="pfd__autopilot" data-testid="autopilot-status">
      <span
        className={`pfd__autopilot-master${state.masterOn ? ' pfd__autopilot-master--on' : ''}`}
      >
        AP
      </span>
      <span className="pfd__autopilot-mode">LAT {state.lateralMode}</span>
      <span className="pfd__autopilot-mode">VERT {state.verticalMode}</span>
    </div>
  )
}
