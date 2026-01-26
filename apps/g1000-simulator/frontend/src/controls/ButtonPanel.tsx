type ButtonPanelButton = {
  id: string
  label: string
}

const BUTTONS: ButtonPanelButton[] = [
  { id: 'direct-to', label: 'DIR' },
  { id: 'menu', label: 'MENU' },
  { id: 'clr', label: 'CLR' },
  { id: 'ent', label: 'ENT' },
  { id: 'sync', label: 'SYNC' },
  { id: 'reset', label: 'RESET' },
]

type ButtonPanelProps = {
  onPress: (id: string) => void
  activeButtons?: string[]
}

export const ButtonPanel = ({ onPress, activeButtons = [] }: ButtonPanelProps) => {
  const activeSet = new Set(activeButtons)

  return (
    <div className="controls__buttons">
      {BUTTONS.map((button) => (
        <button
          key={button.id}
          className={`controls__button${activeSet.has(button.id) ? ' controls__button--active' : ''}`}
          type="button"
          onClick={() => onPress(button.id)}
        >
          {button.label}
        </button>
      ))}
    </div>
  )
}
