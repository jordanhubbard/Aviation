import { useMfdStore } from '../stores/mfdStore'

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

const setMfdPage = (page: 'map' | 'engine' | 'nearest' | 'flight-plan' | 'procedures' | 'trip' | 'menu') => {
  useMfdStore.getState().setActivePage(page)
}

const mapSettingsMenu: SoftkeyMenu = {
  id: 'mfd-map-settings',
  title: 'Map Settings',
  items: [
    { id: 'terrain', label: 'TERR', toggle: true, state: true },
    { id: 'airspace', label: 'AIRSPC', toggle: true, state: false },
    { id: 'data', label: 'DATA', toggle: true, state: true },
    { id: 'declutter', label: 'DECLUT', toggle: true, state: false },
    { id: 'wind', label: 'WIND', toggle: true, state: false },
    { id: 'ltng', label: 'LTNG', toggle: true, state: false },
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
    { id: 'airport', label: 'APT', actionId: 'mfd-nrst-airport', action: () => setMfdPage('nearest') },
    { id: 'vor', label: 'VOR', actionId: 'mfd-nrst-vor', action: () => setMfdPage('nearest') },
    { id: 'ndb', label: 'NDB', actionId: 'mfd-nrst-ndb', action: () => setMfdPage('nearest') },
    { id: 'int', label: 'INT', actionId: 'mfd-nrst-int', action: () => setMfdPage('nearest') },
  ],
}

const flightPlanMenu: SoftkeyMenu = {
  id: 'mfd-fpl',
  title: 'Flight Plan',
  items: [
    { id: 'new', label: 'NEW', actionId: 'mfd-fpl-new', action: () => setMfdPage('flight-plan') },
    { id: 'activate', label: 'ACTV', actionId: 'mfd-fpl-activate', action: () => setMfdPage('flight-plan') },
    { id: 'direct', label: 'DIR', actionId: 'mfd-fpl-direct', action: () => setMfdPage('flight-plan') },
    { id: 'invert', label: 'INVT', actionId: 'mfd-fpl-invert', action: () => setMfdPage('flight-plan') },
    { id: 'suspend', label: 'SUSP', actionId: 'mfd-fpl-suspend', action: () => setMfdPage('flight-plan') },
    { id: 'load', label: 'LOAD', actionId: 'mfd-fpl-load', action: () => setMfdPage('flight-plan') },
  ],
}

const proceduresMenu: SoftkeyMenu = {
  id: 'mfd-proc',
  title: 'Procedures',
  items: [
    { id: 'departure', label: 'DEP', actionId: 'mfd-proc-departure', action: () => setMfdPage('procedures') },
    { id: 'arrival', label: 'ARR', actionId: 'mfd-proc-arrival', action: () => setMfdPage('procedures') },
    { id: 'approach', label: 'APR', actionId: 'mfd-proc-approach', action: () => setMfdPage('procedures') },
    { id: 'activate', label: 'ACTV', actionId: 'mfd-proc-activate', action: () => setMfdPage('procedures') },
  ],
}

const menuMenu: SoftkeyMenu = {
  id: 'mfd-menu',
  title: 'Menu',
  items: [
    { id: 'pfd', label: 'PFD', actionId: 'mfd-menu-pfd', action: () => setMfdPage('map') },
    { id: 'mfd', label: 'MFD', actionId: 'mfd-menu-mfd', action: () => setMfdPage('menu') },
    { id: 'audio', label: 'AUDIO', actionId: 'mfd-menu-audio' },
    { id: 'alerts', label: 'ALERTS', actionId: 'mfd-menu-alerts' },
    { id: 'aux', label: 'AUX', actionId: 'mfd-menu-aux', action: () => setMfdPage('trip') },
  ],
}

const MFD_ROOT_MENU: SoftkeyMenu = linkMenus({
  id: 'mfd-root',
  title: 'MFD',
  items: [
    { id: 'map', label: 'MAP', submenu: mapMenu, action: () => setMfdPage('map') },
    { id: 'engine', label: 'ENGINE', submenu: engineMenu, action: () => setMfdPage('engine') },
    { id: 'nrst', label: 'NRST', submenu: nearestMenu, action: () => setMfdPage('nearest') },
    { id: 'fpl', label: 'FPL', submenu: flightPlanMenu, action: () => setMfdPage('flight-plan') },
    { id: 'proc', label: 'PROC', submenu: proceduresMenu, action: () => setMfdPage('procedures') },
    { id: 'menu', label: 'MENU', submenu: menuMenu, action: () => setMfdPage('menu') },
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
