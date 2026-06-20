---
id: Aviation-dhw.16.2
status: open
deps: []
links: []
created: 2026-01-24T11:50:12.708923-08:00
type: task
priority: 2
parent: Aviation-dhw.16
mac-task-id: task_bae9c551c0a34554bbb2f00e6c445da5
---
# Story: Flight recording and playback

## Recorded Data
- Flight state (position, attitude, speed) at 10 Hz
- Control inputs at 10 Hz
- Autopilot mode changes (event-based)
- Radio frequency changes (event-based)
- Alerts/annunciations (event-based)

## Storage Format
```typescript
interface FlightRecording {
  metadata: { aircraft: string; startTime: Date; duration: number; departure: string; destination: string; };
  telemetry: { timestamp: number[]; latitude: number[]; longitude: number[]; altitude: number[]; heading: number[]; pitch: number[]; roll: number[]; speed: number[]; };
  events: { time: number; type: string; data: any; }[];
}
```

## Compression
- Efficient binary format with delta encoding for position/attitude
