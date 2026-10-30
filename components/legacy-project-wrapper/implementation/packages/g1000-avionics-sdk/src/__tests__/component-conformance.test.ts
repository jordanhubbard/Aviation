import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'

import { computeAdc, computeAdf, computeAhrs, computeDme, computeGps } from '../index'

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

  it('computes an ADF station, bearing, distance, and signal solution', () => {
    expectCloseRecord(computeAdf(vectors.radios.adf.input), vectors.radios.adf.expected)
  })

  it('computes a DME station, slant range, and signal solution', () => {
    expectCloseRecord(computeDme(vectors.radios.dme.input), vectors.radios.dme.expected)
  })

  it('reports an unavailable radio signal without inventing station data', () => {
    expectCloseRecord(
      computeAdf(vectors.radios.unavailable_adf.input),
      vectors.radios.unavailable_adf.expected,
    )
    expectCloseRecord(
      computeDme(vectors.radios.unavailable_dme.input),
      vectors.radios.unavailable_dme.expected,
    )
  })

  it('rejects non-finite and out-of-range device inputs', () => {
    expect(() => computeAhrs({ ...vectors.devices.ahrs.input, pitch_deg: Number.NaN })).toThrow()
    expect(() => computeAdc({ ...vectors.devices.adc.input, altimeter_setting_inhg: 0 })).toThrow()
    expect(() => computeGps({ ...vectors.devices.gps.input, latitude_deg: 91 })).toThrow()
    expect(() => computeAdf({ ...vectors.radios.adf.input, latitude_deg: 91 })).toThrow()
    expect(() => computeAdf({ ...vectors.radios.adf.input, tuned_frequency_khz: 0 })).toThrow()
    expect(() => computeDme({
      ...vectors.radios.dme.input,
      stations: [{ ...vectors.radios.dme.input.stations[0], max_range_nm: 0 }],
    })).toThrow()
    expect(() => computeDme({ ...vectors.radios.dme.input, tuned_frequency_mhz: -1 })).toThrow()
  })
})
