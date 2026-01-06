import { FlightTrackerService } from './service';

/**
 * Flight Tracker Application Entry Point
 */
async function main() {
  console.log('Starting Flight Tracker Application...');

  // Initialize service
  // Note: Service uses createSecretLoader internally for keystore access
  const service = new FlightTrackerService({
    name: 'flight-tracker',
    enabled: true,
    autoStart: true,
  });

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
