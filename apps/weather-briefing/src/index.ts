import http from 'http';
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

  const port = Number(process.env.PORT ?? '3003');
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://localhost:${port}`);

    if (requestUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (requestUrl.pathname === '/briefing') {
      const station = requestUrl.searchParams.get('station') ?? 'KSFO';
      try {
        const briefing = await service.generateBriefing(station);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(briefing);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Failed to generate briefing: ${message}`);
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head>
          <title>Aviation Weather Briefing</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #0f172a; color: #f8fafc; }
            h1 { margin-bottom: 8px; }
            code { background: #1e293b; padding: 4px 8px; border-radius: 6px; }
            a { color: #60a5fa; }
          </style>
        </head>
        <body>
          <h1>✈️ Aviation Weather Briefing</h1>
          <p>Service is running. Try:</p>
          <ul>
            <li><code>/health</code></li>
            <li><code>/briefing?station=KSFO</code></li>
            <li><code>/briefing?station=KJFK</code></li>
          </ul>
        </body>
      </html>
    `);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`HTTP server listening on port ${port}`);
  });

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
  const shutdown = async () => {
    console.log('\n\nShutting down Weather Briefing Service...');
    await service.stop();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });

  console.log('Weather Briefing Service is running. Press Ctrl+C to stop.\n');
}

main().catch((error) => {
  console.error('Failed to start Weather Briefing Service:', error);
  process.exit(1);
});
