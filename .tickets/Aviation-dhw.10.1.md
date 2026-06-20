---
id: Aviation-dhw.10.1
status: closed
deps: []
links: []
created: 2026-01-24T11:47:20.621074-08:00
type: task
priority: 2
parent: Aviation-dhw.10
mac-task-id: task_469144de131d4f4bbf4f13154d4be18e
---
# Story: Softkey menu system

## Menu System Architecture
```typescript
interface SoftkeyMenuItem {
  label: string;
  action?: () => void;
  submenu?: SoftkeyMenu;
  toggle?: boolean;
  state?: boolean;
}

interface SoftkeyMenu {
  title: string;
  items: SoftkeyMenuItem[];
  parent?: SoftkeyMenu;
}
```

## Manager Behavior
- Menu stack for push/pop
- Label rendering for 6 softkeys per display
- Toggle state indicators

## Example MFD Menu
```
Main MFD Menu
├── Map Settings
│   ├── Terrain On/Off
│   ├── Traffic On/Off
│   ├── Weather On/Off
│   └── Airspace On/Off
├── Weather
│   ├── NEXRAD
│   ├── METARs
│   └── Lightning
├── Engine
├── Flight Plan
└── Nearest
```

## Close Reason

Closed
