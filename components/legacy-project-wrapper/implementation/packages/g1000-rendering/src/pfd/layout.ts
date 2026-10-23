import type { Viewport, TapeStyle } from '../primitives'
import type { G1000Theme } from '../themes'
import {
  DEFAULT_ATTITUDE_OPTIONS,
  DEFAULT_COMPASS_OPTIONS,
  DEFAULT_TAPE_OPTIONS,
  DEFAULT_TAPE_STYLE,
  DEFAULT_TEXT_OPTIONS,
  drawAttitudeSphere,
  drawCompassRose,
  drawMarker,
  drawTape,
  drawText,
} from '../primitives'
import type { PfdFrame, PfdLayer, PfdSceneGraph } from './pipeline'

export type PfdLayoutMetrics = {
  airspeed: Viewport
  attitude: Viewport
  altitude: Viewport
  hsi: Viewport
}

export type PfdLayoutConfig = {
  headerRatio: number
  footerRatio: number
  hsiRatio: number
  tapeWidthRatio: number
  sideGapRatio: number
  sectionGapRatio: number
  backgroundColor: string
  borderColor: string
  labelColor: string
  highlightColor: string
  tapeStyle: TapeStyle
  theme?: G1000Theme
}

export const DEFAULT_PFD_LAYOUT_CONFIG: PfdLayoutConfig = {
  headerRatio: 0.08,
  footerRatio: 0.1,
  hsiRatio: 0.28,
  tapeWidthRatio: 0.14,
  sideGapRatio: 0.03,
  sectionGapRatio: 0.04,
  backgroundColor: '#0b1218',
  borderColor: '#1f2b36',
  labelColor: '#9fb3c8',
  highlightColor: '#f5d142',
  tapeStyle: DEFAULT_TAPE_STYLE,
}

const resolveConfig = (config?: Partial<PfdLayoutConfig>): PfdLayoutConfig => {
  const theme = config?.theme
  const themeDefaults = theme
    ? {
        backgroundColor: theme.palette.background,
        borderColor: theme.palette.border,
        labelColor: theme.palette.textSecondary,
        highlightColor: theme.palette.warning,
        tapeStyle: {
          ...DEFAULT_TAPE_STYLE,
          backgroundColor: theme.palette.background,
          tickColor: theme.palette.textSecondary,
          textColor: theme.palette.textPrimary,
          accentColor: theme.palette.accent,
          font: theme.typography.medium,
        },
      }
    : {}

  return {
    ...DEFAULT_PFD_LAYOUT_CONFIG,
    ...themeDefaults,
    ...(config ?? {}),
    tapeStyle: {
      ...DEFAULT_TAPE_STYLE,
      ...(themeDefaults.tapeStyle ?? {}),
      ...(config?.tapeStyle ?? {}),
    },
  }
}

export const computePfdLayout = (
  viewport: Viewport,
  config?: Partial<PfdLayoutConfig>
): PfdLayoutMetrics => {
  const resolved = resolveConfig(config)
  const width = viewport.width
  const height = viewport.height
  const headerHeight = height * resolved.headerRatio
  const footerHeight = height * resolved.footerRatio
  const sideGap = width * resolved.sideGapRatio
  const maxTapeWidth = Math.max((width - 4 * sideGap) / 3, 0)
  const tapeWidth = Math.min(width * resolved.tapeWidthRatio, maxTapeWidth)
  const hsiSize = Math.min(width * resolved.hsiRatio, height * resolved.hsiRatio)
  const hsiY = viewport.y + height - footerHeight - hsiSize
  const mainTop = viewport.y + headerHeight
  const mainBottom = Math.max(hsiY - height * resolved.sectionGapRatio, mainTop)
  const mainHeight = Math.max(mainBottom - mainTop, height * 0.3)

  const leftEdge = viewport.x + sideGap
  const rightEdge = viewport.x + width - sideGap
  const airspeed: Viewport = {
    x: leftEdge,
    y: mainTop,
    width: tapeWidth,
    height: mainHeight,
  }
  const altitude: Viewport = {
    x: rightEdge - tapeWidth,
    y: mainTop,
    width: tapeWidth,
    height: mainHeight,
  }
  const attitudeX = airspeed.x + tapeWidth + sideGap
  const attitudeWidth = Math.max(altitude.x - sideGap - attitudeX, tapeWidth)
  const attitude: Viewport = {
    x: attitudeX,
    y: mainTop,
    width: attitudeWidth,
    height: mainHeight,
  }
  const hsi: Viewport = {
    x: viewport.x + (width - hsiSize) / 2,
    y: hsiY,
    width: hsiSize,
    height: hsiSize,
  }

  return { airspeed, attitude, altitude, hsi }
}

const drawViewportBorder = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  color: string
): void => {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height)
  ctx.restore()
}

