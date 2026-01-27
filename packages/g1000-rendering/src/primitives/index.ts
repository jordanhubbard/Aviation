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

export type TapeOptions = {
  value: number;
  min: number;
  max: number;
  majorTick: number;
  minorTick: number;
  labelStep: number;
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
};

export type TextOptions = {
  text: string;
  x: number;
  y: number;
  color: string;
  font: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
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

export const drawTape = (
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  options: TapeOptions
): void => {
  ctx.save();
  ctx.fillStyle = options.style.backgroundColor;
  ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.strokeStyle = options.style.accentColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.fillStyle = options.style.textColor;
  ctx.font = options.style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const label = `${Math.round(options.value)}${options.units ? ` ${options.units}` : ''}`;
  ctx.fillText(label, centerX, centerY);
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
  ctx.rotate((-options.rollDeg * Math.PI) / 180);

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
  ctx.fillText(`${Math.round(options.headingDeg)}`, 0, 0);
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
  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    options.radiusPx,
    (options.startDeg * Math.PI) / 180,
    (options.endDeg * Math.PI) / 180
  );
  ctx.stroke();
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
  ctx.fillText(options.text, options.x, options.y);
  ctx.restore();
};
