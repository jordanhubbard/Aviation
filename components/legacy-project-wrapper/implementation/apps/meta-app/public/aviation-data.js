/* Application-owned aviation data view. Provider access and credentials stay in the planner. */
(() => {
  if (customElements.get('aviation-data-panel')) return;
  const api = 'https://meta-app.jordanhubbard.net/api/v1/planning/api';
  const el = (tag, text, attrs = {}) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = String(text);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  const utc = value => {
    if (value == null || value === '') return 'Unknown';
    const date = new Date(typeof value === 'number' ? value * 1000 : value);
    return Number.isFinite(date.getTime()) ? date.toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Unknown';
  };
  const show = value => value == null ? 'Unknown' : String(value);
  const resources = ['airports', 'airspaces', 'navaids', 'reporting-points', 'hotspots', 'obstacles'];
  class AviationDataPanel extends HTMLElement {
    static get observedAttributes() { return ['airports', 'valid-at']; }
    connectedCallback() {
      if (this.shadowRoot) return;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host{display:block;margin:16px 0;color:#172033;font:15px/1.5 system-ui,sans-serif;color-scheme:light;min-width:0}
        *{box-sizing:border-box}section{border:1px solid #b8c5d6;border-radius:10px;background:#fff;padding:16px}
        h2{font-size:1.25rem;margin:0 0 8px}h3{font-size:1.05rem;margin:16px 0 8px}h4{margin:10px 0 4px}
        p{margin:6px 0}form,.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:12px 0}
        label{display:flex;flex-direction:column;gap:4px;max-width:100%}input,select,button{font:inherit;max-width:100%;padding:8px;border:1px solid #7b8da6;border-radius:5px;background:#fff;color:#172033}
        input[name=airports]{width:330px}button{background:#174b99;color:white;cursor:pointer;min-height:42px}button:disabled{opacity:.6;cursor:wait}
        :focus-visible{outline:3px solid #e67b00;outline-offset:2px}.hint,small{color:#43536a;font-size:.85rem}.warning{background:#fff1d6;padding:8px;border-left:4px solid #a25800}.error{color:#9a1c14}
        pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,monospace;background:#edf2f8;padding:10px}
        article{border-top:1px solid #d1dbe7;padding:10px 0;overflow-wrap:anywhere}details{margin:10px 0}summary{cursor:pointer;font-weight:600}
        .scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.85rem}td,th{padding:7px;text-align:left;border-bottom:1px solid #d1dbe7;white-space:nowrap}
        a{color:#174b99}dl{display:grid;grid-template-columns:minmax(90px,1fr) 2fr;gap:4px}dd{margin:0;overflow-wrap:anywhere}
        [hidden]{display:none!important}@media(max-width:550px){section{padding:12px}form,label,input,button{width:100%}h2{font-size:1.1rem}}
      </style><section aria-label="Aviation data review">
        <h2>Aviation data review</h2>
        <p class="hint">Review route TAFs/METARs, modeled winds, US weather alerts and airport events. Reference data is available below.</p>
        <form aria-label="Aviation route review">
          <label>Route airports, in order<input name="airports" placeholder="KPAO KSAC" required maxlength="249" autocomplete="off"></label>
          <label>Forecast validity time (UTC, optional)<input name="valid" type="datetime-local"></label>
          <button type="submit">Load aviation data</button>
        </form>
        <p><a class="assessment-link" href="https://flight-planner.jordanhubbard.net/route-assessment">Open route hazard assessment</a> <span class="hint">Review timing and altitude before assessing.</span></p>
        <p role="status" class="status">Choose a route or a single airport, then load data.</p>
        <div class="route"></div>
        <div class="point-controls" hidden><label>Weather review point<select name="point"></select></label></div>
        <div class="environment"></div>
        <details class="references"><summary>openAIP reference lookup</summary>
          <p class="hint">Worldwide community reference data, licensed CC BY-NC 4.0. Country and search are explicit filters, independent of the route. Check the provider record and dates.</p>
          <form aria-label="Reference lookup">
            <label>Collection<select name="resource">${resources.map(r => `<option>${r}</option>`).join('')}</select></label>
            <label>Country (two-letter code)<input name="country" placeholder="US" maxlength="2" pattern="[A-Za-z]{2}"></label>
            <label>Search<input name="search" placeholder="Airport, navaid or airspace name" maxlength="80" minlength="3"></label>
            <button type="submit">Find reference data</button>
          </form><div class="reference-results" role="region" aria-label="Reference results"></div>
        </details>
        <details class="sources"><summary>Sources and availability</summary><button type="button" class="source-load">Check source configuration</button><div class="source-results"></div></details>
        <p class="hint">Current provider data is not a complete flight briefing. FAA NOTAM/NMS is not connected; <a href="https://notams.aim.faa.gov/notamSearch/" target="_blank" rel="noopener noreferrer">review FAA NOTAMs</a>. Loading data does not complete your preflight review.</p>
      </section>`;
      this.q('input[name=airports]').value = this.getAttribute('airports') || '';
      this.setTime();
      this.updateAssessmentLink();
      this.q('form[aria-label="Aviation route review"]').addEventListener('submit', event => { event.preventDefault(); void this.loadRoute(); });
      this.q('input[name=airports]').addEventListener('input', () => this.clearRoute());
      this.q('input[name=valid]').addEventListener('input', () => this.clearRoute());
      this.q('select[name=point]').addEventListener('change', () => void this.loadPoint());
      this.q('form[aria-label="Reference lookup"]').addEventListener('submit', event => { event.preventDefault(); void this.loadReference(1); });
      for (const node of this.shadowRoot.querySelectorAll('.references input,.references select')) {
        node.addEventListener('input', () => { this.referenceRequest?.abort(); this.q('.reference-results').replaceChildren(); });
      }
      this.q('.source-load').addEventListener('click', () => void this.loadSources());
    }
    disconnectedCallback() { this.routeRequest?.abort(); this.pointRequest?.abort(); this.referenceRequest?.abort(); this.sourceRequest?.abort(); }
    attributeChangedCallback(name, old, value) {
      if (!this.shadowRoot || old === value) return;
      if (name === 'airports') this.q('input[name=airports]').value = value || '';
      if (name === 'valid-at') this.setTime();
      this.clearRoute();
    }
    q(selector) { return this.shadowRoot.querySelector(selector); }
    setTime() {
      const raw = this.getAttribute('valid-at');
      const date = raw ? new Date(raw) : null;
      this.q('input[name=valid]').value = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : '';
    }
    updateAssessmentLink() {
      const codes = this.q('input[name=airports]').value.trim().toUpperCase().split(/[\s,;→]+/).filter(Boolean);
      const url = new URL('https://flight-planner.jordanhubbard.net/route-assessment');
      if (codes.length >= 2 && codes.length <= 50 && codes.every(code => /^[A-Z0-9]{3,4}$/.test(code))) url.searchParams.set('airports', codes.join(' '));
      this.q('.assessment-link').href = url.href;
    }
    clearRoute() {
      this.updateAssessmentLink();
      this.routeRequest?.abort(); this.pointRequest?.abort(); this.points = [];
      this.q('.route').replaceChildren(); this.q('.environment').replaceChildren();
      this.q('.point-controls').hidden = true;
      this.q('.status').textContent = 'Context changed. Load aviation data to review this selection.';
      this.q('form[aria-label="Aviation route review"] button').disabled = false;
    }
    async request(path, controller, body) {
      const response = await fetch(api + path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]), credentials: 'omit',
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw new Error(`Provider request unavailable (HTTP ${response.status}).`);
      return response.json();
    }
    source(container, payload) {
      const source = payload.source || {};
      container.append(el('p', `${source.provider || 'Provider unknown'} · Retrieved ${utc(source.retrieved_at_utc)}${source.effective_date ? ' · Effective ' + source.effective_date : ''}`, { class: 'hint' }));
      if (source.license || source.attribution) container.append(el('p', [source.attribution, source.license].filter(Boolean).join(' · '), { class: 'hint' }));
      if (payload.limitations) container.append(el('p', payload.limitations, { class: 'hint' }));
      if (payload.truncated) container.append(el('p', 'Results are truncated. Refine the selection or request the next page where available.', { class: 'warning' }));
    }
    async loadRoute() {
      this.clearRoute();
      const airports = this.q('input[name=airports]').value.trim().toUpperCase().split(/[\s,;→]+/).filter(Boolean);
      if (!airports.length || airports.length > 50 || airports.some(code => !/^[A-Z0-9]{3,4}$/.test(code))) {
        this.q('.status').textContent = 'Enter 1–50 ICAO/IATA airport codes in route order, separated by spaces.'; return;
      }
      const valid = this.q('input[name=valid]').value;
      const date = valid ? new Date(valid + 'Z') : null;
      if (date && !Number.isFinite(date.getTime())) { this.q('.status').textContent = 'Enter a valid UTC time.'; return; }
      const body = { airports: airports.length === 1 ? [airports[0], airports[0]] : airports,
        corridor_nm: 25, max_stations: 100, include_metars: true, ...(date ? { valid_at: date.toISOString() } : {}) };
      const controller = this.routeRequest = new AbortController();
      this.q('form[aria-label="Aviation route review"] button').disabled = true;
      this.q('.status').textContent = 'Loading route reports…';
      try {
        const data = await this.request('/aviation-weather/route', controller, body);
        if (controller.signal.aborted) return;
        this.renderRoute(data);
        this.q('.status').textContent = `Loaded ${data.stations.length} reporting stations for ${airports.join(' → ')}. Review each source and report time.`;
        const seen = new Set();
        this.points = [...(data.resolved_airports || []).map(a => ({ ...a, name: a.station_id })),
          ...data.stations.map(s => ({ ...s, name: s.station_id }))].filter(a => {
          if (seen.has(a.name)) return false; seen.add(a.name); return true;
        });
        const select = this.q('select[name=point]'); select.replaceChildren();
        this.points.forEach((point, index) => select.append(el('option', point.name, { value: index })));
        this.q('.point-controls').hidden = !this.points.length;
        if (this.points.length) await this.loadPoint();
      } catch (error) {
        if (!controller.signal.aborted) this.q('.status').textContent = `${error.message} Route reports could not be loaded. Retry when available.`;
      } finally { if (!controller.signal.aborted) this.q('form[aria-label="Aviation route review"] button').disabled = false; }
    }
    renderRoute(data) {
      const out = this.q('.route'); out.replaceChildren(el('h3', 'TAFs and METARs along the route'));
      this.source(out, data);
      if (data.partial) out.append(el('p', 'Partial briefing: one or more provider requests failed.', { class: 'warning' }));
      if (data.discovery_limited) out.append(el('p', `Station discovery is limited by missing NOAA coordinates. Unlocated TAF stations: ${(data.source?.unlocated_taf_station_ids || []).join(', ') || 'Unknown'}.`, { class: 'warning' }));
      if (!data.stations.length) out.append(el('p', 'No reporting stations found in this corridor. This does not establish safe conditions.'));
      for (const station of data.stations) {
        const card = el('article', null, { 'aria-label': `${station.station_id} route weather` });
        card.append(el('h4', `${station.station_id} · ${station.requested_airport ? 'Requested airport' : 'Nearby reporting station'}`));
        card.append(el('p', `${show(station.distance_from_route_nm?.toFixed(1))} NM from route · Leg ${station.closest_leg + 1} · Forecast validity: ${({ not_requested: 'No time selected', valid: 'Valid at selected time', outside_validity: 'Outside forecast validity', unknown: 'Unknown' }[station.valid_at_status] || 'Unknown')}`));
        for (const product of ['taf', 'metar']) {
          const group = station[product]; if (!group) continue;
          card.append(el('h4', product.toUpperCase()));
          if (group.status !== 'available' || !group.reports.length) card.append(el('p', group.status === 'unavailable' ? 'Provider unavailable. Reports could not be retrieved.' : 'No reports available.'));
          for (const report of group.reports) {
            card.append(el('p', `Issued ${utc(report.issueTime ?? report.reportTime ?? report.obsTime)}${product === 'taf' ? ' · Valid ' + utc(report.validTimeFrom) + ' → ' + utc(report.validTimeTo) : ''}`, { class: 'hint' }));
            card.append(el('pre', report.rawTAF ?? report.rawOb ?? 'Report text unavailable.'));
          }
          this.source(card, group);
        }
        out.append(card);
      }
    }
    async loadPoint() {
      this.pointRequest?.abort();
      const controller = this.pointRequest = new AbortController();
      const point = this.points?.[Number(this.q('select[name=point]').value)];
      const out = this.q('.environment'); out.replaceChildren(); if (!point) return;
      const query = new URLSearchParams({ lat: point.latitude, lon: point.longitude });
      const jobs = [
        ['Modeled winds aloft', '/aviation-weather/winds-aloft?' + query + '&hours=6', (node, data) => this.renderWinds(node, data)],
        ['NWS active alerts', '/aviation-data/nws/alerts?' + query, (node, data) => this.renderRecords(node, data, 'alerts')],
        ['NWS surface forecast', '/aviation-data/nws/forecast?' + query, (node, data) => this.renderForecast(node, data)],
        ['FAA NAS airport events (US)', '/aviation-data/faa/airport-events', (node, data) => this.renderRecords(node, data, 'events')],
        ['NOAA center weather advisories (US, all centers)', '/aviation-weather/cwa', (node, data) => this.renderRecords(node, data, 'cwa')],
        ['Nearby TAF stations', '/aviation-weather/stations?' + query + '&radius_nm=50&limit=50', (node, data) => this.renderStations(node, data)],
      ];
      await Promise.all(jobs.map(async ([title, path, render]) => {
        const details = el('details'); const summary = el('summary', `${title} · ${point.name} · Loading…`);
        const content = el('div'); content.append(el('p', 'Loading…', { role: 'status' })); details.append(summary, content); out.append(details);
        try {
          const data = await this.request(path, controller);
          if (controller.signal.aborted) return;
          content.replaceChildren(); render(content, data); this.source(content, data);
          summary.textContent = `${title} · ${point.name} · ${data.status === 'no_reports' ? 'No reports' : 'Loaded'}`;
          if (title.includes('NAS')) content.prepend(el('p', 'All reported US airport events; not filtered to this point or route. Airport identifiers below are FAA IDs.', { class: 'hint' }));
          if (title.includes('advisories')) content.prepend(el('p', 'All reported US center advisories; route intersection is not determined.', { class: 'hint' }));
        } catch (error) { if (!controller.signal.aborted) { summary.textContent = `${title} · ${point.name} · Unavailable`; content.replaceChildren(el('p', error.message + ' Check this source’s coverage and retry.', { class: 'error' })); } }
      }));
    }
    table(container, headers, rows) {
      const scroll = el('div', null, { class: 'scroll', tabindex: '0' }); const table = el('table');
      const head = el('tr'); headers.forEach(header => head.append(el('th', header, { scope: 'col' })));
      const thead = el('thead'); thead.append(head); table.append(thead); const body = el('tbody');
      for (const row of rows) { const tr = el('tr'); row.forEach(value => tr.append(el('td', show(value)))); body.append(tr); }
      table.append(body); scroll.append(table); container.append(scroll);
    }
    renderWinds(node, response) {
      const { hourly = {}, hourly_units: units = {} } = response.data || {};
      const rows = [];
      (hourly.time || []).forEach((time, i) => (response.levels_hpa || []).forEach(level => {
        const cell = field => { const key = `${field}_${level}hPa`; return `${show(hourly[key]?.[i])} ${units[key] || ''}`; };
        rows.push([time + ' UTC', level + ' hPa', cell('wind_speed'), cell('wind_direction'), cell('temperature'), cell('geopotential_height')]);
      }));
      this.table(node, ['Time', 'Pressure', 'Speed', 'Direction', 'Temperature', 'Geopotential height'], rows);
      if (!rows.length) node.append(el('p', 'No modeled wind periods available.'));
    }
    renderForecast(node, response) {
      const periods = response.data?.properties?.periods || [];
      for (const period of periods) {
        const article = el('article'); article.append(el('h4', period.name || utc(period.startTime)),
          el('p', `${utc(period.startTime)} → ${utc(period.endTime)}`),
          el('p', `${show(period.temperature)} ${show(period.temperatureUnit)} · Wind ${show(period.windDirection)} ${show(period.windSpeed)}`),
          el('p', period.detailedForecast || period.shortForecast || 'Forecast text unavailable.')); node.append(article);
      }
      if (!periods.length) node.append(el('p', 'No surface forecast periods available.'));
    }
    renderStations(node, response) {
      this.table(node, ['Station', 'Name', 'Distance from point'], (response.stations || []).map(s => [s.station_id, s.name, `${s.distance_from_route_nm.toFixed(1)} NM`]));
      if (!response.stations?.length) node.append(el('p', 'No nearby TAF stations found.'));
    }
    renderRecords(node, response, kind) {
      const records = response.records || response.reports || [];
      if (!records.length) node.append(el('p', 'No reports returned. Absence of reports does not establish safe or normal conditions.'));
      for (const record of records) {
        const data = record.properties || record;
        const article = el('article');
        article.append(el('h4', data.headline || data.event || data.name || data.airportId || data.cwsu || kind));
        if (kind === 'events') {
          if (data.airportLongName) article.append(el('p', data.airportLongName));
          for (const key of ['groundStop', 'groundDelay', 'airportClosure', 'freeForm', 'arrivalDelay', 'departureDelay', 'airportConfig', 'deicing']) {
            const event = data[key]; if (!event) continue;
            article.append(el('h4', key.replace(/([A-Z])/g, ' $1')));
            if (event.simpleText || event.text) article.append(el('p', event.simpleText || event.text));
            if (event.startTime || event.endTime) article.append(el('p', `${utc(event.startTime)} → ${utc(event.endTime)}`));
          }
        }
        const fields = el('dl');
        for (const key of ['icaoCode', 'iataCode', 'country', 'identifier', 'elevation', 'upperLimit', 'lowerLimit', 'frequency', 'frequencies']) {
          if (key in data) fields.append(el('dt', key.replace(/([A-Z])/g, ' $1')), el('dd', data[key] && typeof data[key] === 'object' ? JSON.stringify(data[key]) : show(data[key])));
        }
        if (fields.childElementCount) article.append(fields);
        for (const key of ['description', 'instruction', 'rawCWA', 'rawText', 'rawAirSigmet', 'summary', 'status', 'type']) {
          if (data[key] != null) article.append(el('p', typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]));
        }
        for (const key of ['sent', 'effective', 'onset', 'expires', 'ends', 'issueTime', 'validTimeFrom', 'validTimeTo']) {
          if (data[key] != null) article.append(el('p', `${key}: ${utc(data[key])}`, { class: 'hint' }));
        }
        const detail = el('details'); detail.append(el('summary', 'Full provider record'), el('pre', JSON.stringify(record, null, 2))); article.append(detail); node.append(article);
      }
    }
    async loadReference(page) {
      this.referenceRequest?.abort(); const controller = this.referenceRequest = new AbortController();
      const out = this.q('.reference-results'); out.replaceChildren();
      const country = this.q('input[name=country]').value.trim().toUpperCase();
      const search = this.q('input[name=search]').value.trim();
      if ((!country && search.length < 3) || (country && !/^[A-Z]{2}$/.test(country))) {
        out.append(el('p', 'Enter a two-letter country code or a search of at least three characters.')); return;
      }
      const resource = this.q('select[name=resource]').value;
      const params = new URLSearchParams({ page, limit: 25, ...(country ? { country } : {}), ...(search ? { search } : {}) });
      out.append(el('p', 'Loading reference data…', { role: 'status' }));
      try {
        const data = await this.request('/aviation-data/openaip/' + resource + '?' + params, controller);
        if (controller.signal.aborted) return;
        out.replaceChildren(el('h3', `${resource} · Page ${data.page} · Total ${data.total_count}`));
        this.renderRecords(out, data, resource); this.source(out, data);
        const buttons = el('div', null, { class: 'controls' });
        for (const [label, target] of [['Previous page', page > 1 ? page - 1 : null], ['Next page', data.next_page]]) {
          if (target) { const button = el('button', label, { type: 'button' }); button.onclick = () => void this.loadReference(target); buttons.append(button); }
        }
        out.append(buttons);
      } catch (error) { if (!controller.signal.aborted) out.replaceChildren(el('p', error.message + ' Check source configuration or retry.', { class: 'error' })); }
    }
    async loadSources() {
      this.sourceRequest?.abort(); const controller = this.sourceRequest = new AbortController(); const out = this.q('.source-results');
      out.replaceChildren(el('p', 'Loading source configuration…'));
      try {
        const data = await this.request('/aviation-data/sources', controller);
        if (controller.signal.aborted) return;
        out.replaceChildren(el('p', 'Configured means credentials are present where required; it does not establish live availability.', { class: 'hint' }));
        for (const source of data.sources) {
          const article = el('article'); article.append(el('h4', source.provider),
            el('p', source.configured ? 'Configured' : 'Not configured'), el('p', source.coverage),
            el('p', source.license), el('p', source.limitations, { class: 'hint' })); out.append(article);
        }
      } catch (error) { if (!controller.signal.aborted) out.replaceChildren(el('p', error.message, { class: 'error' })); }
    }
  }
  customElements.define('aviation-data-panel', AviationDataPanel);
})();
