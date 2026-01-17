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
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://localhost:${port}`);

    const sendJson = (status: number, payload: unknown) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(payload));
    };

    if (requestUrl.pathname === '/health') {
      sendJson(200, { status: 'ok' });
      return;
    }

    if (requestUrl.pathname === '/api/flights' && req.method === 'GET') {
      const bounds = ['lamin', 'lomin', 'lamax', 'lomax'].every((key) =>
        requestUrl.searchParams.has(key)
      )
        ? {
            lamin: Number(requestUrl.searchParams.get('lamin')),
            lomin: Number(requestUrl.searchParams.get('lomin')),
            lamax: Number(requestUrl.searchParams.get('lamax')),
            lomax: Number(requestUrl.searchParams.get('lomax')),
          }
        : undefined;

      const flights = service.getLiveFlights(bounds);
      sendJson(200, {
        flights,
        total: flights.length,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (requestUrl.pathname === '/api/tracked' && req.method === 'GET') {
      const tracked = service.getTrackedAircraft();
      sendJson(200, { tracked, total: tracked.length });
      return;
    }

    if (requestUrl.pathname === '/api/tracked' && req.method === 'POST') {
      const body = await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', (chunk) => {
          data += chunk;
        });
        req.on('end', () => resolve(data));
      });

      let payload: { icao24?: string } = {};
      if (body) {
        try {
          payload = JSON.parse(body) as { icao24?: string };
        } catch (error) {
          sendJson(400, { error: 'invalid JSON payload' });
          return;
        }
      }
      if (!payload.icao24) {
        sendJson(400, { error: 'icao24 is required' });
        return;
      }
      const added = service.trackAircraft(payload.icao24);
      if (!added) {
        sendJson(404, { error: 'flight not found' });
        return;
      }
      sendJson(200, { status: 'tracked' });
      return;
    }

    if (requestUrl.pathname.startsWith('/api/tracked/') && req.method === 'DELETE') {
      const icao24 = requestUrl.pathname.replace('/api/tracked/', '').trim();
      if (!icao24) {
        sendJson(400, { error: 'icao24 is required' });
        return;
      }
      service.untrackAircraft(icao24);
      sendJson(200, { status: 'removed' });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Flight Tracker</title>
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossorigin=""
          />
          <style>
            :root {
              color-scheme: dark;
            }
            body {
              margin: 0;
              font-family: "Inter", system-ui, -apple-system, sans-serif;
              background: #0b1220;
              color: #e2e8f0;
            }
            .app {
              display: flex;
              flex-direction: column;
              min-height: 100vh;
            }
            header {
              padding: 20px 28px;
              background: #111827;
              border-bottom: 1px solid #1f2937;
              display: flex;
              flex-wrap: wrap;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
            }
            header h1 {
              margin: 0;
              font-size: 1.5rem;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            header p {
              margin: 4px 0 0 0;
              color: #94a3b8;
              font-size: 0.95rem;
            }
            .status-pill {
              padding: 6px 12px;
              border-radius: 999px;
              font-size: 0.8rem;
              background: rgba(59, 130, 246, 0.15);
              color: #93c5fd;
            }
            .content {
              flex: 1;
              display: grid;
              grid-template-columns: minmax(0, 3fr) minmax(280px, 1fr);
              gap: 16px;
              padding: 16px;
            }
            .map-panel {
              position: relative;
              border-radius: 16px;
              overflow: hidden;
              border: 1px solid #1f2937;
              background: #0f172a;
              min-height: 520px;
            }
            #map {
              width: 100%;
              height: 100%;
            }
            .map-hint {
              position: absolute;
              bottom: 16px;
              left: 16px;
              padding: 8px 12px;
              border-radius: 10px;
              background: rgba(15, 23, 42, 0.8);
              font-size: 0.85rem;
              color: #e2e8f0;
            }
            .sidebar {
              display: flex;
              flex-direction: column;
              gap: 12px;
              padding: 16px;
              border-radius: 16px;
              border: 1px solid #1f2937;
              background: #0f172a;
              min-height: 520px;
            }
            .sidebar h2 {
              margin: 0;
              font-size: 1.1rem;
            }
            .sidebar .subtitle {
              color: #94a3b8;
              font-size: 0.85rem;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.85rem;
            }
            thead th {
              text-align: left;
              padding-bottom: 8px;
              color: #94a3b8;
              font-weight: 600;
            }
            tbody td {
              padding: 8px 4px;
              border-bottom: 1px solid #1f2937;
              vertical-align: top;
            }
            .flight-tag {
              display: inline-flex;
              flex-direction: column;
              gap: 2px;
            }
            .flight-tag span:last-child {
              font-size: 0.75rem;
              color: #94a3b8;
            }
            .remove-btn {
              background: transparent;
              border: 1px solid #334155;
              color: #f87171;
              padding: 4px 8px;
              border-radius: 999px;
              cursor: pointer;
            }
            .aircraft-marker {
              background: transparent;
              border: none;
            }
            .aircraft-icon {
              font-size: 16px;
              color: #38bdf8;
              text-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
              transform-origin: center;
            }
            .aircraft-icon.tracked {
              color: #f59e0b;
              text-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
            }
            .empty-state {
              color: #64748b;
              font-size: 0.9rem;
              padding: 12px 0;
            }
            @media (max-width: 900px) {
              .content {
                grid-template-columns: 1fr;
              }
              .sidebar {
                min-height: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="app">
            <header>
              <div>
                <h1>✈️ Flight Tracker</h1>
                <p>Click aircraft to add to the tracking table and visualize their live track.</p>
              </div>
              <div class="status-pill" id="status">Connecting…</div>
            </header>
            <section class="content">
              <div class="map-panel">
                <div id="map"></div>
                <div class="map-hint">Click any aircraft icon to track it.</div>
              </div>
              <aside class="sidebar">
                <div>
                  <h2>Tracked Flights</h2>
                  <div class="subtitle" id="tracked-summary">0 flights tracked</div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Flight</th>
                      <th>Altitude</th>
                      <th>Speed</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="tracked-body"></tbody>
                </table>
                <div class="empty-state" id="empty-state">No flights tracked yet.</div>
              </aside>
            </section>
          </div>
          <script
            src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            crossorigin=""
          ></script>
          <script>
            const statusEl = document.getElementById('status');
            const trackedBody = document.getElementById('tracked-body');
            const trackedSummary = document.getElementById('tracked-summary');
            const emptyState = document.getElementById('empty-state');

            const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 8,
              minZoom: 2,
              attribution: '&copy; OpenStreetMap contributors',
            }).addTo(map);

            const markers = new Map();
            const trackLines = new Map();
            let trackedFlights = [];
            let latestFlights = [];

            const colorPalette = ['#f59e0b', '#38bdf8', '#a855f7', '#34d399', '#f472b6'];
            const colorForId = (id) => {
              let hash = 0;
              for (let i = 0; i < id.length; i += 1) {
                hash = (hash * 31 + id.charCodeAt(i)) % colorPalette.length;
              }
              return colorPalette[Math.abs(hash) % colorPalette.length];
            };

            const formatAltitude = (meters) => {
              if (meters == null) return '—';
              return Math.round(meters * 3.28084).toLocaleString() + ' ft';
            };

            const formatSpeed = (metersPerSecond) => {
              if (metersPerSecond == null) return '—';
              return Math.round(metersPerSecond * 1.94384) + ' kt';
            };

            const buildIcon = (flight, isTracked) => {
              const rotation = flight.heading || 0;
              const colorClass = isTracked ? 'tracked' : '';
              return L.divIcon({
                className: 'aircraft-marker',
                html:
                  '<div class="aircraft-icon ' +
                  colorClass +
                  '" style="transform: rotate(' +
                  rotation +
                  'deg)">✈︎</div>',
                iconSize: [20, 20],
              });
            };

            const updateMarkers = (flights) => {
              const activeIds = new Set();
              flights.forEach((flight) => {
                activeIds.add(flight.icao24);
                const isTracked = trackedFlights.some((tracked) => tracked.icao24 === flight.icao24);
                const existing = markers.get(flight.icao24);
                const marker = existing || L.marker([flight.latitude, flight.longitude]);
                marker.setLatLng([flight.latitude, flight.longitude]);
                marker.setIcon(buildIcon(flight, isTracked));
                marker.bindTooltip(
                  (flight.callsign || flight.icao24) +
                    ' • ' +
                    formatAltitude(flight.geoAltitude ?? flight.baroAltitude),
                  { direction: 'top', opacity: 0.9 }
                );
                if (!existing) {
                  marker.on('click', () => trackFlight(flight.icao24));
                  marker.addTo(map);
                  markers.set(flight.icao24, marker);
                }
              });

              for (const [icao24, marker] of markers.entries()) {
                if (!activeIds.has(icao24)) {
                  map.removeLayer(marker);
                  markers.delete(icao24);
                }
              }
            };

            const updateTracks = () => {
              const activeIds = new Set();
              trackedFlights.forEach((flight) => {
                activeIds.add(flight.icao24);
                const color = colorForId(flight.icao24);
                const points = flight.history
                  .filter((point) => point.latitude != null && point.longitude != null)
                  .map((point) => [point.latitude, point.longitude]);

                if (!points.length) return;
                const existing = trackLines.get(flight.icao24);
                if (existing) {
                  existing.setLatLngs(points);
                } else {
                  const line = L.polyline(points, { color, weight: 2.5, opacity: 0.9 }).addTo(map);
                  trackLines.set(flight.icao24, line);
                }
              });

              for (const [icao24, line] of trackLines.entries()) {
                if (!activeIds.has(icao24)) {
                  map.removeLayer(line);
                  trackLines.delete(icao24);
                }
              }
            };

            const renderTrackedTable = () => {
              trackedBody.innerHTML = '';
              trackedSummary.textContent = trackedFlights.length + ' flights tracked';
              emptyState.style.display = trackedFlights.length ? 'none' : 'block';

              trackedFlights.forEach((flight) => {
                const row = document.createElement('tr');
                const flightCell = document.createElement('td');
                const tag = document.createElement('div');
                tag.className = 'flight-tag';
                const callsign = document.createElement('span');
                callsign.textContent = flight.callsign || flight.icao24.toUpperCase();
                const country = document.createElement('span');
                country.textContent = flight.originCountry || 'Unknown';
                tag.appendChild(callsign);
                tag.appendChild(country);
                flightCell.appendChild(tag);

                const altitudeCell = document.createElement('td');
                altitudeCell.textContent = formatAltitude(flight.position?.altitude ?? null);

                const speedCell = document.createElement('td');
                speedCell.textContent = formatSpeed(flight.position?.velocity ?? null);

                const actionCell = document.createElement('td');
                const button = document.createElement('button');
                button.className = 'remove-btn';
                button.textContent = 'Remove';
                button.addEventListener('click', () => removeTracked(flight.icao24));
                actionCell.appendChild(button);

                row.appendChild(flightCell);
                row.appendChild(altitudeCell);
                row.appendChild(speedCell);
                row.appendChild(actionCell);
                trackedBody.appendChild(row);
              });
            };

            const trackFlight = async (icao24) => {
              await fetch('/api/tracked', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icao24 }),
              });
              await refreshTracked();
            };

            const removeTracked = async (icao24) => {
              await fetch('/api/tracked/' + icao24, { method: 'DELETE' });
              await refreshTracked();
            };

            const refreshFlights = async () => {
              const bounds = map.getBounds();
              const params = new URLSearchParams({
                lamin: bounds.getSouth().toFixed(4),
                lomin: bounds.getWest().toFixed(4),
                lamax: bounds.getNorth().toFixed(4),
                lomax: bounds.getEast().toFixed(4),
              });
              const response = await fetch('/api/flights?' + params.toString());
              if (!response.ok) {
                statusEl.textContent = 'Flight feed unavailable';
                return;
              }
              const data = await response.json();
              latestFlights = data.flights || [];
              statusEl.textContent = 'Live flights: ' + data.total;
              updateMarkers(latestFlights);
            };

            const refreshTracked = async () => {
              const response = await fetch('/api/tracked');
              if (!response.ok) {
                return;
              }
              const data = await response.json();
              trackedFlights = data.tracked || [];
              renderTrackedTable();
              updateTracks();
              if (latestFlights.length) {
                updateMarkers(latestFlights);
              }
            };

            map.on('moveend', () => {
              refreshFlights();
            });

            refreshFlights();
            refreshTracked();
            setInterval(refreshFlights, 10000);
            setInterval(refreshTracked, 5000);
          </script>
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
