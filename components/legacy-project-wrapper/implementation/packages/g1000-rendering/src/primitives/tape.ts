/**
 * Tape rendering module
 * Implements vertical and horizontal tape displays for altitude, airspeed, VSI, etc.
 */

export interface TapeConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  min: number;
  max: number;
  current: number;
  unit: string;
  majorTickInterval: number;
  minorTickInterval: number;
}

export class TapeRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: TapeConfig;

  constructor(ctx: CanvasRenderingContext2D, config: TapeConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  render(): void {
    this.drawBackground();
    this.drawTicks();
    this.drawLabels();
    this.drawPointer();
  }

  private drawBackground(): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(this.config.x, this.config.y, this.config.width, this.config.height);
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.config.x, this.config.y, this.config.width, this.config.height);
  }

  private drawTicks(): void {
    const range = this.config.max - this.config.min;
    const pixelsPerUnit = this.config.height / range;

    // Draw major ticks
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    for (let value = this.config.min; value <= this.config.max; value += this.config.majorTickInterval) {
      const y = this.config.y + this.config.height - (value - this.config.min) * pixelsPerUnit;
      this.ctx.beginPath();
      this.ctx.moveTo(this.config.x + this.config.width - 10, y);
      this.ctx.lineTo(this.config.x + this.config.width, y);
      this.ctx.stroke();
    }

    // Draw minor ticks
    this.ctx.lineWidth = 1;
    for (let value = this.config.min; value <= this.config.max; value += this.config.minorTickInterval) {
      if (value % this.config.majorTickInterval !== 0) {
        const y = this.config.y + this.config.height - (value - this.config.min) * pixelsPerUnit;
        this.ctx.beginPath();
        this.ctx.moveTo(this.config.x + this.config.width - 5, y);
        this.ctx.lineTo(this.config.x + this.config.width, y);
        this.ctx.stroke();
      }
    }
  }

  private drawLabels(): void {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'right';

    const range = this.config.max - this.config.min;
    const pixelsPerUnit = this.config.height / range;

    for (let value = this.config.min; value <= this.config.max; value += this.config.majorTickInterval) {
      const y = this.config.y + this.config.height - (value - this.config.min) * pixelsPerUnit;
      this.ctx.fillText(value.toString(), this.config.x + this.config.width - 15, y + 4);
    }
  }

  private drawPointer(): void {
    const range = this.config.max - this.config.min;
    const pixelsPerUnit = this.config.height / range;
    const pointerY = this.config.y + this.config.height - (this.config.current - this.config.min) * pixelsPerUnit;

    // Draw pointer triangle
    this.ctx.fillStyle = '#00FF00';
    this.ctx.beginPath();
    this.ctx.moveTo(this.config.x, pointerY - 5);
    this.ctx.lineTo(this.config.x, pointerY + 5);
    this.ctx.lineTo(this.config.x + 10, pointerY);
    this.ctx.closePath();
    this.ctx.fill();
  }
}
