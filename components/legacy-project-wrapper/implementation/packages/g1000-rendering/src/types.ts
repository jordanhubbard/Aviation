/**
 * Core types for G1000 rendering system
 */

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpi: number;
}

export interface DisplayState {
  heading: number;
  altitude: number;
  airspeed: number;
  verticalSpeed: number;
  roll: number;
  pitch: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  warning: string;
  caution: string;
  safe: string;
}

export interface RenderOptions {
  theme?: ThemeColors;
  scale?: number;
  showDebug?: boolean;
}
