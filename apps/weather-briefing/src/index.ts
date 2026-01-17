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
            .card { background: #111827; border-radius: 12px; padding: 24px; max-width: 640px; box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
            .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
            select, button { padding: 10px 12px; border-radius: 8px; border: 1px solid #1f2937; background: #0b1224; color: #f8fafc; font-size: 14px; }
            button { background: #2563eb; border-color: #2563eb; cursor: pointer; }
            button:disabled { background: #1f2937; border-color: #1f2937; cursor: not-allowed; }
            pre { background: #0b1224; border-radius: 12px; padding: 16px; white-space: pre-wrap; margin-top: 16px; }
            .muted { color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✈️ Aviation Weather Briefing</h1>
            <p class="muted">Select an airport to generate a briefing.</p>
            <form id="briefing-form" class="row">
              <label for="station">Airport:</label>
              <select id="station" name="station">
                <option value="KSFO">KSFO - San Francisco</option>
                <option value="KLAX">KLAX - Los Angeles</option>
                <option value="KSEA">KSEA - Seattle</option>
                <option value="KDEN">KDEN - Denver</option>
                <option value="KDFW">KDFW - Dallas/Fort Worth</option>
                <option value="KORD">KORD - Chicago O'Hare</option>
                <option value="KATL">KATL - Atlanta</option>
                <option value="KJFK">KJFK - New York JFK</option>
                <option value="KBOS">KBOS - Boston</option>
                <option value="KMIA">KMIA - Miami</option>
              </select>
              <button type="submit" id="submit-btn">Get Briefing</button>
            </form>
            <pre id="briefing-output">Select an airport and click “Get Briefing”.</pre>
            <p class="muted">Other endpoints: <code>/health</code> and <code>/briefing?station=KSFO</code></p>
          </div>
          <script>
            const form = document.getElementById('briefing-form');
            const output = document.getElementById('briefing-output');
            const submitBtn = document.getElementById('submit-btn');

            form.addEventListener('submit', async (event) => {
              event.preventDefault();
              const station = document.getElementById('station').value;
              output.textContent = `Loading briefing for ${station}...`;
              submitBtn.disabled = true;

              try {
                const response = await fetch(`/briefing?station=${encodeURIComponent(station)}`);
                if (!response.ok) {
                  const message = await response.text();
                  throw new Error(message || `Request failed with status ${response.status}`);
                }
                const briefing = await response.text();
                output.textContent = briefing;
              } catch (error) {
                output.textContent = `Failed to fetch briefing: ${error?.message ?? 'Unknown error'}`;
              } finally {
                submitBtn.disabled = false;
              }
            });
          </script>
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
