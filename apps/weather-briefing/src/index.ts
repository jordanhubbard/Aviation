import { WeatherBriefingService } from './service';

/**
 * Weather Briefing Application Entry Point
 */
async function main() {
  console.log('Starting Weather Briefing Application...');

  // Initialize service
  // Note: Service uses createSecretLoader internally for keystore access
  const service = new WeatherBriefingService({
    name: 'weather-briefing',
    enabled: true,
    autoStart: true,
  });

  // Start the service
  await service.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down Weather Briefing Service...');
    await service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down Weather Briefing Service...');
    await service.stop();
    process.exit(0);
  });

  console.log('Weather Briefing Service is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
  console.error('Failed to start Weather Briefing Service:', error);
  process.exit(1);
});
