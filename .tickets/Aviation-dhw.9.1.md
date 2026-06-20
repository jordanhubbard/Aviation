---
id: Aviation-dhw.9.1
status: closed
deps: []
links: []
created: 2026-01-24T11:46:53.906294-08:00
type: task
priority: 2
parent: Aviation-dhw.9
mac-task-id: task_c30d2ed13f4149ee9efb04b47c6d59cb
---
# Story: Rotary knob controls

## Knob Types
- Large FMS knob (outer/inner)
- Range knob (map range)
- Joystick (cursor/pan)
- Heading bug knob
- Altitude bug knob

## Interaction Model
- Click/drag vertically to rotate
- Mouse wheel rotation
- Keyboard arrow keys when focused
- Touch drag support

## Implementation Sketch
```typescript
interface KnobConfig {
  id: string;
  type: 'continuous' | 'stepped';
  stepsPerRevolution?: number;
  min?: number;
  max?: number;
  wrap?: boolean;
  onChange: (delta: number) => void;
}
```

## Close Reason

Complete rotary knob controls
