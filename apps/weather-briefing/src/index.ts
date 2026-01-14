import { WeatherBriefingService } from './service';

/**
 * Weather Briefing Application Entry Point
 * 
 * Provides aviation weather briefings using the shared SDK.
 */
async function main() {
  console.log('Starting Aviation Weather Briefing Service...');
  console.log('Using @aviation/shared-sdk for weather data\n');

  // Initialize service with shared SDK
  const service = new WeatherBriefingService({
    name: 'weather-briefing',
    enabled: true,
    autoStart: true,
  });

  // Start the service
  await service.start();

  // Demo: Generate a briefing for San Francisco
  console.log('\n' + '='.repeat(60));
  console.log('DEMO: Generating briefing for San Francisco (KSFO)...');
  console.log('='.repeat(60) + '\n');

  const briefing = await service.generateBriefing('KSFO');
  console.log(briefing);

  console.log('\n' + '='.repeat(60));
  console.log('Service will continue monitoring. Try other locations:');
  console.log('  await service.generateBriefing("KJFK")');
  console.log('  await service.generateBriefing("KLAX")');
  console.log('='.repeat(60) + '\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down Weather Briefing Service...');
    await service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nShutting down Weather Briefing Service...');
    await service.stop();
    process.exit(0);
  });

  console.log('Weather Briefing Service is running. Press Ctrl+C to stop.\n');
}

main().catch((error) => {
  console.error('Failed to start Weather Briefing Service:', error);
  process.exit(1);
});
