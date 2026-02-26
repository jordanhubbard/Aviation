/**
 * Multi-Function Display (MFD) Renderer
 * Renders navigation, weather, and system information
 */

import { RenderContext, DisplayState, RenderOptions, ThemeColors } from '../types';

export class MFDRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private theme: ThemeColors;

  constructor(context: RenderContext, theme?: ThemeColors) {
    this.ctx = context.ctx;
    this.width = context.width;
    this.height = context.height;
    this.theme = theme || this.getDefaultTheme();
  }

  /**
   * Render the complete MFD display
   */
  render(state: DisplayState, options?: RenderOptions): void {
    this.clearCanvas();
    this.drawBackground();
    this.drawMapArea(state);
    this.drawWeatherInfo(state);
    this.drawSystemStatus(state);
  }

  /**
   * Clear the canvas
   */
  private clearCanvas(): void {
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw the background
   */
  private drawBackground(): void {
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, 10, this.width - 20, this.height - 20);
  }

  /**
   * Draw the map area
   */
  private drawMapArea(state: DisplayState): void {
    const mapX = 20;
    const mapY = 20;
    const mapWidth = this.width - 220;
    const mapHeight = this.height - 40;

    // Draw map border
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);

    // Draw grid
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.globalAlpha = 0.3;
    const gridSize = 50;
    for (let x = mapX; x < mapX + mapWidth; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, mapY);
      this.ctx.lineTo(x, mapY + mapHeight);
      this.ctx.stroke();
    }
    for (let y = mapY; y < mapY + mapHeight; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(mapX, y);
      this.ctx.lineTo(mapX + mapWidth, y);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1.0;

    // Draw aircraft symbol at center
    const centerX = mapX + mapWidth / 2;
    const centerY = mapY + mapHeight / 2;
    this.drawAircraftSymbol(centerX, centerY, state.heading);

    // Draw coordinates
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`${state.latitude.toFixed(4)}°`, mapX + 10, mapY + 15);
    this.ctx.fillText(`${state.longitude.toFixed(4)}°`, mapX + 10, mapY + 30);
  }

  /**
   * Draw aircraft symbol
   */
  private drawAircraftSymbol(x: number, y: number, heading: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate((heading * Math.PI) / 180);

    // Draw aircraft shape
    this.ctx.strokeStyle = this.theme.accent;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -15); // Nose
    this.ctx.lineTo(-8, 10); // Left wing
    this.ctx.lineTo(0, 5); // Center
    this.ctx.lineTo(8, 10); // Right wing
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Draw weather information
   */
  private drawWeatherInfo(state: DisplayState): void {
    const x = this.width - 200;
    const y = 30;

    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillText('WEATHER', x, y);

    this.ctx.font = '10px monospace';
    this.ctx.fillText('Wind: 180/15kt', x, y + 20);
    this.ctx.fillText('Temp: 15°C', x, y + 35);
    this.ctx.fillText('Altimeter: 29.92', x, y + 50);
  }

  /**
   * Draw system status
   */
  private drawSystemStatus(state: DisplayState): void {
    const x = this.width - 200;
    const y = this.height - 100;

    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillText('SYSTEM', x, y);

    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = this.theme.safe;
    this.ctx.fillText('✓ GPS', x, y + 20);
    this.ctx.fillText('✓ AHRS', x, y + 35);
    this.ctx.fillText('✓ Engine', x, y + 50);
  }

  /**
   * Get default theme colors
   */
  private getDefaultTheme(): ThemeColors {
    return {
      background: '#000000',
      foreground: '#00ff00',
      accent: '#ffff00',
      warning: '#ff6600',
      caution: '#ffff00',
      safe: '#00ff00',
    };
  }

  /**
   * Update the theme
   */
  setTheme(theme: ThemeColors): void {
    this.theme = theme;
  }
}
