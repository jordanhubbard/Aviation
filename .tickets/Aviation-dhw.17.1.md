---
id: Aviation-dhw.17.1
status: open
deps: []
links: []
created: 2026-01-24T11:50:22.683914-08:00
type: task
priority: 2
parent: Aviation-dhw.17
mac-task-id: task_c389a05d00fe47d8af55f8d0b413ad6a
---
# Story: Plugin architecture

## Design Goals
- Allow third-party display plugins
- Support additional aircraft types
- Enable custom procedures
- Integrate external hardware

## Plugin Interface
```typescript
interface G1000Plugin {
  id: string;
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  destroy(): Promise<void>;
  onFlightStateUpdate?(state: FlightState): void;
  onDisplayRender?(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;
  onMenuRegister?(menuManager: MenuManager): void;
}
```

## Example
Traffic display plugin registers a display and menu item.
