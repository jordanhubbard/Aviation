import { existsSync, readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  computePfdLayout,
  createPfdPipeline,
  drawArcIndicator,
  drawAttitudeSphere,
  drawCompassRose,
  drawMarker,
  drawTape,
  drawText,
  type PfdLayer,
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

const recordingContext = () => {
  const operations: string[] = []
  let depth = 0
  const target: Record<string, unknown> = {
    save: () => { depth += 1; operations.push('save') },
    restore: () => { depth -= 1; operations.push('restore') },
  }
  const context = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property as string]
      return (..._args: unknown[]) => operations.push(String(property))
    },
    set(object, property, value) {
      object[property as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { context, operations, depth: () => depth }
}

describe('aviation.avionics rendering conformance', () => {
  it('computes the declared PFD layout', () => {
    const actual = computePfdLayout(vectors.rendering.viewport)
    for (const instrument of ['airspeed', 'attitude', 'altitude', 'hsi'] as const) {
      for (const field of ['x', 'y', 'width', 'height'] as const) {
        expect(actual[instrument][field]).toBeCloseTo(
          vectors.rendering.pfd_layout[instrument][field],
          9,
        )
      }
    }
  })

  it('renders enabled layers in deterministic order', () => {
    const { context } = recordingContext()
    const rendered: string[] = []
    const layers: PfdLayer[] = [
      { id: 'text', order: 8, render: () => rendered.push('text') },
      { id: 'hsi', order: 3, render: () => rendered.push('hsi') },
      { id: 'tapes', order: 2, render: () => rendered.push('tapes') },
      { id: 'attitude', order: 1, render: () => rendered.push('attitude') },
      { id: 'background', order: 0, render: () => rendered.push('background') },
      { id: 'alerts', order: 7, enabled: false, render: () => rendered.push('alerts') },
    ]
    const telemetry = {
      attitude: { heading_deg: 123, pitch_deg: 4, roll_deg: -8 },
      adc: { ias_kt: 105, tas_kt: 112, pressure_altitude_ft: 2500, vertical_speed_fpm: 300 },
      gps: { ground_speed_kt: 110, track_deg: 125 },
    }
    const pipeline = createPfdPipeline({
      ctx: context,
      viewport: vectors.rendering.viewport,
      telemetry,
      sceneGraph: { layers },
      theme: 'day',
    })
    pipeline.renderOnce(1000)
    expect(rendered).toEqual(vectors.rendering.layer_order)
    expect(pipeline.getPerformanceStats().frameCount).toBe(1)
  })

  it('draws core primitives and balances canvas state', () => {
    const { context, operations, depth } = recordingContext()
    const viewport = { x: 10, y: 20, width: 200, height: 160 }
    drawAttitudeSphere(context, viewport, { pitchDeg: 5, rollDeg: 10 })
    drawCompassRose(context, viewport, { headingDeg: 123, radiusPx: 60 })
    drawArcIndicator(context, viewport, { startDeg: -40, endDeg: 40 })
    drawMarker(context, { x: 50, y: 50, shape: 'triangle' })
    drawTape(context, { x: 0, y: 0, width: 80, height: 200 }, {
      value: 100,
      min: 0,
      max: 200,
      majorTick: 20,
      minorTick: 10,
      labelStep: 20,
      units: 'KT',
    })
    drawText(context, { text: 'HDG 123', x: 10, y: 10 })

    expect(operations).toEqual(expect.arrayContaining([
      'fillRect', 'arc', 'stroke', 'fill', 'fillText', 'save', 'restore',
    ]))
    expect(depth()).toBe(0)
  })
})
