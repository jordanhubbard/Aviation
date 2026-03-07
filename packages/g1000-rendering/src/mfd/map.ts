import type { Viewport } from '../primitives';
import type { G1000Theme } from '../themes';
import {
  DEFAULT_TEXT_OPTIONS,
  drawArcIndicator,
  drawMarker,
  drawText,
  normalizeDegrees,
  withRotation,
} from '../primitives';
import type { MfdFrame, MfdLayer, MfdSceneGraph } from './pipeline';

export type MfdMapOverlayRenderer = (
  ctx: CanvasRenderingContext2D,
  frame: MfdFrame,
  viewport: Viewport
) => void;

export type MfdMapStyle = {
  backgroundColor: string;
  ringColor: string;
  ringLabelColor: string;
  ringLabelFont: string;
  ringCount: number;
  ringThicknessPx: number;
  aircraftColor: string;
  aircraftStrokeColor: string;
  aircraftSizePx: number;
};

export type MfdMapConfig = {
  style?: Partial<MfdMapStyle>;
  overlays?: MfdMapOverlayRenderer[];
  includeBackground?: boolean;
  theme?: G1000Theme;
};

export const DEFAULT_MFD_MAP_STYLE: MfdMapStyle = {
  backgroundColor: '#0b1218',
  ringColor: '#355169',
  ringLabelColor: '#9fb3c8',
  ringLabelFont: '11px "Fira Sans", sans-serif',
  ringCount: 4,
  ringThicknessPx: 1,
  aircraftColor: '#e6edf3',
  aircraftStrokeColor: '#1f2933',
  aircraftSizePx: 14,
};

const resolveMapStyle = (style?: Partial<MfdMapStyle>, theme?: G1000Theme): MfdMapStyle => {
  const themeDefaults = theme
    ? {
        backgroundColor: theme.palette.background,
        ringColor: theme.palette.mapRing ?? DEFAULT_MFD_MAP_STYLE.ringColor,
        ringLabelColor: theme.palette.mapLabel ?? DEFAULT_MFD_MAP_STYLE.ringLabelColor,
        ringLabelFont: theme.typography.small ?? DEFAULT_MFD_MAP_STYLE.ringLabelFont,
        aircraftColor: theme.palette.mapAircraft ?? DEFAULT_MFD_MAP_STYLE.aircraftColor,
        aircraftStrokeColor: theme.palette.mapAircraftStroke ?? DEFAULT_MFD_MAP_STYLE.aircraftStrokeColor,
      }
    : {};

  return {
    ...DEFAULT_MFD_MAP_STYLE,
    ...themeDefaults,
    ...(style ?? {}),
  };
};

const resolveMapRotation = (frame: MfdFrame): number => {
  const orientation = frame.telemetry.map?.orientation ?? 'north-up';
  if (orientation === 'north-up') return 0;
  const trackDeg = frame.telemetry.position?.ground_track_deg ?? 0;
  const headingDeg = frame.telemetry.position?.heading_deg ?? trackDeg;
  const reference = orientation === 'heading-up' ? headingDeg : trackDeg;
  return -normalizeDegrees(reference);
};

const drawRangeRings = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  style: MfdMapStyle,
  rangeNm: number
): void => {
  const radiusPx = Math.min(viewport.width, viewport.height) * 0.45;
  const ringSpacingPx = radiusPx / style.ringCount;
  const ringSpacingNm = rangeNm / style.ringCount;
  for (let ringIndex = 1; ringIndex <= style.ringCount; ringIndex += 1) {
    drawArcIndicator(ctx, viewport, {
      startDeg: 0,
      endDeg: 360,
      radiusPx: ringSpacingPx * ringIndex,
      thicknessPx: style.ringThicknessPx,
      color: style.ringColor,
      lineCap: 'round',
    });

    const labelY = viewport.y + viewport.height / 2 - ringSpacingPx * ringIndex;
    drawText(ctx, {
      ...DEFAULT_TEXT_OPTIONS,
      text: `${Math.round(ringSpacingNm * ringIndex)} NM`,
      x: viewport.x + viewport.width / 2 + 6,
      y: labelY,
      align: 'left',
      baseline: 'middle',
      color: style.ringLabelColor,
      font: style.ringLabelFont,
    });
  }
};

export const drawMfdMap = (
  ctx: CanvasRenderingContext2D,
  frame: MfdFrame,
  viewport: Viewport,
  config?: MfdMapConfig
): void => {
  const style = resolveMapStyle(config?.style, frame.theme ?? config?.theme);
  const includeBackground = config?.includeBackground ?? true;
  const rangeNm = frame.telemetry.map?.range_nm ?? 20;
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const overlays = config?.overlays ?? [];

  if (includeBackground) {
    ctx.save();
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    ctx.restore();
  }

  const rotationDeg = resolveMapRotation(frame);
  withRotation(ctx, centerX, centerY, rotationDeg, () => {
    drawRangeRings(ctx, viewport, style, rangeNm);
    overlays.forEach((overlay) => overlay(ctx, frame, viewport));
  });

  drawMarker(ctx, {
    x: centerX,
    y: centerY,
    size: style.aircraftSizePx,
    color: style.aircraftColor,
    strokeColor: style.aircraftStrokeColor,
    strokeWidth: 1,
    shape: 'triangle',
    direction: 'up',
  });
};

export const createMfdMapSceneGraph = (config?: MfdMapConfig): MfdSceneGraph => {
  const mapLayer: MfdLayer = {
    id: 'map',
    order: 1,
    render: (ctx, frame) => drawMfdMap(ctx, frame, frame.viewport, config),
  };

  return {
    layers: [mapLayer],
  };
};
