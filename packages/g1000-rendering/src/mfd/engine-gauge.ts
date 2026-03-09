/**
 * Engine Gauge module
 * Implements the MFD engine gauges display
 */

export interface EngineGaugeConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  engineNumber: number;
}

export interface EngineData {
  rpm: number;
  manifoldPressure: number;
  fuelFlow: number;
  chtTemperature: number;
  oilTemperature: number;
  oilPressure: number;
}

export class EngineGaugeRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: EngineGaugeConfig;
  private engineData: EngineData;

  constructor(ctx: CanvasRenderingContext2D, config: EngineGaugeConfig) {
    this.ctx = ctx;
    this.config = config;
    this.engineData = {
      rpm: 1200,
      manifoldPressure: 28,
      fuelFlow: 10,
      chtTemperature: 350,
      oilTemperature: 180,
      oilPressure: 60,
    };
  }

  setEngineData(data: Partial<EngineData>): void {
    this.engineData = { ...this.engineData, ...data };
  }

  render(): void {
    this.drawBackground();
    this.drawEngineLabel();
    this.drawGauges();
  }

  private drawBackground(): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(this.config.x, this.config.y, this.config.width, this.config.height);

    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.config.x, this.config.y, this.config.width, this.config.height);
  }

  private drawEngineLabel(): void {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Engine ${this.config.engineNumber}`, this.config.x + this.config.width / 2, this.config.y + 20);
  }

  private drawGauges(): void {
    const gaugeWidth = this.config.width / 2 - 10;
    const gaugeHeight = (this.config.height - 40) / 3;

    // RPM gauge
    this.drawGauge(
      this.config.x + 5,
      this.config.y + 30,
      gaugeWidth,
      gaugeHeight,
      'RPM',
      this.engineData.rpm,
      0,
      3000
    );

    // Manifold Pressure gauge
    this.drawGauge(
      this.config.x + gaugeWidth + 15,
      this.config.y + 30,
      gaugeWidth,
      gaugeHeight,
      'MP',
      this.engineData.manifoldPressure,
      0,
      35
    );

    // Fuel Flow gauge
    this.drawGauge(
      this.config.x + 5,
      this.config.y + 30 + gaugeHeight + 5,
      gaugeWidth,
      gaugeHeight,
      'FF',
      this.engineData.fuelFlow,
      0,
      25
    );

    // CHT Temperature gauge
    this.drawGauge(
      this.config.x + gaugeWidth + 15,
      this.config.y + 30 + gaugeHeight + 5,
      gaugeWidth,
      gaugeHeight,
      'CHT',
      this.engineData.chtTemperature,
      200,
      500
    );

    // Oil Temperature gauge
    this.drawGauge(
      this.config.x + 5,
      this.config.y + 30 + (gaugeHeight + 5) * 2,
      gaugeWidth,
      gaugeHeight,
      'OIL T',
      this.engineData.oilTemperature,
      100,
      250
    );

    // Oil Pressure gauge
    this.drawGauge(
      this.config.x + gaugeWidth + 15,
      this.config.y + 30 + (gaugeHeight + 5) * 2,
      gaugeWidth,
      gaugeHeight,
      'OIL P',
      this.engineData.oilPressure,
      0,
      100
    );
  }

  private drawGauge(x: number, y: number, width: number, height: number, label: string, value: number, min: number, max: number): void {
    // Draw gauge background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);

    // Draw label
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(label, x + 5, y + 12);

    // Draw value
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(value.toFixed(1), x + width - 5, y + 12);

    // Draw bar
    const barHeight = height - 20;
    const barWidth = width - 10;
    const percentage = (value - min) / (max - min);
    const filledWidth = barWidth * Math.max(0, Math.min(1, percentage));

    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(x + 5, y + 15, barWidth, barHeight);

    // Color based on value
    let barColor = '#00FF00';
    if (percentage > 0.9) {
      barColor = '#FF0000';
    } else if (percentage > 0.75) {
      barColor = '#FFFF00';
    }

    this.ctx.fillStyle = barColor;
    this.ctx.fillRect(x + 5, y + 15, filledWidth, barHeight);
  }
}
