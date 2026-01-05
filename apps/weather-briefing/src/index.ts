import { WeatherBriefingService } from './service';
import { SecureKeyStore } from '@aviation/keystore';

/**
 * Weather Briefing Application Entry Point
 */
async function main() {
  console.log('Starting Weather Briefing Application...');

  // Initialize keystore
  const keystore = new SecureKeyStore();

  // Example: Set API keys (in production, this would be done through a secure setup process)
  // keystore.setSecret('weather-briefing', 'weather_api_key', 'your-weather-api-key');
  // keystore.setSecret('weather-briefing', 'ai_api_key', 'your-ai-api-key');

  // Initialize service
  const service = new WeatherBriefingService(
    {
      name: 'weather-briefing',
      enabled: true,
      autoStart: true,
    },
    keystore
  );

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
