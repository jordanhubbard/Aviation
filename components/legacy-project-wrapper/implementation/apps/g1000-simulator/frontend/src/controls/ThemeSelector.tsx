import type { DisplayTheme } from '../stores/uiStore'
import { useThemePreference, useUiStore } from '../stores/uiStore'

const THEME_OPTIONS: Array<{ id: DisplayTheme; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
  { id: 'high-contrast', label: 'High Contrast' },
]

export const ThemeSelector = () => {
  const theme = useThemePreference()
  const setTheme = useUiStore((state) => state.setTheme)

  return (
    <div className="theme-selector">
      <label className="theme-selector__label" htmlFor="theme-select">
        Theme
      </label>
      <select
        id="theme-select"
        className="theme-selector__select"
        value={theme}
        onChange={(event) => setTheme(event.target.value as DisplayTheme)}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
