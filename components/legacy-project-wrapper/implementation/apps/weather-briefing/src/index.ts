import http from "http";
import { createExplanationRuntime } from '@aviation/ai-explainer';
import {
  GitHubIssueCreator,
  createHealthReport,
  installNodeProcessErrorReporting,
} from "@aviation/shared-sdk";
import { WeatherBriefingService } from "./service";
import { handleWeatherApi } from "./api";
import { defaultRegionId, getRegion, regions } from "./regions";

const githubIssueCreator = new GitHubIssueCreator({
  requireDebug: true,
  debug: process.env.NODE_ENV !== "production",
});

/**
 * Weather Briefing Application Entry Point
 *
 * Provides aviation weather briefings using the shared SDK.
 */
async function main() {
  console.log("Starting Aviation Weather Briefing Service...");
  console.log("Using @aviation/shared-sdk for weather data\n");

  installNodeProcessErrorReporting({
    service: "weather-briefing",
    issueCreator: githubIssueCreator,
  });

  // Initialize service with shared SDK
  const service = new WeatherBriefingService({
    name: "weather-briefing",
    enabled: true,
    autoStart: true,
  });

  // Start the service
  await service.start();

  const port = Number(process.env.PORT ?? "3003");
  const regionOptionsHtml = regions
    .map((region) => {
      const selected = region.id === defaultRegionId ? " selected" : "";
      return `<option value="${region.id}"${selected}>${region.label}</option>`;
    })
    .join("");
  const regionConfigJson = JSON.stringify(regions);
  const explanation = createExplanationRuntime('weather-briefing');
  const server = http.createServer(async (req, res) => {
    if (explanation.handle(req, res)) return;
    const requestUrl = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (requestUrl.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(createHealthReport()));
      return;
    }

    if (await handleWeatherApi(req, res, service)) return;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Aviation Weather Briefing</title>
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossorigin=""
          />
          <style>
            body { overflow-wrap: anywhere; font-family: Arial, sans-serif; margin: 32px; background: #0f172a; color: #f8fafc; }
            h1, h2 { margin-bottom: 8px; }
            code { background: #1e293b; padding: 4px 8px; border-radius: 6px; }
            a { color: #60a5fa; }
            .layout { display: flex; flex-direction: column; gap: 24px; max-width: 1200px; margin: 0 auto; }
            .card { background: #111827; border-radius: 12px; padding: 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
            .airport-selector-card { position: sticky; top: 16px; z-index: 10; }
            .weather-map-card { min-height: 520px; }
            .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
            select, input[type="text"], button { padding: 10px 12px; border-radius: 8px; border: 1px solid #1f2937; background: #0b1224; color: #f8fafc; font-size: 14px; }
            button { background: #2563eb; border-color: #2563eb; cursor: pointer; }
            button:disabled { background: #1f2937; border-color: #1f2937; cursor: not-allowed; }
            pre { overflow-wrap: anywhere; min-width: 0; background: #0b1224; border-radius: 12px; padding: 16px; white-space: pre-wrap; margin-top: 16px; }
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
            @media (max-width: 768px) {
              .airport-selector-card { position: static; }
              .weather-map-card { min-height: 360px; }
              #map { height: 320px; }
            }
          </style>
        </head>
        <body>
          <div class="layout">
            <section class="card airport-selector-card">
              <h1>✈️ Aviation Weather Briefing</h1>
              <p class="muted">Select an airport or enter a custom code, to review METAR observations and TAF forecasts.</p>
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
              <p class="muted">TAF forecasts cover only their published UTC validity period; they are distinct from METAR observations.</p>
              <p class="muted">Other endpoints: <code>/health</code>, <code>/briefing?station=KSFO</code>, and <code>/stations?region=us</code></p>
            </section>
            <section class="card weather-map-card">
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
            </section>
            <section class="card">
              <h2>Aviation Weather Briefing</h2>
              <p class="muted">Detailed METAR information and flight conditions appear here after selecting an airport.</p>
              <pre id="briefing-output">Select an airport or enter a code, then click "Get Briefing" to see detailed weather information.</pre>
            </section>
            <aviation-data-panel airports="KSFO">Loading aviation data review…</aviation-data-panel>
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
            const CUSTOM_STATIONS_KEY = 'weather-briefing.customStations';

            const normalizeStation = (value) => value.trim().toUpperCase();
            const isValidStationCode = (value) => /^[A-Z0-9]{3,4}$/.test(value);

            const builtInStations = new Set(Array.from(stationSelect.options).map((option) => option.value));
            const customStations = new Set();

            const saveCustomStations = () => {
              try {
                localStorage.setItem(CUSTOM_STATIONS_KEY, JSON.stringify(Array.from(customStations)));
              } catch (error) {
                // Ignore storage errors.
              }
            };

            const addCustomStation = (code) => {
              if (builtInStations.has(code)) {
                return;
              }
              if (!customStations.has(code)) {
                customStations.add(code);
                saveCustomStations();
              }
            };

            const ensureStationOption = (code) => {
              const existing = Array.from(stationSelect.options).find((option) => option.value === code);
              if (existing) {
                return existing;
              }
              const option = document.createElement('option');
              option.value = code;
              option.textContent = code + ' - Custom';
              stationSelect.appendChild(option);
              return option;
            };

            const loadCustomStations = () => {
              try {
                const stored = JSON.parse(localStorage.getItem(CUSTOM_STATIONS_KEY) ?? '[]');
                if (!Array.isArray(stored)) {
                  return;
                }
                stored.forEach((code) => {
                  const normalized = normalizeStation(String(code));
                  if (!isValidStationCode(normalized)) {
                    return;
                  }
                  customStations.add(normalized);
                  ensureStationOption(normalized);
                });
              } catch (error) {
                // Ignore storage errors.
              }
            };

            const getStation = () => stationSelect.value;

            const applyStationSelection = (code) => {
              const normalized = normalizeStation(code);
              if (!isValidStationCode(normalized)) {
                return null;
              }
              ensureStationOption(normalized);
              clearBriefing();
              stationSelect.value = normalized;
              stationInput.value = normalized;
              document.querySelector('aviation-data-panel').setAttribute('airports', normalized);
              addCustomStation(normalized);
              void updateMapForStation(normalized);
              return normalized;
            };

            loadCustomStations();
            stationInput.value = stationSelect.value;

            let hasBriefing = false;
            let briefingStation = null;
            let briefingRequest;
            let regionRequest;
            let selectionRequest = 0;
            const clearBriefing = () => {
              briefingRequest?.abort(); hasBriefing = false; briefingStation = null;
              output.textContent = 'Selection changed. Get a briefing for this airport.';
              submitBtn.disabled = false;
            };

            const requestBriefing = async () => {
              const station = getStation();
              const params = new URLSearchParams();
              params.set('station', station);
              briefingRequest?.abort();
              const controller = briefingRequest = new AbortController();
              output.textContent = 'Loading briefing for ' + station + '...';
              submitBtn.disabled = true;

              try {
                const response = await fetch('/briefing?' + params.toString(), { signal: controller.signal });
                if (!response.ok) {
                  const message = await response.text();
                  throw new Error(message || ('Request failed with status ' + response.status));
                }
                const briefing = await response.text();
                if (controller.signal.aborted || station !== getStation()) return;
                output.textContent = briefing;
                briefingStation = station;
                hasBriefing = true;
              } catch (error) {
                if (controller.signal.aborted) return;
                output.textContent = 'Failed to fetch briefing: ' + (error?.message ?? 'Unknown error');
              } finally {
                if (!controller.signal.aborted) submitBtn.disabled = false;
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
            const highlightLayer = L.layerGroup().addTo(map);
            let currentStations = [];

            const highlightStation = (station) => {
              highlightLayer.clearLayers();
              if (!station || !located(station)) {
                return;
              }
              const marker = L.circleMarker([station.latitude, station.longitude], {
                radius: 9,
                color: '#facc15',
                fillColor: '#facc15',
                fillOpacity: 0.9,
                weight: 2,
              });
              marker.addTo(highlightLayer);
            };

            const focusOnStation = (code, stations = currentStations) => {
              const station = stations.find((entry) => entry.code === code);
              if (!station || !located(station)) {
                return false;
              }
              highlightStation(station);
              map.setView([station.latitude, station.longitude], 6);
              return true;
            };

            const fetchStationSnapshot = async (code) => {
              try {
                const response = await fetch('/station?code=' + encodeURIComponent(code));
                if (!response.ok) {
                  return null;
                }
                const payload = await response.json();
                return payload.station ?? null;
              } catch (error) {
                return null;
              }
            };

            const updateMapForStation = async (code) => {
              const token = ++selectionRequest;
              const normalized = normalizeStation(code);
              if (!isValidStationCode(normalized)) {
                return;
              }
              if (focusOnStation(normalized)) {
                return;
              }
              const regionWithStation = REGION_CONFIGS.find((entry) => entry.stations.includes(normalized));
              if (regionWithStation && regionWithStation.id !== regionSelect.value) {
                await loadRegion(regionWithStation.id, normalized);
                return;
              }
              const snapshot = await fetchStationSnapshot(normalized);
              if (snapshot && located(snapshot) && token === selectionRequest) {
                highlightStation(snapshot);
                map.setView([snapshot.latitude, snapshot.longitude], 6);
              }
            };

            const utc = value => {
              if (value === null || value === undefined || value === '') return 'Unknown';
              const date = new Date(typeof value === 'number' ? value * 1000 : value);
              return Number.isFinite(date.getTime()) ? date.toISOString() : 'Unknown';
            };
            const node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
            const stationContent = station => {
              const card = node('div', ''); card.className = 'station-card';
              card.append(node('h3', station.code), node('p', station.name || station.code),
                node('p', 'METAR category: ' + station.category), node('p', 'Wind: ' + formatWind(station)),
                node('p', 'Visibility: ' + formatValue(station.visibility_sm, ' SM')),
                node('p', 'Ceiling: ' + formatValue(station.ceiling_ft, ' ft')),
                node('p', 'Temp: ' + formatValue(station.temperature_f, '°F')));
              for (const [key, label] of [['metar_reports', 'METAR observation'], ['taf', 'TAF forecast']]) {
                const product = station[key];
                const details = document.createElement('details'); details.append(node('summary', label + ': ' + (product?.status || 'unavailable')));
                if (product?.status !== 'available') details.append(node('p', product?.status === 'no_reports' ? 'No reports available' : 'Provider unavailable'));
                for (const report of product?.reports || []) {
                  details.append(node('p', 'Issued ' + utc(report.issueTime ?? report.reportTime ?? report.obsTime)
                    + (key === 'taf' ? ' · Valid ' + utc(report.validTimeFrom) + ' → ' + utc(report.validTimeTo) : '')),
                    node('pre', report.rawTAF ?? report.rawOb ?? 'Report text unavailable'));
                }
                details.append(node('p', 'Source: ' + (product?.source?.provider || 'Unknown') + ' · Retrieved ' + utc(product?.source?.retrieved_at_utc)));
                card.append(details);
              }
              if (station.partial) card.append(node('p', 'Partial weather: a provider is unavailable.'));
              card.append(node('p', 'Updated ' + utc(station.updatedAt)));
              return card;
            };
            const located = station => Number.isFinite(station.latitude) && Number.isFinite(station.longitude);
            const renderStationList = stations => {
              stationList.replaceChildren(...(stations.length ? stations.map(stationContent) : [node('p', 'No stations available for this region.')]));
            };
            const renderMarkers = stations => {
              markersLayer.clearLayers();
              stations.filter(located).forEach(station => {
                const color = CATEGORY_COLORS[station.category] || CATEGORY_COLORS.UNKNOWN;
                const marker = L.circleMarker([station.latitude, station.longitude], {
                  radius: 7, color, fillColor: color, fillOpacity: 0.85, weight: 2,
                });
                marker.bindPopup(stationContent(station));
                marker.on('click', () => { applyStationSelection(station.code); void requestBriefing(); });
                marker.addTo(markersLayer);
              });
            };

            const loadRegion = async (regionId, focusStationCode = null) => {
              regionRequest?.abort(); ++selectionRequest;
              const selectedAtStart = getStation();
              currentStations = []; markersLayer.clearLayers(); highlightLayer.clearLayers();
              const controller = regionRequest = new AbortController();
              const region = REGION_CONFIGS.find((entry) => entry.id === regionId) || REGION_CONFIGS[0];
              regionSelect.value = region.id;
              stationList.innerHTML = '<p class="muted">Loading region weather...</p>';
              try {
                const response = await fetch('/stations?region=' + region.id, { signal: controller.signal });
                if (!response.ok) {
                  throw new Error('Request failed with status ' + response.status);
                }
                const payload = await response.json();
                if (controller.signal.aborted) return;
                const stations = payload.stations || [];
                currentStations = stations;
                renderMarkers(stations);
                renderStationList(stations);
                if (focusOnStation(getStation(), stations)) {
                  return;
                }
                if (getStation() !== selectedAtStart) return;
                highlightStation(null);
                if (region.bounds) {
                  map.fitBounds(region.bounds, { padding: [24, 24] });
                }
              } catch (error) {
                if (!controller.signal.aborted) stationList.replaceChildren(node('p', 'Failed to load region data.'));
              }
            };

            form.addEventListener('submit', async (event) => {
              event.preventDefault();
              const manualStation = normalizeStation(stationInput.value);
              if (manualStation && isValidStationCode(manualStation)) {
                applyStationSelection(manualStation);
              } else {
                stationInput.value = stationSelect.value;
              }
              await requestBriefing();
            });

            regionSelect.addEventListener('change', () => {
              void loadRegion(regionSelect.value);
            });

            stationSelect.addEventListener('change', () => {
              applyStationSelection(stationSelect.value);
            });

            stationInput.addEventListener('blur', () => {
              const manualStation = normalizeStation(stationInput.value);
              if (manualStation && isValidStationCode(manualStation)) {
                applyStationSelection(manualStation);
              }
            });

            refreshMapBtn.addEventListener('click', () => {
              void loadRegion(regionSelect.value);
            });

            void loadRegion(DEFAULT_REGION_ID);
          </script>
          <script async src="https://meta-app.jordanhubbard.net/aviation-data.js"></script>
          <script defer data-aviation-app="weather-briefing" src="https://meta-app.jordanhubbard.net/feedback-widget.js"></script>
          <script type="module">
            import '/api/explain/widget.js';
            window.AviationExplain.registerContext(() => {
              const station = stationInput.value.trim().toUpperCase() || stationSelect.value;
              return {
              application: 'Weather Briefing', decision: 'Selected station weather category and briefing',
              selectedStation: station, briefingStation, region: regionSelect.value,
              category: currentStations.find(entry => entry.code === station)?.category,
              completedBriefing: hasBriefing && !submitBtn.disabled, displayedBriefing: output.textContent.slice(0, 3500),
              };
            }, 'Explain the selected weather category and briefing hazards using only the displayed observations and forecasts, preserving their separate issue/validity times.');
          </script>
        </body>
      </html>
    `);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`HTTP server listening on port ${port}`);
  });

  // The browser E2E runner supplies deterministic weather responses itself.
  if (process.env.AVIATION_E2E_OFFLINE !== "true") {
    console.log("\n" + "=".repeat(60));
    console.log("DEMO: Generating briefing for San Francisco (KSFO)...");
    console.log("=".repeat(60) + "\n");

    const briefing = await service.generateBriefing("KSFO");
    console.log(briefing);

    console.log("\n" + "=".repeat(60));
    console.log("Service will continue monitoring. Try other locations:");
    console.log('  await service.generateBriefing("KJFK")');
    console.log('  await service.generateBriefing("KLAX")');
    console.log("=".repeat(60) + "\n");
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    explanation.close();
    console.log("\n\nShutting down Weather Briefing Service...");
    await service.stop();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.log("Weather Briefing Service is running. Press Ctrl+C to stop.\n");
}

main().catch((error) => {
  console.error("Failed to start Weather Briefing Service:", error);
  process.exit(1);
});
