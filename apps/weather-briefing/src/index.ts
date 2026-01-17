import http from 'http';
import { WeatherBriefingService } from './service';
import { defaultRegionId, getRegion, regions } from './regions';

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
  const allowedForecastDays = new Set([1, 3, 5, 7]);
  const parseForecastDays = (value: string | null): number => {
    if (!value) {
      return 0;
    }

    const parsed = value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((day) => allowedForecastDays.has(day));

    if (parsed.length === 0) {
      return 0;
    }

    return Math.min(7, Math.max(...parsed));
  };
  const regionOptionsHtml = regions
    .map((region) => {
      const selected = region.id === defaultRegionId ? ' selected' : '';
      return `<option value="${region.id}"${selected}>${region.label}</option>`;
    })
    .join('');
  const regionConfigJson = JSON.stringify(regions);
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://localhost:${port}`);

    if (requestUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (requestUrl.pathname === '/briefing') {
      const station = requestUrl.searchParams.get('station') ?? 'KSFO';
      const forecastDays = parseForecastDays(requestUrl.searchParams.get('days'));
      try {
        const briefing = await service.generateBriefing(station, forecastDays);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(briefing);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Failed to generate briefing: ${message}`);
      }
      return;
    }

    if (requestUrl.pathname === '/stations') {
      const regionId = requestUrl.searchParams.get('region') ?? defaultRegionId;
      const region = getRegion(regionId);
      try {
        const stations = await service.getStationSummaries(region.stations);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ region: region.id, stations }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'stations_failed', message }));
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
        <head>
          <title>Aviation Weather Briefing</title>
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossorigin=""
          />
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; background: #0f172a; color: #f8fafc; }
            h1, h2 { margin-bottom: 8px; }
            code { background: #1e293b; padding: 4px 8px; border-radius: 6px; }
            a { color: #60a5fa; }
            .layout { display: flex; flex-direction: column; gap: 24px; max-width: 1200px; margin: 0 auto; }
            .card { background: #111827; border-radius: 12px; padding: 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
            .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
            select, input[type="text"], button { padding: 10px 12px; border-radius: 8px; border: 1px solid #1f2937; background: #0b1224; color: #f8fafc; font-size: 14px; }
            button { background: #2563eb; border-color: #2563eb; cursor: pointer; }
            button:disabled { background: #1f2937; border-color: #1f2937; cursor: not-allowed; }
            pre { background: #0b1224; border-radius: 12px; padding: 16px; white-space: pre-wrap; margin-top: 16px; }
            .muted { color: #94a3b8; }
            .forecast { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 12px; }
            .forecast label { display: flex; align-items: center; gap: 6px; font-size: 14px; }
            .map-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
            #map { height: 420px; border-radius: 12px; margin-top: 16px; border: 1px solid #1f2937; }
            .station-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; }
            .station-card { background: #0b1224; border-radius: 12px; padding: 12px; border: 1px solid #1f2937; }
            .station-card h3 { margin: 0 0 6px 0; font-size: 16px; }
            .station-card p { margin: 4px 0; font-size: 13px; color: #cbd5f5; }
            .station-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #0f172a; }
            .station-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
            .station-updated { font-size: 11px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="layout">
            <div class="card">
              <h1>✈️ Aviation Weather Briefing</h1>
              <p class="muted">Select an airport or enter a custom code, then choose a forecast range.</p>
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
                <input id="station-input" name="station-input" type="text" placeholder="Enter ICAO/IATA (e.g., KPAO)" />
                <button type="submit" id="submit-btn">Get Briefing</button>
              </form>
              <div class="forecast">
                <span class="muted">Forecast days:</span>
                <label><input type="radio" name="forecast-day" value="1" />1 day</label>
                <label><input type="radio" name="forecast-day" value="3" />3 days</label>
                <label><input type="radio" name="forecast-day" value="5" />5 days</label>
                <label><input type="radio" name="forecast-day" value="7" />7 days</label>
              </div>
              <pre id="briefing-output">Select an airport or enter a code, then click “Get Briefing”.</pre>
              <p class="muted">Other endpoints: <code>/health</code>, <code>/briefing?station=KSFO</code>, and <code>/stations?region=us</code></p>
            </div>
            <div class="card">
              <div class="map-header">
                <div>
                  <h2>Global Weather Map</h2>
                  <p class="muted">Zoom and pan to explore current conditions by region.</p>
                </div>
                <div class="row">
                  <label for="region">Region:</label>
                  <select id="region" name="region">
                    ${regionOptionsHtml}
                  </select>
                  <button type="button" id="refresh-map">Refresh</button>
                </div>
              </div>
              <div id="map"></div>
              <div id="station-list" class="station-list"></div>
            </div>
          </div>
          <script
            src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            crossorigin=""
          ></script>
          <script>
            const form = document.getElementById('briefing-form');
            const output = document.getElementById('briefing-output');
            const submitBtn = document.getElementById('submit-btn');
            const stationSelect = document.getElementById('station');
            const stationInput = document.getElementById('station-input');
            const regionSelect = document.getElementById('region');
            const refreshMapBtn = document.getElementById('refresh-map');
            const stationList = document.getElementById('station-list');
            const REGION_CONFIGS = ${regionConfigJson};
            const DEFAULT_REGION_ID = '${defaultRegionId}';
            const CATEGORY_COLORS = {
              VFR: '#22c55e',
              MVFR: '#38bdf8',
              IFR: '#f97316',
              LIFR: '#a855f7',
              UNKNOWN: '#94a3b8',
            };

            const getSelectedDay = () => {
              const selection = document.querySelector('input[name="forecast-day"]:checked');
              if (!selection) return null;
              const value = Number(selection.value);
              return Number.isNaN(value) ? null : value;
            };

            const getStation = () => {
              const manualStation = stationInput.value.trim().toUpperCase();
              return manualStation || stationSelect.value;
            };

            let hasBriefing = false;

            const requestBriefing = async () => {
              const station = getStation();
              const selectedDay = getSelectedDay();
              const params = new URLSearchParams();
              params.set('station', station);
              if (selectedDay) {
                params.set('days', String(selectedDay));
              }
              output.textContent = 'Loading briefing for ' + station + '...';
              submitBtn.disabled = true;

              try {
                const response = await fetch('/briefing?' + params.toString());
                if (!response.ok) {
                  const message = await response.text();
                  throw new Error(message || ('Request failed with status ' + response.status));
                }
                const briefing = await response.text();
                output.textContent = briefing;
                hasBriefing = true;
              } catch (error) {
                output.textContent = 'Failed to fetch briefing: ' + (error?.message ?? 'Unknown error');
              } finally {
                submitBtn.disabled = false;
              }
            };

            const formatValue = (value, suffix) => {
              if (value === null || value === undefined || Number.isNaN(value)) {
                return 'N/A';
              }
              return suffix ? value + suffix : value;
            };

            const formatWind = (station) => {
              if (station.wind_speed_kt === null || station.wind_speed_kt === undefined) {
                return 'N/A';
              }
              const direction = station.wind_direction !== null && station.wind_direction !== undefined
                ? station.wind_direction + '°'
                : 'VRB';
              return direction + ' at ' + station.wind_speed_kt + ' kt';
            };

            const map = L.map('map', {
              worldCopyJump: true,
              zoomControl: true,
            }).setView([20, 0], 2);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 8,
              attribution: '&copy; OpenStreetMap contributors',
            }).addTo(map);

            const markersLayer = L.layerGroup().addTo(map);

            const renderStationList = (stations) => {
              if (!stations.length) {
                stationList.innerHTML = '<p class="muted">No stations available for this region.</p>';
                return;
              }

              stationList.innerHTML = stations
                .map((station) => {
                  const color = CATEGORY_COLORS[station.category] || CATEGORY_COLORS.UNKNOWN;
                  const badgeStyle = 'background:' + color + ';';
                  return `
                    <div class="station-card">
                      <div class="station-meta">
                        <h3>${station.code}</h3>
                        <span class="station-badge" style="${badgeStyle}">${station.category}</span>
                      </div>
                      <p>${station.name}</p>
                      <p>Wind: ${formatWind(station)}</p>
                      <p>Visibility: ${formatValue(station.visibility_sm, ' SM')}</p>
                      <p>Ceiling: ${formatValue(station.ceiling_ft, ' ft')}</p>
                      <p>Temp: ${formatValue(station.temperature_f, '°F')}</p>
                      <div class="station-updated">Updated ${station.updatedAt.split('T')[1].slice(0, 5)}Z</div>
                    </div>
                  `;
                })
                .join('');
            };

            const renderMarkers = (stations) => {
              markersLayer.clearLayers();
              stations.forEach((station) => {
                const color = CATEGORY_COLORS[station.category] || CATEGORY_COLORS.UNKNOWN;
                const marker = L.circleMarker([station.latitude, station.longitude], {
                  radius: 7,
                  color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: 2,
                });

                const popupContent = `
                  <div>
                    <strong>${station.code}</strong> - ${station.name}<br />
                    Category: ${station.category}<br />
                    Wind: ${formatWind(station)}<br />
                    Visibility: ${formatValue(station.visibility_sm, ' SM')}<br />
                    Ceiling: ${formatValue(station.ceiling_ft, ' ft')}
                  </div>
                `;

                marker.bindPopup(popupContent);
                marker.on('click', () => {
                  stationInput.value = station.code;
                  void requestBriefing();
                });
                marker.addTo(markersLayer);
              });
            };

            const loadRegion = async (regionId) => {
              const region = REGION_CONFIGS.find((entry) => entry.id === regionId) || REGION_CONFIGS[0];
              regionSelect.value = region.id;
              stationList.innerHTML = '<p class="muted">Loading region weather...</p>';
              try {
                const response = await fetch('/stations?region=' + region.id);
                if (!response.ok) {
                  throw new Error('Request failed with status ' + response.status);
                }
                const payload = await response.json();
                const stations = payload.stations || [];
                renderMarkers(stations);
                renderStationList(stations);
                if (region.bounds) {
                  map.fitBounds(region.bounds, { padding: [24, 24] });
                }
              } catch (error) {
                stationList.innerHTML = '<p class="muted">Failed to load region data.</p>';
              }
            };

            form.addEventListener('submit', async (event) => {
              event.preventDefault();
              await requestBriefing();
            });

            Array.from(document.querySelectorAll('input[name="forecast-day"]')).forEach((input) => {
              input.addEventListener('change', () => {
                if (!hasBriefing) return;
                void requestBriefing();
              });
            });

            regionSelect.addEventListener('change', () => {
              void loadRegion(regionSelect.value);
            });

            refreshMapBtn.addEventListener('click', () => {
              void loadRegion(regionSelect.value);
            });

            void loadRegion(DEFAULT_REGION_ID);
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
