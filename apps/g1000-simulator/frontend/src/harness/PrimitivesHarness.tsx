import { useEffect, useRef } from 'react'
import {
  DEFAULT_ARC_OPTIONS,
  DEFAULT_ATTITUDE_OPTIONS,
  DEFAULT_COMPASS_OPTIONS,
  DEFAULT_TAPE_OPTIONS,
  DEFAULT_TAPE_STYLE,
  DEFAULT_TEXT_OPTIONS,
  drawArcIndicator,
  drawAttitudeSphere,
  drawCompassRose,
  drawMarker,
  drawTape,
  drawText,
} from '@aviation/g1000-rendering'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 620

export function PrimitivesHarness() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0b1218'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const tapeHeight = 280
    const tapeWidth = 90
    const tapeY = 100
    const tapeMargin = 40

    drawTape(
      ctx,
      { x: tapeMargin, y: tapeY, width: tapeWidth, height: tapeHeight },
      {
        ...DEFAULT_TAPE_OPTIONS,
        value: 120,
        min: 0,
        max: 200,
        majorTick: 10,
        minorTick: 5,
        labelStep: 20,
        units: 'KT',
        style: { ...DEFAULT_TAPE_STYLE },
      }
    )

    drawTape(
      ctx,
      {
        x: canvas.width - tapeMargin - tapeWidth,
        y: tapeY,
        width: tapeWidth,
        height: tapeHeight,
      },
      {
        ...DEFAULT_TAPE_OPTIONS,
        value: 5500,
        min: 0,
        max: 12000,
        majorTick: 1000,
        minorTick: 100,
        labelStep: 1000,
        units: 'FT',
        style: { ...DEFAULT_TAPE_STYLE },
      }
    )

    const attitudeViewport = { x: 260, y: 60, width: 380, height: 300 }
    ctx.save()
    ctx.beginPath()
    ctx.rect(
      attitudeViewport.x,
      attitudeViewport.y,
      attitudeViewport.width,
      attitudeViewport.height
    )
    ctx.clip()
    drawAttitudeSphere(ctx, attitudeViewport, {
      ...DEFAULT_ATTITUDE_OPTIONS,
      pitchDeg: 6,
      rollDeg: 18,
    })
    ctx.restore()
    ctx.strokeStyle = '#1f2b36'
    ctx.lineWidth = 2
    ctx.strokeRect(
      attitudeViewport.x,
      attitudeViewport.y,
      attitudeViewport.width,
      attitudeViewport.height
    )

    const compassViewport = { x: 340, y: 390, width: 220, height: 220 }
    drawCompassRose(ctx, compassViewport, {
      ...DEFAULT_COMPASS_OPTIONS,
      headingDeg: 123,
      radiusPx: 90,
    })

    drawArcIndicator(ctx, compassViewport, {
      ...DEFAULT_ARC_OPTIONS,
      startDeg: -40,
      endDeg: 40,
      radiusPx: 102,
      thicknessPx: 3,
      color: '#f5d142',
    })

    drawMarker(ctx, {
      x: compassViewport.x + compassViewport.width / 2,
      y: compassViewport.y + 12,
      size: 14,
      color: '#f5d142',
      shape: 'triangle',
      direction: 'up',
    })

    drawText(ctx, {
      ...DEFAULT_TEXT_OPTIONS,
      text: 'G1000 Rendering Primitives Harness',
      x: canvas.width / 2,
      y: 32,
      font: '16px "Fira Sans", sans-serif',
      color: '#e6edf3',
    })

    drawText(ctx, {
      ...DEFAULT_TEXT_OPTIONS,
      text: 'Airspeed',
      x: tapeMargin + tapeWidth / 2,
      y: tapeY + tapeHeight + 24,
      font: '12px "Fira Sans", sans-serif',
      color: '#9fb3c8',
    })

    drawText(ctx, {
      ...DEFAULT_TEXT_OPTIONS,
      text: 'Altitude',
      x: canvas.width - tapeMargin - tapeWidth / 2,
      y: tapeY + tapeHeight + 24,
      font: '12px "Fira Sans", sans-serif',
      color: '#9fb3c8',
    })
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#070b0f',
        padding: '24px',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ border: '1px solid #1f2b36' }}
      />
    </div>
  )
}
