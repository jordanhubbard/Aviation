/**
 * PFD Layout Engine
 * 
 * Manages dynamic positioning and layout of PFD elements including:
 * - Attitude indicator
 * - Airspeed tape
 * - Altimeter tape
 * - HSI (Horizontal Situation Indicator)
 * - Alert overlays
 */

export interface LayoutConfig {
  width: number;
  height: number;
  theme: 'day' | 'night' | 'high-contrast';
  scale: number;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PFDLayout {
  canvas: ElementPosition;
  attitudeIndicator: ElementPosition;
  airspeedTape: ElementPosition;
  altimeterTape: ElementPosition;
  hsi: ElementPosition;
  alertOverlay: ElementPosition;
  verticalSpeedIndicator: ElementPosition;
}

/**
 * PFDLayoutEngine
 * Calculates optimal positioning for all PFD elements based on canvas size
 */
export class PFDLayoutEngine {
  private config: LayoutConfig;
  private layout: PFDLayout;

  constructor(config: LayoutConfig) {
    this.config = config;
    this.layout = this.calculateLayout();
  }

  /**
   * Calculate layout positions for all PFD elements
   * Standard G1000 PFD layout:
   * - Center: Attitude indicator (primary)
   * - Left: Airspeed tape
   * - Right: Altimeter and VSI
   * - Bottom: HSI (Horizontal Situation Indicator)
   * - Top: Alerts and annunciations
   */
  private calculateLayout(): PFDLayout {
    const { width, height, scale } = this.config;
    const centerX = width / 2;
    const centerY = height / 2;

    // Attitude indicator - center of display, largest element
    const attitudeSize = Math.min(width, height) * 0.6 * scale;
    const attitudeX = centerX - attitudeSize / 2;
    const attitudeY = centerY - attitudeSize / 2;

    // Airspeed tape - left side
    const tapeWidth = width * 0.12 * scale;
    const tapeHeight = attitudeSize;
    const airspeedX = attitudeX - tapeWidth - width * 0.02;
    const airspeedY = attitudeY;

    // Altimeter tape - right side
    const altimeterX = attitudeX + attitudeSize + width * 0.02;
    const altimeterY = attitudeY;

    // VSI (Vertical Speed Indicator) - right side, below altimeter
    const vsiWidth = tapeWidth;
    const vsiHeight = height * 0.15 * scale;
    const vsiX = altimeterX;
    const vsiY = altimeterY + tapeHeight + height * 0.02;

    // HSI - bottom center
    const hsiSize = Math.min(width * 0.35, height * 0.25) * scale;
    const hsiX = centerX - hsiSize / 2;
    const hsiY = height - hsiSize - height * 0.05;

    // Alert overlay - top of display
    const alertHeight = height * 0.1 * scale;
    const alertX = 0;
    const alertY = 0;

    return {
      canvas: { x: 0, y: 0, width, height },
      attitudeIndicator: {
        x: attitudeX,
        y: attitudeY,
        width: attitudeSize,
        height: attitudeSize,
      },
      airspeedTape: {
        x: airspeedX,
        y: airspeedY,
        width: tapeWidth,
        height: tapeHeight,
      },
      altimeterTape: {
        x: altimeterX,
        y: altimeterY,
        width: tapeWidth,
        height: tapeHeight,
      },
      verticalSpeedIndicator: {
        x: vsiX,
        y: vsiY,
        width: vsiWidth,
        height: vsiHeight,
      },
      hsi: {
        x: hsiX,
        y: hsiY,
        width: hsiSize,
        height: hsiSize,
      },
      alertOverlay: {
        x: alertX,
        y: alertY,
        width: width,
        height: alertHeight,
      },
    };
  }

  /**
   * Get the calculated layout
   */
  getLayout(): PFDLayout {
    return this.layout;
  }

  /**
   * Get position for a specific element
   */
  getElementPosition(element: keyof Omit<PFDLayout, 'canvas'>): ElementPosition {
    return this.layout[element];
  }

  /**
   * Update layout when canvas is resized
   */
  updateCanvasSize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.layout = this.calculateLayout();
  }

  /**
   * Update theme and recalculate if needed
   */
  setTheme(theme: 'day' | 'night' | 'high-contrast'): void {
    this.config.theme = theme;
  }

  /**
   * Get current configuration
   */
  getConfig(): LayoutConfig {
    return { ...this.config };
  }
}

/**
 * Helper function to create a layout engine with default configuration
 */
export function createPFDLayout(
  width: number,
  height: number,
  theme: 'day' | 'night' | 'high-contrast' = 'day',
  scale: number = 1
): PFDLayoutEngine {
  return new PFDLayoutEngine({ width, height, theme, scale });
}
