import { createElement } from 'react'

/** Context passes to the shared application view; provider credentials stay server-side. */
export default function AviationDataPanel({ airports, validAt }: { airports: string[]; validAt?: string | null }) {
  return createElement('aviation-data-panel', {
    airports: airports.filter(Boolean).join(' '),
    'valid-at': validAt || '',
  })
}
