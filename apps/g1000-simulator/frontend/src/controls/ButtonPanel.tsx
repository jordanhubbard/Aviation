import { PushButton } from './PushButton'
import { PUSH_BUTTONS, PushButtonEvent, PushButtonId } from './pushButtonMap'

type ButtonPanelProps = {
  onEvent: (event: PushButtonEvent) => void
  activeButtons?: PushButtonId[]
  disabledButtons?: PushButtonId[]
  guardedButtons?: PushButtonId[]
}

export const ButtonPanel = ({
  onEvent,
  activeButtons = [],
  disabledButtons = [],
  guardedButtons = [],
}: ButtonPanelProps) => {
  const activeSet = new Set(activeButtons)
  const disabledSet = new Set(disabledButtons)
  const guardedSet = new Set(guardedButtons)

  return (
    <div className="controls__buttons">
      {PUSH_BUTTONS.map((button) => (
        <PushButton
          key={button.id}
          button={button}
          active={activeSet.has(button.id)}
          disabled={disabledSet.has(button.id)}
          guarded={guardedSet.has(button.id)}
          onPress={(entry) => onEvent({ button: entry, type: 'press' })}
          onLongPress={(entry) => onEvent({ button: entry, type: 'long-press' })}
        />
      ))}
    </div>
  )
}
