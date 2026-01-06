import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';

/**
 * Flight Tracker Service
 * 
 * This service monitors real-time flight data using external APIs.
 * It runs as a background service and uses the secure keystore to
 * access API keys for flight data providers.
 */
export class FlightTrackerService extends BackgroundService {
  private secrets = createSecretLoader('flight-tracker');
  private intervalId?: NodeJS.Timeout;

  constructor(config: ServiceConfig) {
    super(config);
  }

  protected async onStart(): Promise<void> {
    // Get API keys from keystore
    const flightApiKey = this.secrets.get('FLIGHT_API_KEY');
    const flightAwareKey = this.secrets.get('FLIGHTAWARE_API_KEY');
    const aviationStackKey = this.secrets.get('AVIATIONSTACK_API_KEY');
    
    if (!flightApiKey && !flightAwareKey && !aviationStackKey) {
      console.warn('No flight API keys found. Some features may be limited.');
      console.warn('Add keys with: npm run keystore set flight-tracker FLIGHT_API_KEY "your-key"');
    }

    // Start polling for flight data
    this.intervalId = setInterval(() => {
      this.pollFlightData();
    }, 60000); // Poll every minute

    console.log('Flight Tracker Service is now monitoring flights...');
  }

  protected async onStop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('Flight Tracker Service stopped monitoring flights.');
  }

  private async pollFlightData(): Promise<void> {
    // This is where you would make API calls to flight data providers
    // Example: fetch('https://flightapi.com/v1/flights', { headers: { 'X-API-Key': apiKey } })
    console.log(`[${new Date().toISOString()}] Polling flight data...`);
  }
}
