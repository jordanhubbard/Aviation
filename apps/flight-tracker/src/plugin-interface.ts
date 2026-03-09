export interface PluginContext {
  service: any;
}

export interface G1000Plugin {
  id: string;
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  destroy(): Promise<void>;
  onFlightStateUpdate?(state: FlightState): void;
  onDisplayRender?(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;
  onMenuRegister?(menuManager: MenuManager): void;
}

export interface FlightState {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  velocity: number | null;
  heading: number | null;
  onGround: boolean;
  lastContact: number | null;
  geoAltitude: number | null;
  verticalRate: number | null;
}

export interface MenuManager {
  registerMenuItem(id: string, label: string, action: () => void): void;
}
