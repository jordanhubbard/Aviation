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
export class FlightTrackerService extends BackgroundService {
  private secrets = createSecretLoader('flight-tracker');
  private intervalId?: NodeJS.Timeout;
  private airportCache: Map<string, AirportConditions> = new Map();
  private trackedFlights: Map<string, FlightInfo> = new Map();

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

    // Start polling for flight data
    this.intervalId = setInterval(() => {
      this.pollFlightData();
    }, 120000); // Poll every 2 minutes

    console.log('✈️  Flight Tracker Service is now monitoring flights...');
    
    // Do initial poll
    await this.pollFlightData();
  }

  protected async onStop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.airportCache.clear();
    this.trackedFlights.clear();
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
