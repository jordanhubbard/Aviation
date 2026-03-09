import { FlightWebSocketServer } from './websocket-server';

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

export interface PFDUpdate {
  airspeed: number;
  altitude: number;
  heading: number;
  verticalSpeed: number;
  pitch: number;
  roll: number;
}

export interface MFDUpdate {
  mapCenter: { lat: number; lon: number };
  mapZoom: number;
  waypoints: Array<{ id: string; lat: number; lon: number }>;
  traffic: FlightState[];
}

export interface NAVUpdate {
  activeWaypoint: string;
  distanceToWaypoint: number;
  bearingToWaypoint: number;
  estimatedTimeEnroute: number;
  crossTrackError: number;
}

export interface SystemStatus {
  gpsStatus: 'active' | 'degraded' | 'inactive';
  comStatus: 'active' | 'degraded' | 'inactive';
  navStatus: 'active' | 'degraded' | 'inactive';
  fuelRemaining: number;
  engineStatus: 'normal' | 'warning' | 'critical';
}

export class DataPublisher {
  private wsServer: FlightWebSocketServer;
  private flightStateInterval: NodeJS.Timeout | null = null;
  private pfdInterval: NodeJS.Timeout | null = null;
  private mfdInterval: NodeJS.Timeout | null = null;
  private navInterval: NodeJS.Timeout | null = null;
  private systemStatusInterval: NodeJS.Timeout | null = null;

  constructor(wsServer: FlightWebSocketServer) {
    this.wsServer = wsServer;
  }

  public startPublishing() {
    // FLIGHT_STATE at 20Hz (50ms interval)
    this.flightStateInterval = setInterval(() => {
      this.publishFlightState();
    }, 50);

    // PFD_UPDATE at 20Hz (50ms interval)
    this.pfdInterval = setInterval(() => {
      this.publishPFDUpdate();
    }, 50);

    // MFD_UPDATE at 5Hz (200ms interval)
    this.mfdInterval = setInterval(() => {
      this.publishMFDUpdate();
    }, 200);

    // NAV_UPDATE at 2Hz (500ms interval)
    this.navInterval = setInterval(() => {
      this.publishNAVUpdate();
    }, 500);

    // SYSTEM_STATUS at 1Hz (1000ms interval)
    this.systemStatusInterval = setInterval(() => {
      this.publishSystemStatus();
    }, 1000);
  }

  public stopPublishing() {
    if (this.flightStateInterval) clearInterval(this.flightStateInterval);
    if (this.pfdInterval) clearInterval(this.pfdInterval);
    if (this.mfdInterval) clearInterval(this.mfdInterval);
    if (this.navInterval) clearInterval(this.navInterval);
    if (this.systemStatusInterval) clearInterval(this.systemStatusInterval);
  }

  private publishFlightState() {
    const flightState: FlightState = {
      icao24: 'ABC123',
      callsign: 'UAL123',
      originCountry: 'United States',
      longitude: -122.4194,
      latitude: 37.7749,
      baroAltitude: 35000,
      velocity: 450,
      heading: 90,
      onGround: false,
      lastContact: Date.now(),
      geoAltitude: 35000,
      verticalRate: 0,
    };
    this.wsServer.broadcast({ type: 'FLIGHT_STATE', payload: flightState });
  }

  private publishPFDUpdate() {
    const pfdUpdate: PFDUpdate = {
      airspeed: 250,
      altitude: 35000,
      heading: 90,
      verticalSpeed: 0,
      pitch: 2,
      roll: 0,
    };
    this.wsServer.broadcast({ type: 'PFD_UPDATE', payload: pfdUpdate });
  }

  private publishMFDUpdate() {
    const mfdUpdate: MFDUpdate = {
      mapCenter: { lat: 37.7749, lon: -122.4194 },
      mapZoom: 10,
      waypoints: [],
      traffic: [],
    };
    this.wsServer.broadcast({ type: 'MFD_UPDATE', payload: mfdUpdate });
  }

  private publishNAVUpdate() {
    const navUpdate: NAVUpdate = {
      activeWaypoint: 'KSFO',
      distanceToWaypoint: 100,
      bearingToWaypoint: 270,
      estimatedTimeEnroute: 3600,
      crossTrackError: 0,
    };
    this.wsServer.broadcast({ type: 'NAV_UPDATE', payload: navUpdate });
  }

  private publishSystemStatus() {
    const systemStatus: SystemStatus = {
      gpsStatus: 'active',
      comStatus: 'active',
      navStatus: 'active',
      fuelRemaining: 5000,
      engineStatus: 'normal',
    };
    this.wsServer.broadcast({ type: 'SYSTEM_STATUS', payload: systemStatus });
  }
}
