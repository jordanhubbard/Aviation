import { SoftkeyBar } from './SoftkeyBar'
import { useSoftkeyMenu } from '../../stores/softkeyStore'
import type { SoftkeyContext } from '../../services/softkeyMenus'

type SoftkeyMenuSystemProps = {
  context: SoftkeyContext
  ariaLabel?: string
}

export const SoftkeyMenuSystem = ({ context, ariaLabel }: SoftkeyMenuSystemProps) => {
  const items = useSoftkeyMenu(context)
  const label = ariaLabel ?? `${context.toUpperCase()} softkeys`

  return <SoftkeyBar items={items} ariaLabel={label} />
}
