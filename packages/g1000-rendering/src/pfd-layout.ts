/**
 * PFD Layout Engine
 * 
 * Manages the dynamic positioning and rendering of PFD elements.
 * Handles layout calculations, element positioning, and coordinate transformations.
 */

export interface PFDElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  zIndex: number;
}

export interface PFDLayoutConfig {
  canvasWidth: number;
  canvasHeight: number;
  theme: 'day' | 'night' | 'high-contrast';
  scale: number;
}

export class PFDLayout {
  private config: PFDLayoutConfig;
  private elements: Map<string, PFDElement> = new Map();
  private centerX: number;
  private centerY: number;

  constructor(config: PFDLayoutConfig) {
    this.config = config;
    this.centerX = config.canvasWidth / 2;
    this.centerY = config.canvasHeight / 2;
    this.initializeLayout();
  }

  private initializeLayout(): void {
    // Initialize standard PFD element positions
    // Attitude indicator in center
    this.registerElement('attitude-indicator', {
      id: 'attitude-indicator',
      x: this.centerX - 150,
      y: this.centerY - 150,
      width: 300,
      height: 300,
      visible: true,
      zIndex: 10,
    });

    // Airspeed tape on left
    this.registerElement('airspeed-tape', {
      id: 'airspeed-tape',
      x: 10,
      y: this.centerY - 150,
      width: 80,
      height: 300,
      visible: true,
      zIndex: 5,
    });

    // Altitude tape on right
    this.registerElement('altitude-tape', {
      id: 'altitude-tape',
      x: this.config.canvasWidth - 90,
      y: this.centerY - 150,
      width: 80,
      height: 300,
      visible: true,
      zIndex: 5,
    });

    // VSI on far right
    this.registerElement('vsi', {
      id: 'vsi',
      x: this.config.canvasWidth - 90,
      y: this.config.canvasHeight - 100,
      width: 80,
      height: 80,
      visible: true,
      zIndex: 5,
    });

    // HSI at bottom
    this.registerElement('hsi', {
      id: 'hsi',
      x: this.centerX - 150,
      y: this.config.canvasHeight - 160,
      width: 300,
      height: 150,
      visible: true,
      zIndex: 5,
    });

    // Alert overlay at top
    this.registerElement('alert-overlay', {
      id: 'alert-overlay',
      x: 0,
      y: 0,
      width: this.config.canvasWidth,
      height: 60,
      visible: true,
      zIndex: 100,
    });
  }

  registerElement(id: string, element: PFDElement): void {
    this.elements.set(id, element);
  }

  getElement(id: string): PFDElement | undefined {
    return this.elements.get(id);
  }

  getAllElements(): PFDElement[] {
    return Array.from(this.elements.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  updateElementPosition(id: string, x: number, y: number): void {
    const element = this.elements.get(id);
    if (element) {
      element.x = x;
      element.y = y;
    }
  }

  updateElementVisibility(id: string, visible: boolean): void {
    const element = this.elements.get(id);
    if (element) {
      element.visible = visible;
    }
  }

  setTheme(theme: 'day' | 'night' | 'high-contrast'): void {
    this.config.theme = theme;
  }

  getTheme(): 'day' | 'night' | 'high-contrast' {
    return this.config.theme;
  }

  setScale(scale: number): void {
    this.config.scale = scale;
  }

  getScale(): number {
    return this.config.scale;
  }

  getCenterX(): number {
    return this.centerX;
  }

  getCenterY(): number {
    return this.centerY;
  }

  getCanvasWidth(): number {
    return this.config.canvasWidth;
  }

  getCanvasHeight(): number {
    return this.config.canvasHeight;
  }
}
