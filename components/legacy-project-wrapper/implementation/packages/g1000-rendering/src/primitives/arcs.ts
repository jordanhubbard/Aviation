// Arc Indicators Implementation

export type ArcIndicatorOptions = {
  startDeg?: number;
  endDeg?: number;
  radiusPx?: number;
  thicknessPx?: number;
  color?: string;
  lineCap?: CanvasLineCap;
};

export function drawArcIndicator(
  ctx: CanvasRenderingContext2D,
  viewportOrValue: { x: number; y: number; width: number; height: number } | number,
  options: ArcIndicatorOptions = {}
): void {
  const viewport = typeof viewportOrValue === 'number'
    ? { x: 0, y: 0, width: viewportOrValue * 2, height: viewportOrValue * 2 }
    : viewportOrValue;
  const radius = options.radiusPx ?? Math.min(viewport.width, viewport.height) / 2;
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  ctx.save();
  ctx.strokeStyle = options.color ?? '#e2e8f0';
  ctx.lineWidth = options.thicknessPx ?? 2;
  ctx.lineCap = options.lineCap ?? 'round';
  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    radius,
    ((options.startDeg ?? 0) * Math.PI) / 180,
    ((options.endDeg ?? 360) * Math.PI) / 180,
  );
  ctx.stroke();
  ctx.restore();
}
