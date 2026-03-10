/**
 * Unit tests for AlertManager.
 *
 * File under test: apps/g1000-simulator/frontend/src/services/alert-manager.ts
 *
 * The AlertManager depends on:
 *   - ../hooks/useTelemetrySocket  (types only)
 *   - ../displays/PFD/formatters   (formatNumber function)
 *
 * Both dependencies are mocked below so no DOM is required.
 */

import { AlertManager, AlertContext, AlertItem, AlertLevel } from '../../frontend/src/services/alert-manager'
import type { TelemetrySnapshot } from '../../frontend/src/hooks/useTelemetrySocket'
import type { SocketStatus } from '../../frontend/src/hooks/useTelemetrySocket'

// ---------------------------------------------------------------------------
// Mock formatNumber so tests are not coupled to the formatter implementation.
// ---------------------------------------------------------------------------
jest.mock('../../frontend/src/displays/PFD/formatters', () => ({
  formatNumber: (value: number | null | undefined, suffix: string) =>
    value !== null && value !== undefined ? `${value}${suffix}` : '---',
}))

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTelemetry(overrides: Partial<{
  airspeed: number
  altitude: number
  targetAltitude: number
  heading: number
  targetHeading: number
}>): TelemetrySnapshot {
  const {
    airspeed = 100,
    altitude = 5000,
    targetAltitude = 5000,
    heading = 90,
    targetHeading = 90,
  } = overrides

  return {
    position: { altitude_ft: altitude, latitude_deg: 37.6, longitude_deg: -122.4 },
    attitude: { heading_deg: heading, pitch_deg: 0, roll_deg: 0, yaw_deg: 0 },
    velocity: { airspeed_kt: airspeed, vertical_speed_fpm: 0, ground_speed_kt: airspeed },
    targets: { altitude_ft: targetAltitude, heading_deg: targetHeading, airspeed_kt: 100 },
    autopilot: { master_on: false, lateral_mode: 'ROL', vertical_mode: 'PIT' },
    adf: { bearing_deg: 0, frequency_khz: 400 },
    dme: { distance_nm: 0, frequency_mhz: 108 },
    gps: { latitude_deg: 37.6, longitude_deg: -122.4, track_deg: heading, ground_speed_kt: airspeed },
    ahrs: { heading_deg: heading, pitch_deg: 0, roll_deg: 0, slip_skid_deg: 0, magnetic_variation_deg: 0 },
    adc: { indicated_altitude_ft: altitude, indicated_airspeed_kt: airspeed, oat_c: 15, density_altitude_ft: altitude },
    audio_panel: { com1_enabled: true, com2_enabled: false, nav1_enabled: true, nav2_enabled: false, adf_enabled: false, marker_enabled: false, speaker_enabled: true, headphone_enabled: true },
    transponder: { mode: 'ALT', squawk_code: '1200', ident: false },
    marker_beacons: { outer: false, middle: false, inner: false },
    slip_skid_deg: 0,
  } as unknown as TelemetrySnapshot
}

function makeContext(
  status: SocketStatus = 'connected',
  telemetry: TelemetrySnapshot | null = null,
): AlertContext {
  return { telemetry, socketStatus: status }
}

// ---------------------------------------------------------------------------
// getAlerts — socket status alerts
// ---------------------------------------------------------------------------

describe('getAlerts — socket status alert', () => {
  it('always includes the data-status alert', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected'))
    const ds = alerts.find((a) => a.id === 'data-status')
    expect(ds).toBeDefined()
    expect(ds!.level).toBe('ok')
    expect(ds!.label).toBe('Data')
  })

  it('sets caution level when socket is connecting', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connecting'))
    const ds = alerts.find((a) => a.id === 'data-status')
    expect(ds!.level).toBe('caution')
    expect(ds!.acknowledgeable).toBe(true)
  })

  it('sets warning level when socket is closed', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('closed'))
    const ds = alerts.find((a) => a.id === 'data-status')
    expect(ds!.level).toBe('warning')
  })

  it('sets warning level when socket has an error', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('error'))
    const ds = alerts.find((a) => a.id === 'data-status')
    expect(ds!.level).toBe('warning')
  })

  it('sets warning level when socket is unsupported', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('unsupported'))
    const ds = alerts.find((a) => a.id === 'data-status')
    expect(ds!.level).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// getAlerts — target info alerts (always present)
// ---------------------------------------------------------------------------

