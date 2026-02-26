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
    this.drawMapView(state);
    this.drawSystemStatus(state);
    this.drawWeatherInfo(state);
  }

  /**
   * Clear the canvas
   */
  private clearCanvas(): void {
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw the background grid and borders
   */
  private drawBackground(): void {
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, 10, this.width - 20, this.height - 20);
  }

  /**
   * Draw the map view with aircraft position
   */
  private drawMapView(state: DisplayState): void {
    const mapX = 30;
    const mapY = 30;
    const mapWidth = this.width - 60;
    const mapHeight = this.height - 120;

    // Draw map border
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);

    // Draw grid
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.globalAlpha = 0.3;
    for (let i = 0; i <= 10; i++) {
      const x = mapX + (mapWidth / 10) * i;
      const y = mapY + (mapHeight / 10) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(x, mapY);
      this.ctx.lineTo(x, mapY + mapHeight);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(mapX, y);
      this.ctx.lineTo(mapX + mapWidth, y);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1.0;

    // Draw aircraft position
    const aircraftX = mapX + mapWidth / 2;
    const aircraftY = mapY + mapHeight / 2;
    this.ctx.fillStyle = this.theme.accent;
    this.ctx.beginPath();
    this.ctx.arc(aircraftX, aircraftY, 5, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw heading indicator
    this.ctx.strokeStyle = this.theme.accent;
    this.ctx.lineWidth = 2;
    const headingRad = (state.heading * Math.PI) / 180;
    const lineLength = 20;
    this.ctx.beginPath();
    this.ctx.moveTo(aircraftX, aircraftY);
    this.ctx.lineTo(
      aircraftX + Math.sin(headingRad) * lineLength,
      aircraftY - Math.cos(headingRad) * lineLength
    );
    this.ctx.stroke();
  }

  /**
   * Draw system status information
   */
  private drawSystemStatus(state: DisplayState): void {
    const x = 30;
    const y = this.height - 80;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '11px monospace';
    this.ctx.textAlign = 'left';

    this.ctx.fillText(`GPS: ${state.latitude.toFixed(4)}° ${state.longitude.toFixed(4)}°`, x, y);
    this.ctx.fillText(`TIME: ${new Date(state.timestamp).toUTCString()}`, x, y + 15);
    this.ctx.fillText(`STATUS: OK`, x, y + 30);
  }

  /**
   * Draw weather information
   */
  private drawWeatherInfo(state: DisplayState): void {
    const x = this.width - 200;
    const y = this.height - 80;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '11px monospace';
    this.ctx.textAlign = 'left';

    this.ctx.fillText(`WEATHER: CLEAR`, x, y);
    this.ctx.fillText(`WIND: 180° @ 5kt`, x, y + 15);
    this.ctx.fillText(`TEMP: 15°C`, x, y + 30);
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
