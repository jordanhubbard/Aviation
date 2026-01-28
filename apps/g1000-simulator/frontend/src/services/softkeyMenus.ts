export type SoftkeyContext = 'pfd' | 'mfd'

export type SoftkeyMenuItem = {
  id: string
  label: string
  subLabel?: string
  actionId?: string
  action?: (context: SoftkeyContext) => void
  submenu?: SoftkeyMenu
  toggle?: boolean
  state?: boolean
  disabled?: boolean
}

export type SoftkeyMenu = {
  id: string
  title: string
  items: SoftkeyMenuItem[]
  parent?: SoftkeyMenu
}

const linkMenus = (menu: SoftkeyMenu) => {
  menu.items.forEach((item) => {
    if (item.submenu) {
      item.submenu.parent = menu
      linkMenus(item.submenu)
    }
  })
  return menu
}

const mapSettingsMenu: SoftkeyMenu = {
  id: 'mfd-map-settings',
  title: 'Map Settings',
  items: [
    { id: 'terrain', label: 'TERR', toggle: true, state: true },
    { id: 'airspace', label: 'AIRSPC', toggle: true, state: false },
    { id: 'data', label: 'DATA', toggle: true, state: true },
    { id: 'declutter', label: 'DECLUT', toggle: true, state: false },
  ],
}

const mapMenu: SoftkeyMenu = {
  id: 'mfd-map',
  title: 'Map',
  items: [
    { id: 'range', label: 'RANGE', actionId: 'mfd-map-range' },
    { id: 'settings', label: 'SETUP', submenu: mapSettingsMenu },
    { id: 'traffic', label: 'TFC', toggle: true, state: true },
    { id: 'weather', label: 'WX', toggle: true, state: false },
  ],
}

const engineConfigMenu: SoftkeyMenu = {
  id: 'mfd-engine-config',
  title: 'Engine Config',
  items: [
    { id: 'temps', label: 'TEMPS', toggle: true, state: true },
    { id: 'fuel', label: 'FUEL', toggle: true, state: true },
    { id: 'elect', label: 'ELEC', toggle: true, state: false },
    { id: 'press', label: 'PRESS', toggle: true, state: false },
  ],
}

const engineMenu: SoftkeyMenu = {
  id: 'mfd-engine',
  title: 'Engine',
  items: [
    { id: 'lean', label: 'LEAN', actionId: 'mfd-engine-lean' },
    { id: 'system', label: 'SYSTEM', actionId: 'mfd-engine-system' },
    { id: 'reset', label: 'RESET', actionId: 'mfd-engine-reset' },
    { id: 'config', label: 'CONFIG', submenu: engineConfigMenu },
  ],
}

const nearestMenu: SoftkeyMenu = {
  id: 'mfd-nrst',
  title: 'Nearest',
  items: [
    { id: 'airport', label: 'APT', actionId: 'mfd-nrst-airport' },
    { id: 'vor', label: 'VOR', actionId: 'mfd-nrst-vor' },
    { id: 'ndb', label: 'NDB', actionId: 'mfd-nrst-ndb' },
    { id: 'int', label: 'INT', actionId: 'mfd-nrst-int' },
  ],
}

const flightPlanMenu: SoftkeyMenu = {
  id: 'mfd-fpl',
  title: 'Flight Plan',
  items: [
    { id: 'new', label: 'NEW', actionId: 'mfd-fpl-new' },
    { id: 'activate', label: 'ACTV', actionId: 'mfd-fpl-activate' },
    { id: 'edit', label: 'EDIT', actionId: 'mfd-fpl-edit' },
    { id: 'load', label: 'LOAD', actionId: 'mfd-fpl-load' },
  ],
}

const proceduresMenu: SoftkeyMenu = {
  id: 'mfd-proc',
  title: 'Procedures',
  items: [
    { id: 'departure', label: 'DEP', actionId: 'mfd-proc-departure' },
    { id: 'arrival', label: 'ARR', actionId: 'mfd-proc-arrival' },
    { id: 'approach', label: 'APR', actionId: 'mfd-proc-approach' },
    { id: 'activate', label: 'ACTV', actionId: 'mfd-proc-activate' },
  ],
}

const menuMenu: SoftkeyMenu = {
  id: 'mfd-menu',
  title: 'Menu',
  items: [
    { id: 'pfd', label: 'PFD', actionId: 'mfd-menu-pfd' },
    { id: 'mfd', label: 'MFD', actionId: 'mfd-menu-mfd' },
    { id: 'audio', label: 'AUDIO', actionId: 'mfd-menu-audio' },
    { id: 'alerts', label: 'ALERTS', actionId: 'mfd-menu-alerts' },
  ],
}

const MFD_ROOT_MENU: SoftkeyMenu = linkMenus({
  id: 'mfd-root',
  title: 'MFD',
  items: [
    { id: 'map', label: 'MAP', submenu: mapMenu },
    { id: 'engine', label: 'ENGINE', submenu: engineMenu },
    { id: 'nrst', label: 'NRST', submenu: nearestMenu },
    { id: 'fpl', label: 'FPL', submenu: flightPlanMenu },
    { id: 'proc', label: 'PROC', submenu: proceduresMenu },
    { id: 'menu', label: 'MENU', submenu: menuMenu },
  ],
})

const pfdSettingsMenu: SoftkeyMenu = {
  id: 'pfd-settings',
  title: 'PFD Settings',
  items: [
    { id: 'baro', label: 'BARO', toggle: true, state: true },
    { id: 'alerts', label: 'ALERTS', toggle: true, state: true },
    { id: 'vnav', label: 'VNAV', toggle: true, state: false },
    { id: 'refs', label: 'REFS', toggle: true, state: false },
  ],
}

const pfdMenu: SoftkeyMenu = {
  id: 'pfd-menu',
  title: 'PFD Menu',
  items: [
    { id: 'wind', label: 'WIND', toggle: true, state: true },
    { id: 'alt', label: 'ALT', toggle: true, state: true },
    { id: 'hsi', label: 'HSI', toggle: true, state: false },
    { id: 'settings', label: 'SET', submenu: pfdSettingsMenu },
  ],
}

const PFD_ROOT_MENU: SoftkeyMenu = linkMenus({
  id: 'pfd-root',
  title: 'PFD',
  items: [
    { id: 'pfd', label: 'PFD', submenu: pfdMenu },
    { id: 'inset', label: 'INSET', actionId: 'pfd-inset' },
    { id: 'obs', label: 'OBS', actionId: 'pfd-obs' },
    { id: 'cdi', label: 'CDI', actionId: 'pfd-cdi' },
    { id: 'dme', label: 'DME', actionId: 'pfd-dme' },
    { id: 'timer', label: 'TMR', actionId: 'pfd-timer' },
  ],
})

export const SOFTKEY_MENUS: Record<SoftkeyContext, SoftkeyMenu> = {
  pfd: PFD_ROOT_MENU,
  mfd: MFD_ROOT_MENU,
}
