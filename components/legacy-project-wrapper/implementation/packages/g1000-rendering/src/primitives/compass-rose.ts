/**
 * Compass Rose rendering module
 * Implements the heading indicator display
 */

export interface CompassRoseConfig {
  x: number;
  y: number;
  radius: number;
  heading: number; // degrees (0-360)
}

export class CompassRoseRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: CompassRoseConfig;

  constructor(ctx: CanvasRenderingContext2D, config: CompassRoseConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  render(): void {
    this.ctx.save();
    this.ctx.translate(this.config.x, this.config.y);

    this.drawBackground();
    this.drawCompassRose();
    this.drawHeadingBug();
    this.drawAirplaneSymbol();

    this.ctx.restore();
  }

  private drawBackground(): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.config.radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.config.radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawCompassRose(): void {
    this.ctx.save();
    this.ctx.rotate((-this.config.heading * Math.PI) / 180);

    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Draw cardinal directions
    const directions = [
      { label: 'N', angle: 0 },
      { label: 'E', angle: 90 },
      { label: 'S', angle: 180 },
      { label: 'W', angle: 270 },
    ];

    directions.forEach((dir) => {
      const rad = (dir.angle * Math.PI) / 180;
      const x = Math.sin(rad) * (this.config.radius - 30);
      const y = -Math.cos(rad) * (this.config.radius - 30);
      this.ctx.fillText(dir.label, x, y);
    });

    // Draw degree marks
    this.ctx.lineWidth = 1;
    for (let angle = 0; angle < 360; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const x1 = Math.sin(rad) * (this.config.radius - 10);
      const y1 = -Math.cos(rad) * (this.config.radius - 10);
      const x2 = Math.sin(rad) * (this.config.radius - 5);
      const y2 = -Math.cos(rad) * (this.config.radius - 5);

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      // Draw degree numbers every 10 degrees
      if (angle % 10 === 0 && angle !== 0) {
        const x = Math.sin(rad) * (this.config.radius - 25);
        const y = -Math.cos(rad) * (this.config.radius - 25);
        this.ctx.font = '10px Arial';
        this.ctx.fillText((angle / 10).toString(), x, y);
      }
    }

    this.ctx.restore();
  }

  private drawHeadingBug(): void {
    // Draw heading bug (triangle at top)
    this.ctx.fillStyle = '#FF6600';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -this.config.radius - 5);
    this.ctx.lineTo(-8, -this.config.radius + 10);
    this.ctx.lineTo(8, -this.config.radius + 10);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawAirplaneSymbol(): void {
    // Draw airplane symbol (triangle pointing up)
    this.ctx.fillStyle = '#FFFF00';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -10);
    this.ctx.lineTo(-8, 10);
    this.ctx.lineTo(8, 10);
    this.ctx.closePath();
    this.ctx.fill();
  }
}
