import { existsSync, readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  computeRouteBearingDeg,
  computeRouteDistanceNm,
  importFromGpx,
  isCommandPayload,
  isFlightPlan,
  isTelemetrySnapshot,
  isTelemetryUpdate,
} from '../index'

const packagedPath = fileURLToPath(new URL(
  '../../../../conformance/aviation-avionics.json',
  import.meta.url,
))
const authorityPath = fileURLToPath(new URL(
  '../../../../../../../components/aviation-avionics/acceptance/vectors.json',
  import.meta.url,
))
const vectors = JSON.parse(readFileSync(packagedPath, 'utf8'))
if (existsSync(authorityPath)) {
  const authority = JSON.parse(readFileSync(authorityPath, 'utf8'))
  if (!isDeepStrictEqual(vectors, authority)) {
    throw new Error('packaged avionics vectors differ from Component authority')
  }
}

describe('aviation.avionics protocol conformance', () => {
  it('classifies full snapshots and partial updates without casts', () => {
    expect(isTelemetrySnapshot(vectors.telemetry.snapshot)).toBe(true)
    expect(isTelemetryUpdate(vectors.telemetry.update)).toBe(true)
    expect(isTelemetryUpdate(vectors.telemetry.invalid_update)).toBe(false)

    const incomplete = { ...vectors.telemetry.snapshot }
    delete incomplete.gps
    expect(isTelemetrySnapshot(incomplete)).toBe(false)

    const nonFinite = structuredClone(vectors.telemetry.snapshot)
    nonFinite.position.altitude_ft = Number.NaN
    expect(isTelemetrySnapshot(nonFinite)).toBe(false)
  })

  it('accepts only supported, well-typed commands', () => {
    expect(vectors.commands.valid.every(isCommandPayload)).toBe(true)
    expect(vectors.commands.invalid.some(isCommandPayload)).toBe(false)
  })

  it('imports a deterministic GPX route through the public flight-plan contract', () => {
    const plan = importFromGpx(vectors.flight_plan.gpx)
    const legs = plan.segments.flatMap((segment) => segment.legs)
    expect(isFlightPlan(plan)).toBe(true)
    expect(legs.map((leg) => leg.waypoint.id)).toEqual(vectors.flight_plan.expected.ids)
    expect(legs[0].waypoint.altitude_ft).toBeCloseTo(
      vectors.flight_plan.expected.first_altitude_ft,
      6,
    )
    expect(computeRouteDistanceNm(plan)).toBeCloseTo(
      vectors.flight_plan.expected.distance_nm,
      9,
    )
    expect(computeRouteBearingDeg(legs[0], legs[1])).toBeCloseTo(
      vectors.flight_plan.expected.bearing_deg,
      9,
    )
  })
})
