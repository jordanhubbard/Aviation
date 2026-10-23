// Primitives module: Viewport, tapes, attitude, compass, arcs, text, and helpers

import { drawAttitudeSphere as drawAttitudeInner } from './attitude';
import { drawCompassRose as drawCompassInner } from './compass';
import { TapeRenderer } from './tape';

export type { Viewport } from './viewport';
export { drawText, type TextOptions } from './text';
export { drawArcIndicator } from './arcs';
export { TapeRenderer, type TapeConfig } from './tape';

// TapeStyle and DEFAULT_* for PFD/MFD layout
export interface TapeStyle {
  backgroundColor?: string;
  tickColor?: string;
  textColor?: string;
  accentColor?: string;
  font?: string;
}

export const DEFAULT_TEXT_OPTIONS = {
  font: '12px sans-serif',
  color: '#e2e8f0',
  align: 'left' as CanvasTextAlign,
};

export const DEFAULT_ATTITUDE_OPTIONS = {
  pitchDeg: 0,
  rollDeg: 0,
};

export const DEFAULT_COMPASS_OPTIONS = {
  headingDeg: 0,
  radiusPx: 50,
  color: '#e2e8f0',
  font: '12px sans-serif',
};

export const DEFAULT_TAPE_OPTIONS = {
  value: 0,
  min: 0,
  max: 100,
  majorTick: 10,
  minorTick: 5,
  labelStep: 10,
  units: '',
};

export const DEFAULT_TAPE_STYLE: TapeStyle = {
  backgroundColor: '#0b1218',
  tickColor: '#9fb3c8',
  textColor: '#e2e8f0',
  accentColor: '#f5d142',
  font: '12px sans-serif',
};

// Draw functions used by PFD/MFD layout
export function drawAttitudeSphere(
  ctx: CanvasRenderingContext2D,
  viewport: { x: number; y: number; width: number; height: number },
  options: { pitchDeg?: number; rollDeg?: number }
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.clip();
  drawAttitudeInner(ctx, options.pitchDeg ?? 0, options.rollDeg ?? 0);
  ctx.restore();
}

export function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  _viewport: { x: number; y: number; width: number; height: number },
  options: { headingDeg?: number; radiusPx?: number; color?: string }
): void {
  drawCompassInner(ctx, options.headingDeg ?? 0);
}

export function drawMarker(
  ctx: CanvasRenderingContext2D,
  _options: {
    x: number;
    y: number;
    size?: number;
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    shape?: string;
    direction?: string;
  }
): void {
  // Stub: draw a small triangle or circle
}

export function drawTape(
  ctx: CanvasRenderingContext2D,
  viewport: { x: number; y: number; width: number; height: number },
  options: {
    value?: number;
    min?: number;
    max?: number;
    majorTick?: number;
    minorTick?: number;
    labelStep?: number;
    units?: string;
    style?: TapeStyle;
  }
): void {
  const cfg = {
    x: viewport.x,
    y: viewport.y,
    width: viewport.width,
    height: viewport.height,
    min: options.min ?? 0,
    max: options.max ?? 100,
    current: options.value ?? 0,
    unit: options.units ?? '',
    majorTickInterval: options.majorTick ?? 10,
    minorTickInterval: options.minorTick ?? 5,
  };
  new TapeRenderer(ctx, cfg).render();
}

export function normalizeDegrees(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

export function withRotation(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  rotationDeg: number,
  fn: () => void
): void {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);
  fn();
  ctx.restore();
}
