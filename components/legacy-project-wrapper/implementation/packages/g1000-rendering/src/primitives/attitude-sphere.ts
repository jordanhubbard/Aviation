/**
 * Attitude Sphere rendering module
 * Implements the attitude indicator (artificial horizon) display
 */

export interface AttitudeSphereConfig {
  x: number;
  y: number;
  radius: number;
  pitch: number; // degrees
  roll: number; // degrees
}

export class AttitudeSphereRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: AttitudeSphereConfig;

  constructor(ctx: CanvasRenderingContext2D, config: AttitudeSphereConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  render(): void {
    this.ctx.save();
    this.ctx.translate(this.config.x, this.config.y);
    this.ctx.rotate((this.config.roll * Math.PI) / 180);

    this.drawSkyGround();
    this.drawPitchLadder();
    this.drawRollIndicator();
    this.drawAirplane();

    this.ctx.restore();
  }

  private drawSkyGround(): void {
    // Draw sky (blue)
    this.ctx.fillStyle = '#0066CC';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.config.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw ground (brown)
    const pitchOffset = (this.config.pitch / 90) * this.config.radius;
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(-this.config.radius, pitchOffset, this.config.radius * 2, this.config.radius);

    // Draw horizon line
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(-this.config.radius, pitchOffset);
    this.ctx.lineTo(this.config.radius, pitchOffset);
    this.ctx.stroke();
  }

  private drawPitchLadder(): void {
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.lineWidth = 1;

    for (let pitch = -90; pitch <= 90; pitch += 10) {
      const y = (pitch / 90) * this.config.radius;
      const length = pitch % 30 === 0 ? 30 : 15;

      this.ctx.beginPath();
      this.ctx.moveTo(-length / 2, y);
      this.ctx.lineTo(length / 2, y);
      this.ctx.stroke();

      if (pitch % 30 === 0 && pitch !== 0) {
        this.ctx.fillText(Math.abs(pitch).toString(), -40, y + 3);
        this.ctx.fillText(Math.abs(pitch).toString(), 40, y + 3);
      }
    }
  }

  private drawRollIndicator(): void {
    this.ctx.save();
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;

    // Draw roll scale
    for (let angle = -180; angle <= 180; angle += 10) {
      const rad = (angle * Math.PI) / 180;
      const x1 = Math.cos(rad) * (this.config.radius - 10);
      const y1 = Math.sin(rad) * (this.config.radius - 10);
      const x2 = Math.cos(rad) * (this.config.radius - 5);
      const y2 = Math.sin(rad) * (this.config.radius - 5);

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawAirplane(): void {
    // Draw airplane symbol (triangle pointing up)
    this.ctx.fillStyle = '#FFFF00';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -15);
    this.ctx.lineTo(-10, 10);
    this.ctx.lineTo(10, 10);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw circle around airplane
    this.ctx.strokeStyle = '#FFFF00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
    this.ctx.stroke();
  }
}
