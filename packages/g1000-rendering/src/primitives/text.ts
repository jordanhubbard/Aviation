// Text Rendering with Aviation Fonts

export interface TextOptions {
  font?: string;
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  text?: string;
  x?: number;
  y?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  textOrOptions: string | TextOptions,
  x?: number,
  y?: number,
  _options?: TextOptions
): void {
  if (typeof textOrOptions === 'string') {
    ctx.font = ctx.font || '12px sans-serif';
    ctx.fillText(textOrOptions, x ?? 0, y ?? 0);
    return;
  }
  const opts = textOrOptions;
  const text = opts.text ?? '';
  const px = opts.x ?? 0;
  const py = opts.y ?? 0;
  if (opts.font) ctx.font = opts.font;
  if (opts.color) ctx.fillStyle = opts.color;
  if (opts.align) ctx.textAlign = opts.align;
  if (opts.baseline) ctx.textBaseline = opts.baseline;
  ctx.fillText(text, px, py);
}
