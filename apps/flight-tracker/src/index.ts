import { FlightTrackerService } from './service';
import { SecureKeyStore } from '@aviation/keystore';

/**
 * Flight Tracker Application Entry Point
 */
async function main() {
  console.log('Starting Flight Tracker Application...');

  // Initialize keystore
  const keystore = new SecureKeyStore();

  // Example: Set API key (in production, this would be done through a secure setup process)
  // keystore.setSecret('flight-tracker', 'flightapi_key', 'your-api-key-here');

  // Initialize service
  const service = new FlightTrackerService(
    {
      name: 'flight-tracker',
      enabled: true,
      autoStart: true,
    },
    keystore
  );

  // Start the service
  await service.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down Flight Tracker...');
    await service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down Flight Tracker...');
    await service.stop();
    process.exit(0);
  });

  console.log('Flight Tracker is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
  console.error('Failed to start Flight Tracker:', error);
  process.exit(1);
});
