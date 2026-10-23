/**
 * useThrottledTelemetry
 *
 * Wraps the flightStore telemetry data with configurable time-based throttling
 * so that rapid WebSocket updates (which can arrive at 20–100 Hz) do not
 * trigger a cascade of unnecessary React re-renders across every display
 * component.
 *
 * Default throttle interval: 50 ms (≈ 20 Hz), matching the G1000 NXi's
 * nominal display refresh rate for primary flight instruments.
 *
 * Usage:
 *   // Standard 20 Hz throttle
 *   const telemetry = useThrottledTelemetry()
 *
 *   // Custom interval, e.g. 100 ms for non-primary displays
 *   const telemetry = useThrottledTelemetry(100)
 *
 * Performance note:
 *   Components that require the absolute latest value (e.g. an alert that must
 *   react within one frame) should subscribe directly to useFlightStore rather
 *   than using this hook.
 */

import { useEffect, useRef, useState } from 'react'

import { useFlightStore } from '../stores/flightStore'
import type { TelemetrySnapshot } from '../types/telemetry'

/** Default throttle interval in milliseconds (50 ms = 20 Hz). */
const DEFAULT_THROTTLE_MS = 50

/**
 * Returns a throttled copy of the current telemetry snapshot.
 *
 * @param intervalMs - Minimum number of milliseconds between state updates.
 *                     Defaults to 50 ms (20 Hz).
 */
export function useThrottledTelemetry(intervalMs: number = DEFAULT_THROTTLE_MS): TelemetrySnapshot | null {
  // Subscribe to the raw telemetry from the flight store.
  const rawTelemetry = useFlightStore((state) => state.telemetry)

  const [throttledTelemetry, setThrottledTelemetry] = useState<TelemetrySnapshot | null>(rawTelemetry)

  // Track when we last propagated a telemetry update to subscribers.
  const lastUpdateRef = useRef<number>(0)
  // Hold the most recent raw value so the scheduled flush can always use it.
  const pendingRef = useRef<TelemetrySnapshot | null>(rawTelemetry)
  const rafHandle = useRef<number | null>(null)

  useEffect(() => {
    pendingRef.current = rawTelemetry
    const now = performance.now()

    if (now - lastUpdateRef.current >= intervalMs) {
      // Enough time has elapsed — update immediately.
      lastUpdateRef.current = now
      setThrottledTelemetry(rawTelemetry)
    } else if (rafHandle.current === null) {
      // Schedule a flush on the next animation frame after the interval expires.
      const remaining = intervalMs - (now - lastUpdateRef.current)
      rafHandle.current = window.setTimeout(() => {
        rafHandle.current = null
        lastUpdateRef.current = performance.now()
        setThrottledTelemetry(pendingRef.current)
      }, remaining)
    }
    // If a flush is already scheduled, it will pick up pendingRef on execution.
  }, [rawTelemetry, intervalMs])

  // Clean up any pending timeout on unmount.
  useEffect(() => {
    return () => {
      if (rafHandle.current !== null) {
        window.clearTimeout(rafHandle.current)
      }
    }
  }, [])

  return throttledTelemetry
}
