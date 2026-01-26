import { useMemo, useState } from 'react'

import { SoftkeyBar, SoftkeyItem } from '../Shared/SoftkeyBar'

type RootMenuId = 'map' | 'engine' | 'nrst' | 'fpl' | 'proc' | 'menu'
type MenuId = 'root' | RootMenuId

const ROOT_MENU: Array<{ id: RootMenuId; label: string }> = [
  { id: 'map', label: 'MAP' },
  { id: 'engine', label: 'ENGINE' },
  { id: 'nrst', label: 'NRST' },
  { id: 'fpl', label: 'FPL' },
  { id: 'proc', label: 'PROC' },
  { id: 'menu', label: 'MENU' },
]

const SUB_MENUS: Record<RootMenuId, SoftkeyItem[]> = {
  map: [
    { id: 'range', label: 'RANGE', subLabel: 'MAP' },
    { id: 'topo', label: 'TOPO' },
    { id: 'weather', label: 'WX' },
    { id: 'traffic', label: 'TFC' },
    { id: 'data', label: 'DATA' },
  ],
  engine: [
    { id: 'lean', label: 'LEAN' },
    { id: 'system', label: 'SYSTEM' },
    { id: 'reset', label: 'RESET' },
    { id: 'data', label: 'DATA' },
    { id: 'config', label: 'CONFIG' },
  ],
  nrst: [
    { id: 'airport', label: 'APT' },
    { id: 'vor', label: 'VOR' },
    { id: 'ndb', label: 'NDB' },
    { id: 'int', label: 'INT' },
    { id: 'user', label: 'USER' },
  ],
  fpl: [
    { id: 'new', label: 'NEW' },
    { id: 'activate', label: 'ACTV' },
    { id: 'edit', label: 'EDIT' },
    { id: 'clr', label: 'CLR' },
    { id: 'load', label: 'LOAD' },
  ],
  proc: [
    { id: 'departure', label: 'DEP' },
    { id: 'arrival', label: 'ARR' },
    { id: 'approach', label: 'APR' },
    { id: 'alt', label: 'ALT' },
    { id: 'activate', label: 'ACTV' },
  ],
  menu: [
    { id: 'pfd', label: 'PFD' },
    { id: 'mfd', label: 'MFD' },
    { id: 'audio', label: 'AUDIO' },
    { id: 'alerts', label: 'ALERTS' },
    { id: 'setup', label: 'SETUP' },
  ],
}

export const MenuSystem = () => {
  const [activeMenu, setActiveMenu] = useState<MenuId>('root')
  const [activeRoot, setActiveRoot] = useState<RootMenuId>('map')

  const items = useMemo(() => {
    if (activeMenu === 'root') {
      return ROOT_MENU.map((item) => ({
        id: item.id,
        label: item.label,
        active: item.id === activeRoot,
        onPress: () => {
          setActiveRoot(item.id)
          setActiveMenu(item.id)
        },
      }))
    }

    const submenuItems = SUB_MENUS[activeMenu].map((item) => ({
      ...item,
      onPress: () => {
        setActiveRoot(activeMenu)
      },
    }))

    submenuItems.push({
      id: 'back',
      label: 'BACK',
      onPress: () => setActiveMenu('root'),
    })

    return submenuItems
  }, [activeMenu, activeRoot])

  return <SoftkeyBar items={items} ariaLabel="MFD softkeys" />
}
