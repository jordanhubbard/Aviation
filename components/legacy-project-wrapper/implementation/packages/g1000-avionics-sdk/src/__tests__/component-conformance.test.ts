import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'

import {
  computeAdc,
  computeAdf,
  computeAhrs,
  computeAudioPanelStatus,
  computeDme,
  computeGps,
  computeMarkerBeacons,
  normalizeSquawk,
  transitionTransponder,
  transitionRadio,
  transitionAudioInput,
  resolveMarkerLights,
  type RadioState,
} from '../index'

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
  for (const sequence of vectors.radio_controls.sequences) {
    it(sequence.name, () => {
      let state: RadioState = sequence.initial
      for (const step of sequence.steps) {
        const original = { ...state }
        const next = transitionRadio(state, step.change)
        expect(next).toEqual(step.expected)
        expect(state).toEqual(original)
        state = next
      }
    })
  }

  it.each(vectors.radio_controls.invalid_radio)('rejects invalid radio control %j', row => {
    const state = vectors.radio_controls.sequences.find((s: any) => s.initial.kind === row.kind).initial
    const original = { ...state }
    expect(() => transitionRadio(state, row.change)).toThrow()
    expect(state).toEqual(original)
  })

  it('qualifies auxiliary audio transitions without mutating the input', () => {
    let state = vectors.radio_controls.audio_sequence.initial
    for (const step of vectors.radio_controls.audio_sequence.steps) {
      const original = { ...state }
      const next = transitionAudioInput(state, step.change)
      expect(next).toEqual(step.expected)
      expect(state).toEqual(original)
      state = next
    }
    for (const change of vectors.radio_controls.invalid_audio) {
      expect(() => transitionAudioInput(state, change)).toThrow()
    }
  })

  it('qualifies marker lamp priority and strict input types', () => {
    for (const row of vectors.radio_controls.markers) {
      expect(resolveMarkerLights(row.input[0], row.input[1], row.input[2])).toEqual(row.expected)
    }
    expect(() => resolveMarkerLights(1 as unknown as boolean, false, false)).toThrow()
  })

  it.each([Number.NaN, Infinity, -Infinity])('rejects non-finite radio/audio values %s', value => {
    const state = vectors.radio_controls.sequences[0].initial
    expect(() => transitionRadio(state, { active_frequency_mhz: value })).toThrow()
    expect(() => transitionRadio(state, { volume: value })).toThrow()
    expect(() => transitionRadio({ ...state, kind: 'ADF' as RadioState['kind'] }, {})).toThrow()
    expect(() => transitionAudioInput({ enabled: true, volume: value }, {})).toThrow()
  })
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

  it('computes marker-beacon priority and audio-panel levels', () => {
    const marker = vectors.controls.marker_beacons
    const markerStatus = computeMarkerBeacons(
      marker.input.latitude_deg,
      marker.input.longitude_deg,
      marker.input.altitude_ft,
      marker.input.sites,
    )
    expectCloseRecord(markerStatus, marker.expected)
    const audio = vectors.controls.audio_panel
    expectCloseRecord(
      computeAudioPanelStatus(audio.state, audio.adf_signal_strength, audio.marker_status),
      audio.expected,
    )
  })

  it('normalizes squawk codes and transitions IDENT deterministically', () => {
    const vector = vectors.controls.transponder
    const triggered = transitionTransponder(vector.initial, vector.trigger)
    expectCloseRecord(triggered, vector.triggered_expected)
    expectCloseRecord(
      transitionTransponder(triggered, { elapsed_sec: vector.elapsed_sec }),
      vector.elapsed_expected,
    )
    expect(normalizeSquawk('77')).toBe('0077')
    expect(normalizeSquawk('1280')).toBeUndefined()
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
    expect(() => computeMarkerBeacons(0, 0, 1000, [{
      ...vectors.controls.marker_beacons.input.sites[0],
      inner_radius_nm: 2,
    }])).toThrow()
    expect(() => computeAudioPanelStatus(
      { ...vectors.controls.audio_panel.state, marker_volume: 1.1 },
      0.5,
      vectors.controls.audio_panel.marker_status,
    )).toThrow()
    expect(() => transitionTransponder(vectors.controls.transponder.initial, {
      squawk_code: '1280',
    })).toThrow()
    expect(() => transitionTransponder(vectors.controls.transponder.initial, {
      mode: 'ALT',
    } as never)).toThrow()
  })
})
