type KnobControllerProps = {
  label: string
  value: number | null
  unit?: string
  coarseStep: number
  fineStep: number
  onStep: (delta: number) => void
}

export const KnobController = ({
  label,
  value,
  unit,
  coarseStep,
  fineStep,
  onStep,
}: KnobControllerProps) => {
  const displayValue = value === null ? '---' : `${value}${unit ?? ''}`

  return (
    <div className="controls__knob">
      <div className="controls__knob-header">
        <span className="controls__knob-label">{label}</span>
        <span className="controls__knob-value">{displayValue}</span>
      </div>
      <div className="controls__knob-actions">
        <button
          className="controls__knob-button"
          type="button"
          onClick={() => onStep(-coarseStep)}
          aria-label={`${label} decrease coarse`}
        >
          -{coarseStep}
        </button>
        <button
          className="controls__knob-button"
          type="button"
          onClick={() => onStep(coarseStep)}
          aria-label={`${label} increase coarse`}
        >
          +{coarseStep}
        </button>
        <button
          className="controls__knob-button controls__knob-button--fine"
          type="button"
          onClick={() => onStep(-fineStep)}
          aria-label={`${label} decrease fine`}
        >
          -{fineStep}
        </button>
        <button
          className="controls__knob-button controls__knob-button--fine"
          type="button"
          onClick={() => onStep(fineStep)}
          aria-label={`${label} increase fine`}
        >
          +{fineStep}
        </button>
      </div>
    </div>
  )
}
