export const SOFTKEY_IDS = Array.from({ length: 12 }, (_, index) => `softkey-${index + 1}`)

export type SoftkeyId = (typeof SOFTKEY_IDS)[number]

export type PushButtonId =
  | 'direct-to'
  | 'menu'
  | 'fpl'
  | 'proc'
  | 'nrst'
  | 'clr'
  | 'ent'
  | 'com-flip'
  | 'nav-flip'
  | 'sync'
  | 'reset'

export type PushButtonAction =
  | 'open-direct-to'
  | 'open-menu'
  | 'open-flight-plan'
  | 'open-procedures'
  | 'open-nearest'
  | 'clear'
  | 'enter'
  | 'swap-com'
  | 'swap-nav'
  | 'sync-targets'
  | 'reset-targets'

export type PushButtonGroup = 'navigation' | 'radios' | 'system'

export type PushButtonDefinition = {
  id: PushButtonId
  label: string
  description: string
  action: PushButtonAction
  group: PushButtonGroup
}

export type PushButtonEventType = 'press' | 'long-press'

export type PushButtonAnnunciator = 'info' | 'caution' | 'warning'

export type PushButtonEvent = {
  button: PushButtonDefinition
  type: PushButtonEventType
}

export const PUSH_BUTTONS: PushButtonDefinition[] = [
  {
    id: 'direct-to',
    label: 'DIR',
    description: 'Open direct-to navigation',
    action: 'open-direct-to',
    group: 'navigation',
  },
  {
    id: 'menu',
    label: 'MENU',
    description: 'Open context menu',
    action: 'open-menu',
    group: 'navigation',
  },
  {
    id: 'fpl',
    label: 'FPL',
    description: 'Open flight plan',
    action: 'open-flight-plan',
    group: 'navigation',
  },
  {
    id: 'proc',
    label: 'PROC',
    description: 'Open procedures',
    action: 'open-procedures',
    group: 'navigation',
  },
  {
    id: 'nrst',
    label: 'NRST',
    description: 'Open nearest',
    action: 'open-nearest',
    group: 'navigation',
  },
  {
    id: 'clr',
    label: 'CLR',
    description: 'Clear entry',
    action: 'clear',
    group: 'navigation',
  },
  {
    id: 'ent',
    label: 'ENT',
    description: 'Confirm entry',
    action: 'enter',
    group: 'navigation',
  },
  {
    id: 'com-flip',
    label: 'COM',
    description: 'Swap COM active/standby',
    action: 'swap-com',
    group: 'radios',
  },
  {
    id: 'nav-flip',
    label: 'NAV',
    description: 'Swap NAV active/standby',
    action: 'swap-nav',
    group: 'radios',
  },
  {
    id: 'sync',
    label: 'SYNC',
    description: 'Sync targets to telemetry',
    action: 'sync-targets',
    group: 'system',
  },
  {
    id: 'reset',
    label: 'RESET',
    description: 'Reset simulator targets',
    action: 'reset-targets',
    group: 'system',
  },
]

export const SOFTKEYS = SOFTKEY_IDS.map((id, index) => ({
  id,
  label: `SK${index + 1}`,
  description: `Softkey ${index + 1}`,
}))
