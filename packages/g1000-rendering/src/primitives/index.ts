export type Viewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TapeStyle = {
  backgroundColor: string;
  tickColor: string;
  textColor: string;
  accentColor: string;
  font: string;
};

export type TapeLabelFormatter = (value: number) => string;

export type TapeOptions = {
  value: number;
  min: number;
  max: number;
  majorTick: number;
  minorTick: number;
  labelStep: number;
  pixelsPerUnit?: number;
  tickLengthMajor?: number;
  tickLengthMinor?: number;
  labelOffset?: number;
  showCurrentValue?: boolean;
  labelFormatter?: TapeLabelFormatter;
  units?: string;
  style: TapeStyle;
};

export type AttitudeSphereOptions = {
  pitchDeg: number;
  rollDeg: number;
  pixelsPerDeg: number;
  skyColor: string;
  groundColor: string;
  horizonColor: string;
};

export type CompassRoseOptions = {
  headingDeg: number;
  radiusPx: number;
  tickStepDeg: number;
  labelStepDeg: number;
  color: string;
  font: string;
};

export type ArcOptions = {
  startDeg: number;
  endDeg: number;
  radiusPx: number;
  thicknessPx: number;
  color: string;
  lineCap?: CanvasLineCap;
};

export type TextOptions = {
  text: string;
  x: number;
  y: number;
  color: string;
  font: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
};

export type MarkerShape = 'triangle' | 'diamond' | 'circle';

export type MarkerDirection = 'up' | 'down' | 'left' | 'right';

export type MarkerOptions = {
  x: number;
  y: number;
  size: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  shape?: MarkerShape;
  direction?: MarkerDirection;
};

export const DEFAULT_TAPE_STYLE: TapeStyle = {
  backgroundColor: '#0b1218',
  tickColor: '#9fb3c8',
  textColor: '#e6edf3',
  accentColor: '#4bb2e5',
  font: '12px "Fira Sans", sans-serif',
};

export const DEFAULT_TAPE_OPTIONS: TapeOptions = {
  value: 0,
  min: 0,
  max: 200,
  majorTick: 10,
  minorTick: 5,
  labelStep: 20,
  pixelsPerUnit: 2.5,
  tickLengthMajor: 16,
  tickLengthMinor: 8,
  labelOffset: 8,
  showCurrentValue: true,
  units: 'KT',
  style: DEFAULT_TAPE_STYLE,
};

export const DEFAULT_ATTITUDE_OPTIONS: AttitudeSphereOptions = {
  pitchDeg: 0,
  rollDeg: 0,
  pixelsPerDeg: 3,
  skyColor: '#2f8ad8',
  groundColor: '#8b4c1f',
  horizonColor: '#f5f5f5',
};

export const DEFAULT_COMPASS_OPTIONS: CompassRoseOptions = {
  headingDeg: 0,
  radiusPx: 60,
  tickStepDeg: 10,
  labelStepDeg: 30,
  color: '#9fb3c8',
  font: '12px "Fira Sans", sans-serif',
};

export const DEFAULT_ARC_OPTIONS: ArcOptions = {
  startDeg: 0,
  endDeg: 90,
  radiusPx: 40,
  thicknessPx: 4,
  color: '#4bb2e5',
};

export const DEFAULT_TEXT_OPTIONS: TextOptions = {
  text: '---',
  x: 0,
  y: 0,
  color: '#e6edf3',
  font: '12px "Fira Sans", sans-serif',
  align: 'center',
  baseline: 'middle',
};

export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180;

export const normalizeDegrees = (degrees: number): number => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

export const withRotation = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  angleDeg: number,
  draw: () => void
): void => {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(degToRad(angleDeg));
  ctx.translate(-centerX, -centerY);
  draw();
  ctx.restore();
};

export const withScale = (
  ctx: CanvasRenderingContext2D,
  scaleX: number,
  scaleY: number,
  draw: () => void
): void => {
  ctx.save();
  ctx.scale(scaleX, scaleY);
  draw();
  ctx.restore();
};

export const drawTape = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  options: TapeOptions
): void => {
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const pixelsPerUnit = options.pixelsPerUnit ?? 2.5;
  const tickLengthMajor = options.tickLengthMajor ?? 16;
  const tickLengthMinor = options.tickLengthMinor ?? 8;
  const labelOffset = options.labelOffset ?? 8;
  const formatLabel = options.labelFormatter ?? ((value: number) => `${Math.round(value)}`);

  ctx.save();
  ctx.fillStyle = options.style.backgroundColor;
  ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.strokeStyle = options.style.accentColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);

  ctx.strokeStyle = options.style.tickColor;
  ctx.fillStyle = options.style.textColor;
  ctx.font = options.style.font;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const ticksVisible = Math.ceil(viewport.height / (options.minorTick * pixelsPerUnit)) + 2;
  for (let index = -ticksVisible; index <= ticksVisible; index += 1) {
    const tickValue = options.value + index * options.minorTick;
    if (tickValue < options.min || tickValue > options.max) {
      continue;
    }
    const y = centerY - index * options.minorTick * pixelsPerUnit;
    const isMajor = Math.abs(tickValue % options.majorTick) < 0.001 || options.majorTick === options.minorTick;
    const tickLength = isMajor ? tickLengthMajor : tickLengthMinor;
    ctx.beginPath();
    ctx.moveTo(viewport.x + viewport.width - tickLength, y);
    ctx.lineTo(viewport.x + viewport.width, y);
    ctx.stroke();

    if (isMajor && Math.abs(tickValue % options.labelStep) < 0.001) {
      ctx.fillText(
        formatLabel(tickValue),
        viewport.x + viewport.width - tickLength - labelOffset,
        y
      );
    }
  }

  if (options.showCurrentValue !== false) {
    ctx.fillStyle = options.style.accentColor;
    ctx.textAlign = 'center';
    const label = `${Math.round(options.value)}${options.units ? ` ${options.units}` : ''}`;
    ctx.fillText(label, centerX, centerY);
  }

  ctx.restore();
};

