/**
 * usePerformanceOptimizer
 *
 * A custom React hook for monitoring render performance and providing
 * memoization utilities to keep the G1000 simulator UI responsive.
 *
 * Usage:
 *   const { fps, isLowFPS, throttle } = usePerformanceOptimizer()
 *
 * Memoization guidance for consumers:
 *   - Wrap pure display sub-components with React.memo so they skip re-renders
 *     when their props have not changed (e.g. AirspeedTape, AltimeterTape).
 *   - Use useCallback for event handlers and action creators passed as props.
 *   - Use useMemo for derived values that require non-trivial computation
 *     (e.g. terrain alert level in MfdDisplay, header metadata switching).
 *   - Prefer granular Zustand selectors (one field per useStore call) over
 *     selecting large objects so components only re-render on relevant changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Frames-per-second below which isLowFPS becomes true. */
const LOW_FPS_THRESHOLD = 30

/**
 * Tracks the live frame rate of the browser rendering loop and provides a
 * throttle utility for wrapping expensive operations.
 */
export function usePerformanceOptimizer() {
  const [fps, setFps] = useState<number>(60)
  const [isLowFPS, setIsLowFPS] = useState<boolean>(false)

  // Rolling sample of frame timestamps for a stable FPS average.
  const frameTimestamps = useRef<number[]>([])
  const rafHandle = useRef<number | null>(null)

  useEffect(() => {
    let running = true

    function onFrame(now: number) {
      if (!running) return

      const timestamps = frameTimestamps.current
      timestamps.push(now)

      // Keep only the last one second of samples.
      const cutoff = now - 1000
      const firstValid = timestamps.findIndex((t) => t >= cutoff)
      if (firstValid > 0) {
        frameTimestamps.current = timestamps.slice(firstValid)
      }

      const sampleCount = frameTimestamps.current.length
      if (sampleCount >= 2) {
        const span = frameTimestamps.current[sampleCount - 1] - frameTimestamps.current[0]
        const measured = span > 0 ? Math.round((sampleCount - 1) / (span / 1000)) : 0
        setFps(measured)
        setIsLowFPS(measured < LOW_FPS_THRESHOLD)
      }

      rafHandle.current = requestAnimationFrame(onFrame)
    }

    rafHandle.current = requestAnimationFrame(onFrame)

    return () => {
      running = false
      if (rafHandle.current !== null) {
        cancelAnimationFrame(rafHandle.current)
      }
    }
  }, [])

  /**
   * Returns a throttled version of `fn` that will not execute more than once
   * per `ms` milliseconds. Suitable for wrapping expensive map redraws,
   * terrain computations, or WebSocket message handlers.
   *
   * Example:
   *   const throttledUpdate = throttle(handleTelemetry, 50)
   */
  const throttle = useCallback(<T extends (...args: unknown[]) => void>(fn: T, ms: number): T => {
    let lastCall = 0
    return ((...args: Parameters<T>) => {
      const now = performance.now()
      if (now - lastCall >= ms) {
        lastCall = now
        fn(...args)
      }
    }) as T
  }, [])

  return { fps, isLowFPS, throttle }
}