const formatHeading = (heading: number): string =>
  `${Math.round(((heading % 360) + 360) % 360)}`.padStart(3, '0')

export const createPfdLayoutSceneGraph = (
  config?: Partial<PfdLayoutConfig>
): PfdSceneGraph => {
  const getLayout = (frame: PfdFrame) =>
    computePfdLayout(frame.viewport, { ...config, theme: frame.theme })

  const backgroundLayer: PfdLayer = {
    id: 'background',
    order: 0,
    render: (ctx, frame) => {
      const resolved = resolveConfig({ ...config, theme: frame.theme })
      ctx.save()
      ctx.fillStyle = resolved.backgroundColor
      ctx.fillRect(frame.viewport.x, frame.viewport.y, frame.viewport.width, frame.viewport.height)
      ctx.restore()
    },
  }

  const attitudeLayer: PfdLayer = {
    id: 'attitude',
    order: 1,
    render: (ctx, frame) => {
      const layout = getLayout(frame)
      const resolved = resolveConfig({ ...config, theme: frame.theme })
      const attitudeOptions = frame.theme
        ? {
            ...DEFAULT_ATTITUDE_OPTIONS,
            skyColor: frame.theme.palette.sky,
            groundColor: frame.theme.palette.ground,
            horizonColor: frame.theme.palette.horizon,
          }
        : DEFAULT_ATTITUDE_OPTIONS
      ctx.save()
      ctx.beginPath()
      ctx.rect(layout.attitude.x, layout.attitude.y, layout.attitude.width, layout.attitude.height)
      ctx.clip()
      drawAttitudeSphere(ctx, layout.attitude, {
        ...attitudeOptions,
        pitchDeg: frame.telemetry.attitude.pitch_deg,
        rollDeg: frame.telemetry.attitude.roll_deg,
      })
      ctx.restore()
      drawViewportBorder(ctx, layout.attitude, resolved.borderColor)
    },
  }

  const tapesLayer: PfdLayer = {
    id: 'tapes',
    order: 2,
    render: (ctx, frame) => {
      const layout = getLayout(frame)
      const resolved = resolveConfig({ ...config, theme: frame.theme })
      drawTape(ctx, layout.airspeed, {
        ...DEFAULT_TAPE_OPTIONS,
        value: frame.telemetry.adc.ias_kt,
        min: 0,
        max: 200,
        majorTick: 10,
        minorTick: 5,
        labelStep: 20,
        units: 'KT',
        style: resolved.tapeStyle,
      })

      drawTape(ctx, layout.altitude, {
        ...DEFAULT_TAPE_OPTIONS,
        value: frame.telemetry.adc.pressure_altitude_ft,
        min: 0,
        max: 12000,
        majorTick: 1000,
        minorTick: 100,
        labelStep: 1000,
        units: 'FT',
        style: resolved.tapeStyle,
      })
    },
  }

  const hsiLayer: PfdLayer = {
    id: 'hsi',
    order: 3,
    render: (ctx, frame) => {
      const layout = getLayout(frame)
      const resolved = resolveConfig({ ...config, theme: frame.theme })
      const compassOptions = frame.theme
        ? {
            ...DEFAULT_COMPASS_OPTIONS,
            color: frame.theme.palette.textSecondary,
            font: frame.theme.typography.medium,
          }
        : DEFAULT_COMPASS_OPTIONS
      const radius = Math.max(Math.min(layout.hsi.width, layout.hsi.height) / 2 - 8, 10)
      drawCompassRose(ctx, layout.hsi, {
        ...compassOptions,
        headingDeg: frame.telemetry.attitude.heading_deg,
        radiusPx: radius,
        color: resolved.labelColor,
      })

      const centerX = layout.hsi.x + layout.hsi.width / 2
      drawMarker(ctx, {
        x: centerX,
        y: layout.hsi.y + 10,
        size: 12,
        color: resolved.highlightColor,
        shape: 'triangle',
        direction: 'up',
      })
    },
  }

  const textLayer: PfdLayer = {
    id: 'text',
    order: 8,
    render: (ctx, frame) => {
      const layout = getLayout(frame)
      const resolved = resolveConfig({ ...config, theme: frame.theme })
      const headingText = formatHeading(frame.telemetry.attitude.heading_deg)
      drawText(ctx, {
        ...DEFAULT_TEXT_OPTIONS,
        text: `HDG ${headingText}`,
        x: layout.hsi.x + layout.hsi.width / 2,
        y: layout.hsi.y - 12,
        font: resolved.tapeStyle.font,
        color: resolved.labelColor,
      })
    },
  }

  return {
    layers: [backgroundLayer, attitudeLayer, tapesLayer, hsiLayer, textLayer],
  }
}
