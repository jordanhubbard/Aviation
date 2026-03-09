import { G1000Plugin, PluginContext, FlightState, MenuManager } from './plugin-interface';

class TrafficDisplayPlugin implements G1000Plugin {
  id = 'traffic-display';
  name = 'Traffic Display Plugin';
  version = '1.0.0';

  async initialize(context: PluginContext): Promise<void> {
    console.log(`${this.name} initialized with service:`, context.service);
  }

  async destroy(): Promise<void> {
    console.log(`${this.name} destroyed`);
  }

  onFlightStateUpdate?(state: FlightState): void {
    console.log('Flight state updated:', state);
  }

  onDisplayRender?(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'red';
    ctx.fillText('Traffic Display', 10, 10);
  }

  onMenuRegister?(menuManager: MenuManager): void {
    menuManager.registerMenuItem('traffic-display', 'Traffic Display', () => {
      console.log('Traffic Display menu item selected');
    });
  }
}

export default TrafficDisplayPlugin;
