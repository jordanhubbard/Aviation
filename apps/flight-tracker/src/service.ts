import {
  BackgroundService,
  ServiceConfig,
  FlightCategory,
  fetchMetarRaw,
  parseMetar,
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
} from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';

/**
 * Flight information with weather data
 */
interface FlightInfo {
  callsign: string;
  origin: string;
  destination: string;
  altitude?: number;
  speed?: number;
  latitude?: number;
  longitude?: number;
}

interface FlightBounds {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

interface FlightState {
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

interface FlightTrackPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  timestamp: string;
}

interface TrackedAircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  onGround: boolean;
  lastContact: number | null;
  position: FlightTrackPoint | null;
  history: FlightTrackPoint[];
  isActive: boolean;
  lastUpdate: string;
}

/**
 * Airport weather conditions
 */
interface AirportConditions {
  icao: string;
  metar: string | null;
  category: FlightCategory;
  recommendation: string;
  warnings: string[];
  lastUpdated: Date;
}

/**
 * Flight Tracker Service
 * 
 * This service monitors real-time flight data and weather conditions
 * using the shared aviation SDK. It demonstrates integration of:
 * - METAR fetching and parsing
 * - Flight category determination
 * - Weather recommendations
 * - Background service patterns
 */
import { G1000Plugin } from './plugin-interface';

export class FlightTrackerService extends BackgroundService {
  private plugins: G1000Plugin[] = [];

  public registerPlugin(plugin: G1000Plugin): void {
    this.plugins.push(plugin);
    plugin.initialize({ service: this });
  }

