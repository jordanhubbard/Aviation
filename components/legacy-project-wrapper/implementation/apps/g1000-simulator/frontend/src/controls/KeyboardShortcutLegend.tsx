import { useMemo } from 'react'

import { formatKeymapBinding } from '../hooks/keyboardUtils'
import { useKeymapStore } from '../stores/keymapStore'

const formatLegendItem = (label: string, description: string) =>
  description ? `${label} (${description})` : label

export const KeyboardShortcutLegend = () => {
  const keymapEntries = useKeymapStore((state) => state.entries)

  const legendItems = useMemo(() => {
    return keymapEntries
      .filter((entry) => entry.legend)
      .map((entry) => `${formatKeymapBinding(entry.binding)} ${formatLegendItem(entry.label, entry.description)}`)
  }, [keymapEntries])

  if (legendItems.length === 0) return null

  return <div className="controls__shortcuts">Shortcuts: {legendItems.join(' · ')}</div>
}
