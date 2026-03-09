/**
 * Primary Flight Display (PFD) Renderer
 * Renders the main flight instruments and attitude indicator
 */

import { RenderContext, DisplayState, RenderOptions, ThemeColors } from '../types';

export class PFDRenderer {
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
   * Render the complete PFD display
   */
  render(state: DisplayState, options?: RenderOptions): void {
    this.clearCanvas();
    this.drawBackground();
    this.drawAttitudeIndicator(state);
    this.drawAirspeedIndicator(state);
    this.drawAltitudeIndicator(state);
    this.drawVerticalSpeedIndicator(state);
    this.drawHeadingIndicator(state);
    this.drawNavigation(state);
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
   * Draw the attitude indicator (artificial horizon)
   */
  private drawAttitudeIndicator(state: DisplayState): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = 80;

    // Draw circle
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Draw horizon line
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((state.roll * Math.PI) / 180);

    // Sky (blue)
    this.ctx.fillStyle = '#1e3a8a';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Pitch lines
    this.ctx.strokeStyle = this.theme.foreground;
    this.ctx.lineWidth = 1;
    for (let i = -90; i <= 90; i += 10) {
      const y = (i - state.pitch) * 2;
      if (Math.abs(y) < radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(-30, y);
        this.ctx.lineTo(30, y);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  /**
   * Draw the airspeed indicator
   */
  private drawAirspeedIndicator(state: DisplayState): void {
    const x = 50;
    const y = this.height / 2;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`SPD: ${Math.round(state.airspeed)} kt`, x, y);
  }

  /**
   * Draw the altitude indicator
   */
  private drawAltitudeIndicator(state: DisplayState): void {
    const x = this.width - 100;
    const y = this.height / 2;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`ALT: ${Math.round(state.altitude)} ft`, x, y);
  }

  /**
   * Draw the vertical speed indicator
   */
  private drawVerticalSpeedIndicator(state: DisplayState): void {
    const x = this.width - 100;
    const y = this.height / 2 + 30;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`VS: ${Math.round(state.verticalSpeed)} fpm`, x, y);
  }

  /**
   * Draw the heading indicator
   */
  private drawHeadingIndicator(state: DisplayState): void {
    const x = this.width / 2;
    const y = this.height - 50;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`HDG: ${Math.round(state.heading)}°`, x, y);
  }

  /**
   * Draw navigation information
   */
  private drawNavigation(state: DisplayState): void {
    const x = 50;
    const y = this.height - 50;
    this.ctx.fillStyle = this.theme.foreground;
    this.ctx.font = '10px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`LAT: ${state.latitude.toFixed(4)}°`, x, y);
    this.ctx.fillText(`LON: ${state.longitude.toFixed(4)}°`, x, y + 15);
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
