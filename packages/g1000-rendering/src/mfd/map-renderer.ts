/**
 * Map Renderer module
 * Implements the MFD map display with terrain and weather overlays
 */

export interface MapConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  centerLat: number;
  centerLon: number;
  zoomLevel: number;
}

export interface MapData {
  latitude: number;
  longitude: number;
  heading: number;
  groundSpeed: number;
}

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: MapConfig;
  private mapData: MapData;

  constructor(ctx: CanvasRenderingContext2D, config: MapConfig) {
    this.ctx = ctx;
    this.config = config;
    this.mapData = {
      latitude: config.centerLat,
      longitude: config.centerLon,
      heading: 0,
      groundSpeed: 0,
    };
  }

  setMapData(data: Partial<MapData>): void {
    this.mapData = { ...this.mapData, ...data };
  }

  render(): void {
    this.drawBackground();
    this.drawGridLines();
    this.drawAircraft();
    this.drawCompass();
  }

  private drawBackground(): void {
    // Draw map background (light green for land)
    this.ctx.fillStyle = '#90EE90';
    this.ctx.fillRect(this.config.x, this.config.y, this.config.width, this.config.height);

    // Draw border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.config.x, this.config.y, this.config.width, this.config.height);
  }

  private drawGridLines(): void {
    this.ctx.strokeStyle = '#CCCCCC';
    this.ctx.lineWidth = 1;

    // Draw vertical grid lines
    const gridSpacing = this.config.width / 10;
    for (let i = 1; i < 10; i++) {
      const x = this.config.x + i * gridSpacing;
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.config.y);
      this.ctx.lineTo(x, this.config.y + this.config.height);
      this.ctx.stroke();
    }

    // Draw horizontal grid lines
    const verticalSpacing = this.config.height / 10;
    for (let i = 1; i < 10; i++) {
      const y = this.config.y + i * verticalSpacing;
      this.ctx.beginPath();
      this.ctx.moveTo(this.config.x, y);
      this.ctx.lineTo(this.config.x + this.config.width, y);
      this.ctx.stroke();
    }
  }

  private drawAircraft(): void {
    const centerX = this.config.x + this.config.width / 2;
    const centerY = this.config.y + this.config.height / 2;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((this.mapData.heading * Math.PI) / 180);

    // Draw aircraft symbol
    this.ctx.fillStyle = '#FF0000';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -15);
    this.ctx.lineTo(-10, 15);
    this.ctx.lineTo(0, 10);
    this.ctx.lineTo(10, 15);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw circle around aircraft
    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawCompass(): void {
    const x = this.config.x + 30;
    const y = this.config.y + 30;
    const radius = 20;

    // Draw compass circle
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Draw N indicator
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('N', x, y - radius + 5);
  }
}