describe('getAlerts — target info alerts', () => {
  it('includes alt-sel, hdg-sel, spd-sel with info level', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext())
    for (const id of ['alt-sel', 'hdg-sel', 'spd-sel']) {
      const a = alerts.find((x) => x.id === id)
      expect(a).toBeDefined()
      expect(a!.level).toBe('info')
      expect(a!.acknowledgeable).toBe(false)
    }
  })

  it('shows --- when telemetry is null', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected', null))
    const altSel = alerts.find((a) => a.id === 'alt-sel')
    expect(altSel!.value).toBe('---')
  })
})

// ---------------------------------------------------------------------------
// getAlerts — overspeed / low-speed alerts
// ---------------------------------------------------------------------------

describe('getAlerts — speed alerts', () => {
  it('raises overspeed warning at 160 kt', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected', makeTelemetry({ airspeed: 160 })))
    const a = alerts.find((x) => x.id === 'overspeed')
    expect(a).toBeDefined()
    expect(a!.level).toBe('warning')
    expect(a!.acknowledgeable).toBe(true)
  })

  it('raises overspeed warning above 160 kt', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected', makeTelemetry({ airspeed: 180 })))
    expect(alerts.find((x) => x.id === 'overspeed')).toBeDefined()
  })

  it('does not raise overspeed below 160 kt', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected', makeTelemetry({ airspeed: 130 })))
    expect(alerts.find((x) => x.id === 'overspeed')).toBeUndefined()
  })

  it('raises low-speed caution at exactly 60 kt', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected', makeTelemetry({ airspeed: 60 })))
    const a = alerts.find((x) => x.id === 'stall')
    expect(a).toBeDefined()
    expect(a!.level).toBe('caution')
  })

  it('raises low-speed caution below 60 kt', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected', makeTelemetry({ airspeed: 45 })))
    expect(alerts.find((x) => x.id === 'stall')).toBeDefined()
  })

  it('does not raise stall alert above 60 kt', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(makeContext('connected', makeTelemetry({ airspeed: 90 })))
    expect(alerts.find((x) => x.id === 'stall')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getAlerts — altitude deviation
// ---------------------------------------------------------------------------

describe('getAlerts — altitude deviation', () => {
  it('raises altitude deviation caution at 250 ft delta', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(
      makeContext('connected', makeTelemetry({ altitude: 5250, targetAltitude: 5000 })),
    )
    const a = alerts.find((x) => x.id === 'altitude-dev')
    expect(a).toBeDefined()
    expect(a!.level).toBe('caution')
  })

  it('does not raise altitude deviation below 250 ft', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(
      makeContext('connected', makeTelemetry({ altitude: 5100, targetAltitude: 5000 })),
    )
    expect(alerts.find((x) => x.id === 'altitude-dev')).toBeUndefined()
  })

  it('handles negative deviation (below target)', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(
      makeContext('connected', makeTelemetry({ altitude: 4700, targetAltitude: 5000 })),
    )
    expect(alerts.find((x) => x.id === 'altitude-dev')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// getAlerts — heading deviation
// ---------------------------------------------------------------------------

describe('getAlerts — heading deviation', () => {
  it('raises heading deviation info at 20 degrees delta', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(
      makeContext('connected', makeTelemetry({ heading: 110, targetHeading: 90 })),
    )
    const a = alerts.find((x) => x.id === 'heading-dev')
    expect(a).toBeDefined()
    expect(a!.level).toBe('info')
    expect(a!.acknowledgeable).toBe(false)
  })

  it('does not raise heading deviation below 20 degrees', () => {
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(
      makeContext('connected', makeTelemetry({ heading: 95, targetHeading: 90 })),
    )
    expect(alerts.find((x) => x.id === 'heading-dev')).toBeUndefined()
  })

  it('uses shortest-path heading difference (wraps past 360)', () => {
    // heading 350, target 10 → shortest delta = 20
    const mgr = new AlertManager()
    const alerts = mgr.getAlerts(
      makeContext('connected', makeTelemetry({ heading: 350, targetHeading: 10 })),
    )
    expect(alerts.find((x) => x.id === 'heading-dev')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// acknowledge / staleness pruning
// ---------------------------------------------------------------------------

describe('acknowledge', () => {
  it('marks an alert as acknowledged', () => {
    const mgr = new AlertManager()
    const ctx = makeContext('closed')
    mgr.acknowledge('data-status')
    const alerts = mgr.getAlerts(ctx)
    const a = alerts.find((x) => x.id === 'data-status')
    expect(a!.acknowledged).toBe(true)
  })

  it('removes stale acknowledgements for alerts that are no longer active', () => {
    const mgr = new AlertManager()
    // overspeed is only active at >= 160 kt
    const highSpeedCtx = makeContext('connected', makeTelemetry({ airspeed: 180 }))
    mgr.acknowledge('overspeed')
    // Drop airspeed below overspeed threshold — alert disappears
    const normalCtx = makeContext('connected', makeTelemetry({ airspeed: 120 }))
    mgr.getAlerts(normalCtx) // triggers pruning
    // Raise airspeed again — alert should be un-acknowledged
    const alerts = mgr.getAlerts(highSpeedCtx)
    const a = alerts.find((x) => x.id === 'overspeed')
    expect(a!.acknowledged).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getAlerts — sort order
// ---------------------------------------------------------------------------

describe('getAlerts — sort order', () => {
  it('places higher-priority (unacknowledged) alerts before acknowledged ones', () => {
    const mgr = new AlertManager()
    const ctx = makeContext('closed', makeTelemetry({ airspeed: 170 }))
    // Acknowledge the data-status warning
    mgr.acknowledge('data-status')
    const alerts = mgr.getAlerts(ctx)
    // overspeed warning is unacknowledged, data-status is acknowledged
    const overspeedIdx = alerts.findIndex((a) => a.id === 'overspeed')
    const dataStatusIdx = alerts.findIndex((a) => a.id === 'data-status')
    expect(overspeedIdx).toBeLessThan(dataStatusIdx)
  })

  it('places warning before caution before info', () => {
    const mgr = new AlertManager()
    // airspeed 170 → overspeed (warning), connecting → data-status (caution), normal altitude
    const ctx = makeContext('connecting', makeTelemetry({ airspeed: 170 }))
    const alerts = mgr.getAlerts(ctx)
    const unacked = alerts.filter((a) => !a.acknowledged)
    const levels = unacked.map((a) => a.level)
    const levelPriority: Record<AlertLevel, number> = { ok: 0, info: 1, caution: 2, warning: 3 }
    for (let i = 0; i < levels.length - 1; i++) {
      expect(levelPriority[levels[i]]).toBeGreaterThanOrEqual(levelPriority[levels[i + 1]])
    }
  })
})

// ---------------------------------------------------------------------------
// getHighestLevel
// ---------------------------------------------------------------------------

describe('getHighestLevel', () => {
  it('returns ok for an empty list', () => {
    const mgr = new AlertManager()
    expect(mgr.getHighestLevel([])).toBe('ok')
  })

  it('returns the highest severity level', () => {
    const mgr = new AlertManager()
    const alerts: AlertItem[] = [
      { id: '1', label: 'A', value: '', level: 'info', acknowledgeable: false, acknowledged: false },
      { id: '2', label: 'B', value: '', level: 'warning', acknowledgeable: true, acknowledged: false },
      { id: '3', label: 'C', value: '', level: 'caution', acknowledgeable: true, acknowledged: false },
    ]
    expect(mgr.getHighestLevel(alerts)).toBe('warning')
  })

  it('ignores acknowledged alerts by default', () => {
    const mgr = new AlertManager()
    const alerts: AlertItem[] = [
      { id: '1', label: 'A', value: '', level: 'warning', acknowledgeable: true, acknowledged: true },
      { id: '2', label: 'B', value: '', level: 'caution', acknowledgeable: true, acknowledged: false },
    ]
    expect(mgr.getHighestLevel(alerts)).toBe('caution')
  })

  it('includes acknowledged alerts when flag is true', () => {
    const mgr = new AlertManager()
    const alerts: AlertItem[] = [
      { id: '1', label: 'A', value: '', level: 'warning', acknowledgeable: true, acknowledged: true },
      { id: '2', label: 'B', value: '', level: 'caution', acknowledgeable: true, acknowledged: false },
    ]
    expect(mgr.getHighestLevel(alerts, true)).toBe('warning')
  })

  it('returns ok when all alerts are acknowledged', () => {
    const mgr = new AlertManager()
    const alerts: AlertItem[] = [
      { id: '1', label: 'A', value: '', level: 'warning', acknowledgeable: true, acknowledged: true },
    ]
    expect(mgr.getHighestLevel(alerts)).toBe('ok')
  })
})
