// Primitives module: Viewport, tapes, attitude, compass, arcs, text, and helpers

import { TapeRenderer } from './tape';

export type { Viewport } from './viewport';
export { drawText, type TextOptions } from './text';
export { drawArcIndicator, type ArcIndicatorOptions } from './arcs';
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
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const pitchOffset = (options.pitchDeg ?? 0) * (viewport.height / 90);
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.clip();
  ctx.translate(centerX, centerY);
  ctx.rotate(((options.rollDeg ?? 0) * Math.PI) / 180);
  ctx.fillStyle = '#0066cc';
  ctx.fillRect(-viewport.width, -viewport.height * 2 + pitchOffset, viewport.width * 2, viewport.height * 2);
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-viewport.width, pitchOffset, viewport.width * 2, viewport.height * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-viewport.width / 2, pitchOffset);
  ctx.lineTo(viewport.width / 2, pitchOffset);
  ctx.stroke();
  ctx.restore();
}

export function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  viewport: { x: number; y: number; width: number; height: number },
  options: { headingDeg?: number; radiusPx?: number; color?: string }
): void {
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const radius = options.radiusPx ?? Math.min(viewport.width, viewport.height) / 2;
  const color = options.color ?? '#e2e8f0';
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((-(options.headingDeg ?? 0) * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  for (let heading = 0; heading < 360; heading += 30) {
    const radians = (heading * Math.PI) / 180;
    const inner = radius - (heading % 90 === 0 ? 12 : 7);
    ctx.beginPath();
    ctx.moveTo(Math.sin(radians) * inner, -Math.cos(radians) * inner);
    ctx.lineTo(Math.sin(radians) * radius, -Math.cos(radians) * radius);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMarker(
  ctx: CanvasRenderingContext2D,
  options: {
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
  const size = options.size ?? 8;
  const color = options.color ?? '#f5d142';
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = options.strokeColor ?? color;
  ctx.lineWidth = options.strokeWidth ?? 1;
  ctx.beginPath();
  if (options.shape === 'circle') {
    ctx.arc(options.x, options.y, size / 2, 0, Math.PI * 2);
  } else {
    const direction = options.direction ?? 'up';
    if (direction === 'down') {
      ctx.moveTo(options.x, options.y + size / 2);
      ctx.lineTo(options.x - size / 2, options.y - size / 2);
      ctx.lineTo(options.x + size / 2, options.y - size / 2);
    } else {
      ctx.moveTo(options.x, options.y - size / 2);
      ctx.lineTo(options.x - size / 2, options.y + size / 2);
      ctx.lineTo(options.x + size / 2, options.y + size / 2);
    }
    ctx.closePath();
  }
  ctx.fill();
  if (options.strokeColor) ctx.stroke();
  ctx.restore();
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
