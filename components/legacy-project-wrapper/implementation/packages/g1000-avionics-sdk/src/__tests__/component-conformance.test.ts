import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'

import { computeAdc, computeAhrs, computeGps } from '../index'

const packagedPath = resolve('../../conformance/aviation-avionics.json')
const authorityPath = resolve('../../../../aviation-avionics/acceptance/vectors.json')
const vectors = JSON.parse(readFileSync(packagedPath, 'utf8'))
if (existsSync(authorityPath)) {
  const authority = JSON.parse(readFileSync(authorityPath, 'utf8'))
  if (!isDeepStrictEqual(vectors, authority)) {
    throw new Error('packaged avionics vectors differ from Component authority')
  }
}

const expectCloseRecord = (
  actual: object,
  expected: Record<string, unknown>,
) => {
  const record = actual as Record<string, unknown>
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'number') {
      expect(record[key]).toBeCloseTo(value, 9)
    } else {
      expect(record[key]).toBe(value)
    }
  }
}

describe('aviation.avionics device conformance', () => {
  it('computes AHRS attitude, heading, variation, and slip/skid', () => {
    expectCloseRecord(computeAhrs(vectors.devices.ahrs.input), vectors.devices.ahrs.expected)
  })

  it('computes ADC air data with unit-explicit corrections', () => {
    expectCloseRecord(computeAdc(vectors.devices.adc.input), vectors.devices.adc.expected)
  })

  it('computes a deterministic GPS integrity and error solution', () => {
    expectCloseRecord(computeGps(vectors.devices.gps.input), vectors.devices.gps.expected)
  })

  it('rejects non-finite and out-of-range device inputs', () => {
    expect(() => computeAhrs({ ...vectors.devices.ahrs.input, pitch_deg: Number.NaN })).toThrow()
    expect(() => computeAdc({ ...vectors.devices.adc.input, altimeter_setting_inhg: 0 })).toThrow()
    expect(() => computeGps({ ...vectors.devices.gps.input, latitude_deg: 91 })).toThrow()
  })
})