  private async initializePlugins(): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.initialize({ service: this });
    }
  }

  private async destroyPlugins(): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.destroy();
    }
  }
  private secrets = createSecretLoader('flight-tracker');
  private intervalId?: NodeJS.Timeout;
  private liveIntervalId?: NodeJS.Timeout;
  private airportCache: Map<string, AirportConditions> = new Map();
  private trackedFlights: Map<string, FlightInfo> = new Map();
  private liveFlights: Map<string, FlightState> = new Map();
  private trackedAircraft: Map<string, TrackedAircraft> = new Map();
  private lastLiveFetch = 0;
  private isLiveFetchInProgress = false;
  private readonly maxTrackPoints = Number(process.env.FLIGHT_TRACK_MAX_POINTS ?? '60');
  private readonly livePollMs = Number(process.env.FLIGHT_LIVE_POLL_MS ?? '10000');
  private readonly liveMinFetchMs = Number(process.env.FLIGHT_LIVE_MIN_FETCH_MS ?? '9000');
  private liveThrottleUntil = 0;
  private readonly liveBaseBackoffMs = Number(process.env.FLIGHT_LIVE_BACKOFF_MS ?? '15000');
  private readonly liveMaxBackoffMs = Number(process.env.FLIGHT_LIVE_MAX_BACKOFF_MS ?? '120000');
  private liveBackoffMs = this.liveBaseBackoffMs;

  constructor(config: ServiceConfig) {
    super(config);
  }

  protected async onStart(): Promise<void> {
    // Get API keys from keystore (optional for demo)
    const flightApiKey = this.secrets.get('FLIGHT_API_KEY');
    const flightAwareKey = this.secrets.get('FLIGHTAWARE_API_KEY');
    const aviationStackKey = this.secrets.get('AVIATIONSTACK_API_KEY');
    
    if (!flightApiKey && !flightAwareKey && !aviationStackKey) {
      console.warn('⚠️  No flight API keys found. Running in demo mode.');
      console.warn('Add keys with: npm run keystore set flight-tracker FLIGHT_API_KEY "your-key"');
    }

    // Add some demo flights for demonstration
    this.addDemoFlights();

    // Start polling for weather data
    this.intervalId = setInterval(() => {
      this.pollFlightData();
    }, 120000); // Poll every 2 minutes

    this.liveIntervalId = setInterval(() => {
      void this.pollLiveFlights();
    }, this.livePollMs);

    console.log('✈️  Flight Tracker Service is now monitoring flights...');
    
    // Do initial poll
    await this.pollFlightData();
    await this.pollLiveFlights();
  }

  protected async onStop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.liveIntervalId) {
      clearInterval(this.liveIntervalId);
      this.liveIntervalId = undefined;
    }
    this.airportCache.clear();
    this.trackedFlights.clear();
    this.liveFlights.clear();
    this.trackedAircraft.clear();
    console.log('✈️  Flight Tracker Service stopped monitoring flights.');
  }

  /**
   * Add demo flights for testing weather integration
   */
  private addDemoFlights(): void {
    this.trackedFlights.set('UAL123', {
      callsign: 'UAL123',
      origin: 'KSFO',
      destination: 'KJFK',
      altitude: 35000,
      speed: 450,
    });

    this.trackedFlights.set('DAL456', {
      callsign: 'DAL456',
      origin: 'KATL',
      destination: 'KLAX',
      altitude: 38000,
      speed: 480,
    });

    console.log(`📊 Tracking ${this.trackedFlights.size} flights`);
  }

  /**
   * Poll flight data and update weather conditions
   */
  private async pollFlightData(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] 🔄 Polling flight data...`);

    // Collect unique airports from tracked flights
    const airports = new Set<string>();
    for (const flight of this.trackedFlights.values()) {
      airports.add(flight.origin);
      airports.add(flight.destination);
    }

    // Fetch weather for all airports
    await this.updateAirportWeather(Array.from(airports));

    // Log flight status with weather
    this.logFlightStatus();
  }

  private async pollLiveFlights(): Promise<void> {
    await this.refreshLiveFlights();
    this.updateTrackedAircraft();
  }

  private async refreshLiveFlights(): Promise<void> {
    const now = Date.now();
    if (this.liveThrottleUntil && now < this.liveThrottleUntil) {
      return;
    }
    if (this.isLiveFetchInProgress) {
      return;
    }
    if (now - this.lastLiveFetch < this.liveMinFetchMs) {
      return;
    }
    this.isLiveFetchInProgress = true;
    try {
      const states = await this.fetchOpenSkyStates();
      if (!states.length) {
        return;
      }
      this.liveFlights = new Map(states.map((state) => [state.icao24, state]));
      this.lastLiveFetch = now;
    } catch (error) {
      console.warn('⚠️  Unable to refresh live flights:', error);
    } finally {
      this.isLiveFetchInProgress = false;
    }
  }

  private async fetchOpenSkyStates(bounds?: FlightBounds): Promise<FlightState[]> {
    const url = new URL('https://opensky-network.org/api/states/all');
    if (bounds) {
      url.searchParams.set('lamin', bounds.lamin.toString());
      url.searchParams.set('lomin', bounds.lomin.toString());
      url.searchParams.set('lamax', bounds.lamax.toString());
      url.searchParams.set('lomax', bounds.lomax.toString());
    }

    const username = this.secrets.get('OPENSKY_USERNAME') ?? process.env.OPENSKY_USERNAME;
    const password = this.secrets.get('OPENSKY_PASSWORD') ?? process.env.OPENSKY_PASSWORD;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (username && password) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    const response = await fetch(url.toString(), { headers });
    if (response.status === 429) {
      const retryMs = this.parseRetryAfterMs(response.headers.get('retry-after')) ?? this.liveBackoffMs;
      const backoffMs = Math.min(retryMs, this.liveMaxBackoffMs);
      this.liveThrottleUntil = Date.now() + backoffMs;
      this.liveBackoffMs = Math.min(this.liveBackoffMs * 2, this.liveMaxBackoffMs);
      console.warn(`⚠️  OpenSky rate limited. Backing off for ${Math.round(backoffMs / 1000)}s.`);
      return [];
    }
    if (!response.ok) {
      throw new Error(`OpenSky error: ${response.status}`);
    }
    const payload = (await response.json()) as { states?: unknown[] };
    this.liveBackoffMs = this.liveBaseBackoffMs;
    if (!payload.states) {
      return [];
    }
    return payload.states
      .map((state) => this.mapOpenSkyState(state))
      .filter((state): state is FlightState => Boolean(state));
  }

  private parseRetryAfterMs(value: string | null): number | null {
    if (!value) {
      return null;
    }
    const seconds = Number(value);
    if (!Number.isNaN(seconds)) {
      return Math.max(seconds * 1000, 0);
    }
    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) {
      return Math.max(dateMs - Date.now(), 0);
    }
    return null;
  }

  private mapOpenSkyState(state: unknown): FlightState | null {
    if (!Array.isArray(state) || state.length < 11) {
      return null;
    }
    const longitude = typeof state[5] === 'number' ? state[5] : null;
    const latitude = typeof state[6] === 'number' ? state[6] : null;
    if (longitude === null || latitude === null) {
      return null;
    }
    const icao24 = typeof state[0] === 'string' ? state[0].trim() : '';
    const callsign = typeof state[1] === 'string' ? state[1].trim() : '';
    const originCountry = typeof state[2] === 'string' ? state[2] : 'Unknown';
    return {
      icao24,
      callsign,
      originCountry,
      longitude,
      latitude,
      baroAltitude: typeof state[7] === 'number' ? state[7] : null,
      onGround: Boolean(state[8]),
      velocity: typeof state[9] === 'number' ? state[9] : null,
      heading: typeof state[10] === 'number' ? state[10] : null,
      verticalRate: typeof state[11] === 'number' ? state[11] : null,
      lastContact: typeof state[4] === 'number' ? state[4] : null,
      geoAltitude: typeof state[13] === 'number' ? state[13] : null,
    };
  }

  private updateTrackedAircraft(): void {
    if (this.trackedAircraft.size === 0) {
      return;
    }
    const now = new Date().toISOString();
    for (const [icao24, tracked] of this.trackedAircraft.entries()) {
      const state = this.liveFlights.get(icao24);
      if (!state) {
        this.trackedAircraft.set(icao24, { ...tracked, isActive: false, lastUpdate: now });
        continue;
      }
      const point: FlightTrackPoint = {
        latitude: state.latitude,
        longitude: state.longitude,
        altitude: state.geoAltitude ?? state.baroAltitude,
        velocity: state.velocity,
        heading: state.heading,
        timestamp: now,
      };
      const history = [...tracked.history, point].slice(-this.maxTrackPoints);
      this.trackedAircraft.set(icao24, {
        ...tracked,
        callsign: state.callsign,
        originCountry: state.originCountry,
        onGround: state.onGround,
        lastContact: state.lastContact,
        position: point,
        history,
        isActive: true,
        lastUpdate: now,
      });
    }
  }

  /**
   * Update weather conditions for multiple airports
   */
  private async updateAirportWeather(icaoCodes: string[]): Promise<void> {
    console.log(`🌤️  Fetching weather for ${icaoCodes.length} airports...`);

    for (const icao of icaoCodes) {
      try {
        // Fetch METAR
        const metar = await fetchMetarRaw(icao);
        
        if (!metar) {
          console.log(`   ⚠️  No METAR available for ${icao}`);
          continue;
        }

        // Parse METAR
        const parsed = parseMetar(metar);

        // Determine flight category
        const category = flightCategory(
          parsed.visibility_sm || null,
          parsed.ceiling_ft || 10000 // Assume high ceiling if not reported
        );

        // Get recommendation and warnings
        const recommendation = recommendationForCategory(category);
        const warnings = warningsForConditions(
          parsed.visibility_sm || null,
          parsed.ceiling_ft || null,
          parsed.wind_speed_kt || null
        );

        // Cache the conditions
        this.airportCache.set(icao, {
          icao,
          metar,
          category,
          recommendation,
          warnings,
          lastUpdated: new Date(),
        });

        // Log weather update
        const categoryEmoji = this.getCategoryEmoji(category);
        console.log(`   ${categoryEmoji} ${icao}: ${category} - ${parsed.temperature_f}°F, ${parsed.wind_speed_kt}kt`);
        
        if (warnings.length > 0) {
          console.log(`      ⚠️  ${warnings.join(', ')}`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to fetch weather for ${icao}:`, error);
      }
    }
  }

  /**
   * Log status of tracked flights with weather
   */
  private logFlightStatus(): void {
    console.log('\n📡 Tracked Flights:');
    console.log('─'.repeat(80));

    for (const flight of this.trackedFlights.values()) {
      const origin = this.airportCache.get(flight.origin);
      const dest = this.airportCache.get(flight.destination);

      console.log(`\n✈️  ${flight.callsign}: ${flight.origin} → ${flight.destination}`);
      
      if (flight.altitude && flight.speed) {
        console.log(`   Altitude: ${flight.altitude}ft, Speed: ${flight.speed}kts`);
      }

      if (origin) {
        const originEmoji = this.getCategoryEmoji(origin.category);
        console.log(`   ${originEmoji} Origin (${origin.icao}): ${origin.category}`);
        console.log(`      ${origin.recommendation}`);
      }

      if (dest) {
        const destEmoji = this.getCategoryEmoji(dest.category);
        console.log(`   ${destEmoji} Destination (${dest.icao}): ${dest.category}`);
        console.log(`      ${dest.recommendation}`);
      }
    }

    console.log('─'.repeat(80));
  }

  /**
   * Get emoji for flight category
   */
  private getCategoryEmoji(category: FlightCategory): string {
    switch (category) {
      case 'VFR':
        return '🟢';
      case 'MVFR':
        return '🔵';
      case 'IFR':
        return '🔴';
      case 'LIFR':
        return '🟣';
      case 'UNKNOWN':
        return '⚪';
    }
  }

  /**
   * Get current airport conditions
   */
  public getAirportConditions(icao: string): AirportConditions | undefined {
    return this.airportCache.get(icao);
  }

  /**
   * Get all tracked flights
   */
  public getTrackedFlights(): FlightInfo[] {
    return Array.from(this.trackedFlights.values());
  }

  public getLiveFlights(bounds?: FlightBounds): FlightState[] {
    const flights = Array.from(this.liveFlights.values());
    if (!bounds) {
      return flights;
    }
    return flights.filter(
      (flight) =>
        flight.latitude >= bounds.lamin &&
        flight.latitude <= bounds.lamax &&
        flight.longitude >= bounds.lomin &&
        flight.longitude <= bounds.lomax
    );
  }

  public getTrackedAircraft(): TrackedAircraft[] {
    return Array.from(this.trackedAircraft.values());
  }

  public trackAircraft(icao24: string): boolean {
    const normalized = icao24.trim().toLowerCase();
    if (this.trackedAircraft.has(normalized)) {
      return true;
    }
    const state = this.liveFlights.get(normalized);
    if (!state) {
      return false;
    }
    const now = new Date().toISOString();
    const point: FlightTrackPoint = {
      latitude: state.latitude,
      longitude: state.longitude,
      altitude: state.geoAltitude ?? state.baroAltitude,
      velocity: state.velocity,
      heading: state.heading,
      timestamp: now,
    };
    this.trackedAircraft.set(normalized, {
      icao24: normalized,
      callsign: state.callsign,
      originCountry: state.originCountry,
      onGround: state.onGround,
      lastContact: state.lastContact,
      position: point,
      history: [point],
      isActive: true,
      lastUpdate: now,
    });
    return true;
  }

  public untrackAircraft(icao24: string): void {
    this.trackedAircraft.delete(icao24.trim().toLowerCase());
  }

  /**
   * Add a flight to track
   */
  public addFlight(flight: FlightInfo): void {
    this.trackedFlights.set(flight.callsign, flight);
    console.log(`➕ Added flight ${flight.callsign} to tracking`);
  }

  /**
   * Remove a flight from tracking
   */
  public removeFlight(callsign: string): void {
    this.trackedFlights.delete(callsign);
    console.log(`➖ Removed flight ${callsign} from tracking`);
  }
}
