export type SoftkeyItem = {
  id: string
  label: string
  subLabel?: string
  active?: boolean
  disabled?: boolean
  onPress?: () => void
}

type SoftkeyBarProps = {
  items: SoftkeyItem[]
  ariaLabel?: string
}

export const SoftkeyBar = ({ items, ariaLabel = 'Softkey menu' }: SoftkeyBarProps) => {
  return (
    <div className="softkeys" role="toolbar" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          className={`softkeys__key${item.active ? ' softkeys__key--active' : ''}`}
          type="button"
          onClick={item.onPress}
          disabled={item.disabled}
          aria-pressed={item.active}
        >
          <span className="softkeys__key-label">{item.label}</span>
          {item.subLabel ? (
            <span className="softkeys__key-sublabel">{item.subLabel}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
