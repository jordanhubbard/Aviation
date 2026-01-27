import type { SocketStatus, TelemetrySnapshot } from '../hooks/useTelemetrySocket'

export type DisplayTelemetry = TelemetrySnapshot | null

export type DisplayModuleProps = {
  telemetry: DisplayTelemetry
}

export type PfdDisplayProps = DisplayModuleProps & {
  socketStatus: SocketStatus
}

export type MfdDisplayProps = DisplayModuleProps
