import { CURSOR_SHORTCUTS } from '../hooks/useCursorInput'
import type { KeyboardShortcutLegendItem } from '../hooks/useKeyboardBindings'

import { AUTOPILOT_SHORTCUTS } from './KeyboardShortcuts'

const formatShortcut = (shortcut: KeyboardShortcutLegendItem) =>
  `${shortcut.label} ${shortcut.description}`

export const KeyboardShortcutLegend = () => {
  const items = [...AUTOPILOT_SHORTCUTS, ...CURSOR_SHORTCUTS]
  return <div className="controls__shortcuts">{items.map(formatShortcut).join(' · ')}</div>
}
