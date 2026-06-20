---
id: Aviation-dhw.15.2
status: open
deps: []
links: []
created: 2026-01-24T11:49:50.096951-08:00
type: task
priority: 2
parent: Aviation-dhw.15
mac-task-id: task_7d7a80eb1c5a4bec86b405022897bc67
---
# Story: Alert message stack and manager

## Display Rules
- Show up to 3 alerts simultaneously
- Highest priority on top
- Older alerts scroll down
- Acknowledged alerts dimmed

## Manager Interface
```typescript
interface Alert {
  id: string;
  level: 'warning' | 'caution' | 'advisory';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}
```

## Behaviors
- Add alert: push, sort by priority, play aural
- Acknowledge and clear functionality
