import { PUSH_BUTTONS, PushButtonDefinition, PushButtonId } from './pushButtonMap'

type ButtonPanelProps = {
  onPress: (button: PushButtonDefinition) => void
  activeButtons?: PushButtonId[]
}

export const ButtonPanel = ({ onPress, activeButtons = [] }: ButtonPanelProps) => {
  const activeSet = new Set(activeButtons)

  return (
    <div className="controls__buttons">
      {PUSH_BUTTONS.map((button) => (
        <button
          key={button.id}
          className={`controls__button${activeSet.has(button.id) ? ' controls__button--active' : ''}`}
          type="button"
          onClick={() => onPress(button)}
        >
          {button.label}
        </button>
      ))}
    </div>
  )
}
