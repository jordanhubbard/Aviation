import { RotaryKnob } from './RotaryKnob'
import type { RotaryKnobDefinition } from './rotaryKnobMap'

type KnobControllerProps = {
  label: string
  knob: RotaryKnobDefinition
  value: number | null
  onStep: (delta: number) => void
}

export const KnobController = ({ label, knob, value, onStep }: KnobControllerProps) => {
  const displayValue = value === null ? '---' : `${value}${knob.unit ?? ''}`

  return (
    <div className="controls__knob">
      <div className="controls__knob-header">
        <span className="controls__knob-label">{label}</span>
        <span className="controls__knob-value">{displayValue}</span>
      </div>
      <RotaryKnob knob={knob} onStep={onStep} />
    </div>
  )
}
