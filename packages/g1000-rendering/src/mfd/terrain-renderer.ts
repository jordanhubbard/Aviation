/**
 * Terrain Renderer module
 * Implements the MFD terrain display
 */

export interface TerrainConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  elevationData: number[][]; // 2D array of elevation data
}

export class TerrainRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: TerrainConfig;

  constructor(ctx: CanvasRenderingContext2D, config: TerrainConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  render(): void {
    this.drawTerrain();
  }

  private drawTerrain(): void {
    const { x, y, width, height, elevationData } = this.config;
    const rows = elevationData.length;
    const cols = elevationData[0].length;
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const elevation = elevationData[row][col];
        const color = this.getColorForElevation(elevation);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + col * cellWidth, y + row * cellHeight, cellWidth, cellHeight);
      }
    }

    // Draw border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);
  }

  private getColorForElevation(elevation: number): string {
    if (elevation < 1000) {
      return '#228B22'; // Forest green for low elevation
    } else if (elevation < 2000) {
      return '#32CD32'; // Lime green for medium elevation
    } else {
      return '#8B4513'; // Saddle brown for high elevation
    }
  }
}
