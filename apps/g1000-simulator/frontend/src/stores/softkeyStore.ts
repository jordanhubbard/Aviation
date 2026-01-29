import { useMemo } from 'react'
import { create } from 'zustand'

import { SOFTKEY_MENUS, SoftkeyContext, SoftkeyMenu } from '../services/softkeyMenus'
import type { SoftkeyItem } from '../displays/Shared/SoftkeyBar'

type SoftkeyContextState = {
  stack: SoftkeyMenu[]
  activeRootId: string
  toggleStates: Record<string, boolean>
  lastAction: string | null
}

type SoftkeyStoreState = {
  contexts: Record<SoftkeyContext, SoftkeyContextState>
  pressItem: (context: SoftkeyContext, itemId: string) => void
  goBack: (context: SoftkeyContext) => void
  goHome: (context: SoftkeyContext) => void
  setToggleState: (
    context: SoftkeyContext,
    menuId: string,
    itemId: string,
    nextState: boolean,
  ) => void
}

const buildToggleKey = (context: SoftkeyContext, menuId: string, itemId: string) =>
  `${context}:${menuId}:${itemId}`

const collectToggleStates = (
  context: SoftkeyContext,
  menu: SoftkeyMenu,
  states: Record<string, boolean> = {},
) => {
  menu.items.forEach((item) => {
    if (item.toggle) {
      states[buildToggleKey(context, menu.id, item.id)] = item.state ?? false
    }
    if (item.submenu) {
      collectToggleStates(context, item.submenu, states)
    }
  })
  return states
}

const createContextState = (context: SoftkeyContext, rootMenu: SoftkeyMenu): SoftkeyContextState => ({
  stack: [rootMenu],
  activeRootId: rootMenu.items[0]?.id ?? 'root',
  toggleStates: collectToggleStates(context, rootMenu),
  lastAction: null,
})

const getActiveMenu = (contextState: SoftkeyContextState) =>
  contextState.stack[contextState.stack.length - 1]

export const useSoftkeyStore = create<SoftkeyStoreState>((set, get) => ({
  contexts: {
    pfd: createContextState('pfd', SOFTKEY_MENUS.pfd),
    mfd: createContextState('mfd', SOFTKEY_MENUS.mfd),
  },
  pressItem: (context, itemId) => {
    const { contexts } = get()
    const contextState = contexts[context]
    const rootMenu = SOFTKEY_MENUS[context]
    const activeMenu = getActiveMenu(contextState)
    const item = activeMenu.items.find((entry) => entry.id === itemId)
    if (!item || item.disabled) return

    if (item.action) {
      item.action(context)
    }

    const nextContext: SoftkeyContextState = {
      ...contextState,
      stack: [...contextState.stack],
    }

    if (activeMenu === rootMenu) {
      nextContext.activeRootId = item.id
    }

    if (item.submenu) {
      nextContext.stack.push(item.submenu)
    } else {
      if (item.toggle) {
        const key = buildToggleKey(context, activeMenu.id, item.id)
        const current = nextContext.toggleStates[key] ?? false
        nextContext.toggleStates = { ...nextContext.toggleStates, [key]: !current }
      }
      if (item.actionId || item.toggle) {
        nextContext.lastAction = item.actionId ?? item.label
      }
    }

    set({ contexts: { ...contexts, [context]: nextContext } })
  },
  goBack: (context) => {
    set((state) => {
      const contextState = state.contexts[context]
      if (contextState.stack.length <= 1) return state
      return {
        contexts: {
          ...state.contexts,
          [context]: {
            ...contextState,
            stack: contextState.stack.slice(0, -1),
          },
        },
      }
    })
  },
  goHome: (context) => {
    set((state) => {
      const contextState = state.contexts[context]
      const rootMenu = SOFTKEY_MENUS[context]
      if (contextState.stack.length === 1) return state
      return {
        contexts: {
          ...state.contexts,
          [context]: {
            ...contextState,
            stack: [rootMenu],
          },
        },
      }
    })
  },
  setToggleState: (context, menuId, itemId, nextState) => {
    set((state) => {
      const contextState = state.contexts[context]
      const toggleKey = buildToggleKey(context, menuId, itemId)
      return {
        contexts: {
          ...state.contexts,
          [context]: {
            ...contextState,
            toggleStates: {
              ...contextState.toggleStates,
              [toggleKey]: nextState,
            },
          },
        },
      }
    })
  },
}))

const buildDisplayItems = (
  context: SoftkeyContext,
  contextState: SoftkeyContextState,
  pressItem: (context: SoftkeyContext, itemId: string) => void,
  goBack: (context: SoftkeyContext) => void,
  goHome: (context: SoftkeyContext) => void,
) => {
  const rootMenu = SOFTKEY_MENUS[context]
  const activeMenu = getActiveMenu(contextState)
  const isRoot = activeMenu === rootMenu
  const navigationItems: SoftkeyItem[] = isRoot
    ? []
    : [
        {
          id: `${context}-back`,
          label: 'BACK',
          onPress: () => goBack(context),
        },
        {
          id: `${context}-home`,
          label: 'HOME',
          onPress: () => goHome(context),
        },
      ]

  const availableSlots = Math.max(0, 6 - navigationItems.length)
  const baseItems = activeMenu.items.slice(0, availableSlots)
  const merged = [...baseItems, ...navigationItems]

  const items: SoftkeyItem[] = merged.map((item) => {
    if ('onPress' in item) {
      return item as SoftkeyItem
    }
    const toggleKey = buildToggleKey(context, activeMenu.id, item.id)
    const toggleState = contextState.toggleStates[toggleKey] ?? false
    const active = isRoot ? item.id === contextState.activeRootId : item.toggle ? toggleState : false
    const subLabel = item.toggle ? (toggleState ? 'ON' : 'OFF') : item.subLabel
    return {
      id: item.id,
      label: item.label,
      subLabel,
      active,
      disabled: item.disabled,
      onPress: item.disabled ? undefined : () => pressItem(context, item.id),
    }
  })

  while (items.length < 6) {
    items.push({
      id: `${context}-empty-${items.length}`,
      label: '---',
      disabled: true,
    })
  }

  return items
}

export const useSoftkeyMenu = (context: SoftkeyContext) => {
  const contextState = useSoftkeyStore((state) => state.contexts[context])
  const pressItem = useSoftkeyStore((state) => state.pressItem)
  const goBack = useSoftkeyStore((state) => state.goBack)
  const goHome = useSoftkeyStore((state) => state.goHome)

  return useMemo(
    () => buildDisplayItems(context, contextState, pressItem, goBack, goHome),
    [context, contextState, goBack, goHome, pressItem],
  )
}

export const useSoftkeyToggle = (context: SoftkeyContext, menuId: string, itemId: string) =>
  useSoftkeyStore((state) => {
    const key = buildToggleKey(context, menuId, itemId)
    return state.contexts[context].toggleStates[key] ?? false
  })
