import http from 'http';
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

  const port = Number(process.env.PORT ?? '3001');
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://localhost:${port}`);

    if (requestUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head>
          <title>Flight Tracker</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #0b1f3a; color: #f8fafc; }
            h1 { margin-bottom: 8px; }
            code { background: #1e293b; padding: 4px 8px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <h1>✈️ Flight Tracker</h1>
          <p>Service is running. Try:</p>
          <ul>
            <li><code>/health</code></li>
          </ul>
        </body>
      </html>
    `);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`HTTP server listening on port ${port}`);
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down Flight Tracker...');
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

  console.log('Flight Tracker is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
  console.error('Failed to start Flight Tracker:', error);
  process.exit(1);
});
