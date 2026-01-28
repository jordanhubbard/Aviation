import { PushButton } from './PushButton'
import {
  PUSH_BUTTONS,
  PushButtonAnnunciator,
  PushButtonEvent,
  PushButtonId,
} from './pushButtonMap'

type ButtonPanelProps = {
  onEvent: (event: PushButtonEvent) => void
  activeButtons?: PushButtonId[]
  backlitButtons?: PushButtonId[]
  disabledButtons?: PushButtonId[]
  guardedButtons?: PushButtonId[]
  annunciatorButtons?: Partial<Record<PushButtonId, PushButtonAnnunciator>>
}

export const ButtonPanel = ({
  onEvent,
  activeButtons = [],
  backlitButtons = [],
  disabledButtons = [],
  guardedButtons = [],
  annunciatorButtons = {},
}: ButtonPanelProps) => {
  const activeSet = new Set(activeButtons)
  const backlitSet = new Set(backlitButtons)
  const disabledSet = new Set(disabledButtons)
  const guardedSet = new Set(guardedButtons)

  return (
    <div className="controls__buttons">
      {PUSH_BUTTONS.map((button) => (
        <PushButton
          key={button.id}
          button={button}
          active={activeSet.has(button.id)}
          backlit={backlitSet.has(button.id)}
          disabled={disabledSet.has(button.id)}
          guarded={guardedSet.has(button.id)}
          annunciator={annunciatorButtons[button.id]}
          onPress={(entry) => onEvent({ button: entry, type: 'press' })}
          onLongPress={(entry) => onEvent({ button: entry, type: 'long-press' })}
        />
      ))}
    </div>
  )
}
