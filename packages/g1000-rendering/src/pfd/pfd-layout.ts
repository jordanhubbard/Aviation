/**
 * PFD Layout module
 * Implements the Primary Flight Display layout and instrument arrangement
 */

import { TapeRenderer, TapeConfig } from '../primitives/tape';
import { AttitudeSphereRenderer, AttitudeSphereConfig } from '../primitives/attitude-sphere';
import { CompassRoseRenderer, CompassRoseConfig } from '../primitives/compass-rose';

export interface PFDLayoutConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  theme: string;
}

export interface FlightData {
  altitude: number;
  airspeed: number;
  verticalSpeed: number;
  heading: number;
  pitch: number;
  roll: number;
}

export class PFDLayout {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: PFDLayoutConfig;
  private flightData: FlightData;

  constructor(config: PFDLayoutConfig) {
    this.canvas = config.canvas;
    this.ctx = this.canvas.getContext('2d')!;
    this.config = config;
    this.flightData = {
      altitude: 5000,
      airspeed: 120,
      verticalSpeed: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
    };
  }

  setFlightData(data: Partial<FlightData>): void {
    this.flightData = { ...this.flightData, ...data };
  }

  render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.config.width, this.config.height);

    // Render attitude sphere (center)
    const attitudeConfig: AttitudeSphereConfig = {
      x: this.config.width / 2,
      y: this.config.height / 2,
      radius: 150,
      pitch: this.flightData.pitch,
      roll: this.flightData.roll,
    };
    const attitudeRenderer = new AttitudeSphereRenderer(this.ctx, attitudeConfig);
    attitudeRenderer.render();

    // Render altitude tape (right side)
    const altitudeConfig: TapeConfig = {
      x: this.config.width - 80,
      y: this.config.height / 2 - 150,
      width: 60,
      height: 300,
      min: 0,
      max: 10000,
      current: this.flightData.altitude,
      unit: 'ft',
      majorTickInterval: 1000,
      minorTickInterval: 100,
    };
    const altitudeRenderer = new TapeRenderer(this.ctx, altitudeConfig);
    altitudeRenderer.render();

    // Render airspeed tape (left side)
    const airspeedConfig: TapeConfig = {
      x: 20,
      y: this.config.height / 2 - 150,
      width: 60,
      height: 300,
      min: 0,
      max: 250,
      current: this.flightData.airspeed,
      unit: 'kt',
      majorTickInterval: 20,
      minorTickInterval: 5,
    };
    const airspeedRenderer = new TapeRenderer(this.ctx, airspeedConfig);
    airspeedRenderer.render();

    // Render compass rose (bottom)
    const compassConfig: CompassRoseConfig = {
      x: this.config.width / 2,
      y: this.config.height - 100,
      radius: 80,
      heading: this.flightData.heading,
    };
    const compassRenderer = new CompassRoseRenderer(this.ctx, compassConfig);
    compassRenderer.render();

    // Render vertical speed indicator (bottom right)
    this.renderVerticalSpeedIndicator();
  }

  private renderVerticalSpeedIndicator(): void {
    const x = this.config.width - 80;
    const y = this.config.height - 100;
    const size = 60;

    // Draw background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);

    // Draw scale
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      const angle = (i / 5) * Math.PI - Math.PI / 2;
      const x1 = x + Math.cos(angle) * (size / 2 - 5);
      const y1 = y + Math.sin(angle) * (size / 2 - 5);
      const x2 = x + Math.cos(angle) * (size / 2 - 10);
      const y2 = y + Math.sin(angle) * (size / 2 - 10);

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    // Draw needle
    const needleAngle = (this.flightData.verticalSpeed / 5000) * Math.PI - Math.PI / 2;
    const needleX = x + Math.cos(needleAngle) * (size / 2 - 15);
    const needleY = y + Math.sin(needleAngle) * (size / 2 - 15);

    this.ctx.strokeStyle = '#00FF00';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(needleX, needleY);
    this.ctx.stroke();
  }
}