export const drawAttitudeSphere = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  options: AttitudeSphereOptions
): void => {
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const horizonOffset = options.pitchDeg * options.pixelsPerDeg;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(degToRad(-options.rollDeg));

  ctx.fillStyle = options.skyColor;
  ctx.fillRect(-halfWidth, -halfHeight - horizonOffset, viewport.width, halfHeight + horizonOffset);

  ctx.fillStyle = options.groundColor;
  ctx.fillRect(-halfWidth, -horizonOffset, viewport.width, halfHeight + horizonOffset);

  ctx.strokeStyle = options.horizonColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-halfWidth, -horizonOffset);
  ctx.lineTo(halfWidth, -horizonOffset);
  ctx.stroke();

  ctx.restore();
};

export const drawCompassRose = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  options: CompassRoseOptions
): void => {
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const labelOffset = 12;
  const majorTickLength = 12;
  const minorTickLength = 6;
  const formatLabel = (degrees: number): string => {
    const heading = normalizeDegrees(degrees);
    if (heading === 0) return 'N';
    if (heading === 90) return 'E';
    if (heading === 180) return 'S';
    if (heading === 270) return 'W';
    return `${Math.round(heading / 10)}`;
  };
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.strokeStyle = options.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, options.radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = options.color;
  ctx.font = options.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let tick = 0; tick < 360; tick += options.tickStepDeg) {
    const isMajor = tick % options.labelStepDeg === 0;
    const tickLength = isMajor ? majorTickLength : minorTickLength;
    const tickAngle = tick - options.headingDeg;
    const startY = -options.radiusPx;
    const endY = -options.radiusPx + tickLength;
    withRotation(ctx, 0, 0, tickAngle, () => {
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(0, endY);
      ctx.stroke();
      if (isMajor) {
        ctx.fillText(formatLabel(tick), 0, endY + labelOffset);
      }
    });
  }
  ctx.fillText(`${Math.round(normalizeDegrees(options.headingDeg))}`, 0, 0);
  ctx.restore();
};

export const drawArcIndicator = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  options: ArcOptions
): void => {
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  ctx.save();
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.thicknessPx;
  ctx.lineCap = options.lineCap ?? 'round';
  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    options.radiusPx,
    degToRad(options.startDeg),
    degToRad(options.endDeg)
  );
  ctx.stroke();
  ctx.restore();
};

export const drawMarker = (
  ctx: CanvasRenderingContext2D,
  options: MarkerOptions
): void => {
  const shape = options.shape ?? 'triangle';
  const direction = options.direction ?? 'up';
  const size = options.size;
  const half = size / 2;
  const angleMap: Record<MarkerDirection, number> = {
    up: 0,
    right: 90,
    down: 180,
    left: 270,
  };

  ctx.save();
  ctx.translate(options.x, options.y);
  ctx.rotate(degToRad(angleMap[direction]));
  ctx.fillStyle = options.color;
  ctx.strokeStyle = options.strokeColor ?? options.color;
  ctx.lineWidth = options.strokeWidth ?? 1;
  ctx.beginPath();

  if (shape === 'circle') {
    ctx.arc(0, 0, half, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.moveTo(0, -half);
    ctx.lineTo(half, 0);
    ctx.lineTo(0, half);
    ctx.lineTo(-half, 0);
    ctx.closePath();
  } else {
    ctx.moveTo(0, -half);
    ctx.lineTo(half, half);
    ctx.lineTo(-half, half);
    ctx.closePath();
  }

  ctx.fill();
  if (options.strokeColor) {
    ctx.stroke();
  }
  ctx.restore();
};

export const drawText = (
  ctx: CanvasRenderingContext2D,
  options: TextOptions
): void => {
  ctx.save();
  ctx.fillStyle = options.color;
  ctx.font = options.font;
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  if (options.maxWidth !== undefined) {
    ctx.fillText(options.text, options.x, options.y, options.maxWidth);
  } else {
    ctx.fillText(options.text, options.x, options.y);
  }
  ctx.restore();
};
