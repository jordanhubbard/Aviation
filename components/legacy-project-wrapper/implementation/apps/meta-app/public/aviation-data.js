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
        .notam-inactive{flex-direction:row;align-items:center}.notam-inactive input{width:auto}
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
        <div class="point-controls" hidden><label>Weather review point<select name="point" aria-label="Weather review point"></select></label></div>
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
        <p class="hint">Current provider data is not a complete flight briefing. Load cached FAA NMS status and notices below, and independently <a href="https://notams.aim.faa.gov/notamSearch/" target="_blank" rel="noopener noreferrer">review FAA NOTAMs</a>. Loading data does not complete your preflight review.</p>
        <div role="region" aria-label="Cached FAA NMS NOTAM review">
          <h3>FAA NMS cached NOTAMs</h3>
          <p class="hint">Read the selected source airport/location only. Status is as received; this view does not refresh automatically. Weather forecast time does not select NOTAM applicability. Exact source aliases and international coverage may be incomplete.</p>
          <form aria-label="NOTAM location review">
            <label>NOTAM source location<input name="notam-airport" maxlength="8" pattern="[A-Za-z0-9]{2,8}" required autocomplete="off"></label>
            <label class="notam-inactive">Include cancelled and expired notices<input name="notam-inactive" type="checkbox"></label>
            <button type="submit">Load cached NOTAMs</button>
          </form>
          <p class="notam-status" role="status">Select a source location, then explicitly load its cached notices.</p>
          <div class="notam-results"></div>
        </div>
      </section>`;
      this.q('input[name=airports]').value = this.getAttribute('airports') || '';
      this.q('input[name=notam-airport]').value = this.firstNotamLocation();
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
      this.q('form[aria-label="NOTAM location review"]').addEventListener('submit', event => { event.preventDefault(); void this.loadNotams(); });
      this.q('input[name=notam-airport]').addEventListener('input', () => this.clearNotams());
      this.q('input[name=notam-inactive]').addEventListener('change', () => this.clearNotams());
      this.q('.source-load').addEventListener('click', () => void this.loadSources());
    }
    disconnectedCallback() { this.routeRequest?.abort(); this.pointRequest?.abort(); this.referenceRequest?.abort(); this.sourceRequest?.abort(); this.clearNotams(); }
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
      this.clearNotams();
      this.q('input[name=notam-airport]').value = this.firstNotamLocation();
      this.routeRequest?.abort(); this.pointRequest?.abort(); this.points = [];
      this.q('.route').replaceChildren(); this.q('.environment').replaceChildren();
      this.q('.point-controls').hidden = true;
      this.q('.status').textContent = 'Context changed. Load aviation data to review this selection.';
      this.q('form[aria-label="Aviation route review"] button').disabled = false;
    }
    async request(path, controller, body) {
      const response = await fetch(api + path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]), credentials: 'omit',
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      if (!response.ok) { const error = new Error(`Provider request unavailable (HTTP ${response.status}).`); error.status = response.status; throw error; }
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
      this.clearNotams();
      this.q('input[name=notam-airport]').value = /^[A-Z0-9]{2,8}$/.test(point?.name || '') ? point.name : '';
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
    firstNotamLocation() {
      const first = this.q('input[name=airports]').value.trim().toUpperCase().split(/[\s,;→]+/)[0];
      return /^[A-Z0-9]{2,8}$/.test(first || '') ? first : '';
    }
    clearNotams() {
      this.notamRequest?.abort(); this.notamDetailRequest?.abort();
      if (this.notamDetailView) { this.notamDetailView.out.replaceChildren(); this.notamDetailView.button.disabled = false; this.notamDetailView = null; }
      this.notamGeneration = (this.notamGeneration || 0) + 1; this.notamSnapshot = null;
      if (!this.shadowRoot) return;
      this.q('.notam-results').replaceChildren();
      this.q('.notam-status').textContent = 'Selection changed. Explicitly load cached notices for this source location.';
      this.q('form[aria-label="NOTAM location review"] button').disabled = false;
    }
    async loadNotams(offset = 0, continuing = false) {
      const airport = this.q('input[name=notam-airport]').value.trim().toUpperCase();
      const includeInactive = this.q('input[name=notam-inactive]').checked;
      const previous = continuing ? this.notamSnapshot : null;
      this.clearNotams();
      const generation = this.notamGeneration, controller = this.notamRequest = new AbortController();
      const status = this.q('.notam-status'), out = this.q('.notam-results');
      if (!/^[A-Z0-9]{2,8}$/.test(airport)) { status.textContent = 'Enter one source location with 2–8 ASCII letters/digits.'; return; }
      if (continuing && !previous) { status.textContent = 'Reload notices before requesting another page.'; return; }
      const query = new URLSearchParams({ airport, include_inactive: String(includeInactive), limit: '20', offset: String(offset), ...(previous ? { snapshot_id: previous.id } : {}) });
      this.q('form[aria-label="NOTAM location review"] button').disabled = true; status.textContent = 'Loading cached NOTAMs…';
      try {
        const data = await this.request('/notams?' + query, controller);
        if (controller.signal.aborted || generation !== this.notamGeneration) return;
        if (!['available', 'no_reports', 'partial', 'stale', 'unavailable'].includes(data.status) ||
          ![null, 'production', 'staging', 'fit'].includes(data.environment) ||
          typeof data.production_data !== 'boolean' || typeof data.complete_snapshot !== 'boolean' ||
          (data.production_data && (data.environment !== 'production' || !data.complete_snapshot)) ||
          !Number.isInteger(data.total) || data.total < 0 || data.offset !== offset || !Number.isInteger(data.incomplete_records) || data.incomplete_records < 0 || data.incomplete_records > data.total ||
          !Array.isArray(data.notams) || data.notams.length > 20 || data.notams.length > data.total || data.limit !== 20 ||
          !data.notams.every(n => typeof n.id === 'string' && n.id.length <= 128 && (n.text === null || typeof n.text === 'string')) ||
          !Array.isArray(data.warnings) || !data.warnings.every(w => typeof w === 'string') || !Array.isArray(data.requested_locations) || data.requested_locations.length !== 1 || data.requested_locations[0] !== airport || !Array.isArray(data.matched_locations) || !data.matched_locations.every(v => typeof v === 'string') || data.source?.environment !== data.environment ||
          !(data.next_offset === null || (Number.isInteger(data.next_offset) && data.next_offset > offset && data.next_offset <= 250000)) ||
          !(data.snapshot_id === null || /^[a-f0-9]{64}$/.test(data.snapshot_id)) ||
          (['available', 'no_reports'].includes(data.status) && (!data.complete_snapshot || !data.snapshot_id)) ||
          (data.status === 'no_reports' && (data.total !== 0 || data.notams.length !== 0))) throw new Error('Invalid cached NOTAM coverage response.');
        if (previous && (data.snapshot_id !== previous.id || data.total !== previous.total || data.environment !== previous.environment || data.production_data !== previous.production_data || data.complete_snapshot !== previous.complete_snapshot))
          throw new Error('NMS snapshot or coverage changed. Reload the notices.');
        const end = offset + data.notams.length;
        if (new Set(data.notams.map(n => n.id)).size !== data.notams.length || end > data.total ||
          (data.next_offset !== null && (data.notams.length === 0 || data.next_offset !== end)) ||
          (end < data.total && data.next_offset === null)) throw new Error('Incomplete or inconsistent NOTAM pagination.');
        if (data.snapshot_id) this.notamSnapshot = { id: data.snapshot_id, total: data.total, environment: data.environment, production_data: data.production_data, complete_snapshot: data.complete_snapshot };
        status.textContent = `FAA NMS · ${airport} · ${data.status} · environment ${data.environment || 'not selected'}`;
        out.append(el('p', `Production feed data: ${data.production_data ? 'yes' : 'no'} · Complete snapshot: ${data.complete_snapshot ? 'yes' : 'no'}`),
          el('p', `Synchronized ${utc(data.synchronized_at)} · Full load ${utc(data.full_load_at)}`, { class: 'hint' }),
          el('p', `Requested: ${data.requested_locations.join(', ') || 'Unknown'} · Matched source aliases: ${data.matched_locations.join(', ') || 'none returned'}`),
          el('p', `Showing ${data.notams.length ? (offset + 1) + '–' + end : '0 on this page'} of ${data.total} matching cached records · ${show(data.incomplete_records)} matched records missing source fields`));
        this.source(out, data);
        if (data.environment !== 'production') out.append(el('p', 'Non-production or unselected feed. These notices do not establish production NOTAM coverage.', { class: 'warning' }));
        if (data.status !== 'available' || !data.production_data || !data.complete_snapshot) out.append(el('p', 'Coverage is limited. Do not interpret missing or zero returned notices as absent applicable NOTAMs.', { class: 'warning' }));
        if (data.status === 'no_reports') out.append(el('p', 'No matching cached records for this selection; this is not a complete NOTAM briefing.'));
        for (const warning of data.warnings) out.append(el('p', warning, { class: 'warning' }));
        if (data.error) out.append(el('p', data.error, { class: 'error' }));
        for (const notice of data.notams) {
          const article = el('article', null, { 'aria-label': `NOTAM ${notice.id}` });
          this.renderNotam(article, notice);
          if (this.notamSnapshot) {
            const detail = el('div'), button = el('button', 'Read full source notice', { type: 'button' });
            const pin = this.notamSnapshot;
            button.onclick = () => void this.loadNotamDetail(notice.id, pin, generation, detail, button);
            article.append(button, detail);
          }
          out.append(article);
        }
        const pages = el('div', null, { class: 'controls' });
        for (const [label, next] of [['Previous NOTAM page', offset ? Math.max(0, offset - 20) : null], ['Next NOTAM page', data.next_offset]]) {
          if (next !== null) { const button = el('button', label, { type: 'button' }); button.onclick = () => void this.loadNotams(next, true); pages.append(button); }
        }
        out.append(pages);
      } catch (error) {
        if (!controller.signal.aborted && generation === this.notamGeneration) {
          out.replaceChildren(); this.notamSnapshot = null;
          status.textContent = error.status === 409 ? 'NMS snapshot changed. Explicitly reload the notices.' : `${error.message} Cached NOTAMs could not be reviewed. Explicitly reload when available.`;
        }
      } finally { if (!controller.signal.aborted && generation === this.notamGeneration) this.q('form[aria-label="NOTAM location review"] button').disabled = false; }
    }
    renderNotam(node, notice) {
      node.append(el('h4', `${notice.number || notice.id} · ${notice.location || 'Unknown location'}`),
        el('p', `Source identity: ${notice.id} · ICAO alias: ${notice.icao_location || 'Unknown'}`),
        el('p', `Classification ${notice.classification || 'Unknown'} · Source type ${notice.type || 'Unknown'} · Activity ${notice.activity || 'Unknown'}`),
        el('p', `Effective ${utc(notice.effective_start_utc)} → ${notice.permanent ? 'PERMANENT' : utc(notice.effective_end_utc)}${notice.estimated ? ' (estimated expiry)' : ''}`),
        el('p', `Updated ${utc(notice.last_updated_utc)} · Cancelled ${utc(notice.cancelled_at_utc)}`, { class: 'hint' }),
        el('pre', notice.text ?? 'Source notice text unavailable.'));
      if (notice.schedule) node.append(el('p', 'Source schedule: ' + notice.schedule));
      if (notice.text_truncated) node.append(el('p', `Preview only (${notice.text_length} source characters). Read full source notice below.`, { class: 'warning' }));
      if (notice.missing_fields?.length) node.append(el('p', 'Missing source fields: ' + notice.missing_fields.join(', '), { class: 'warning' }));
    }
    async loadNotamDetail(id, pin, generation, out, button) {
      this.notamDetailRequest?.abort();
      if (this.notamDetailView) { this.notamDetailView.out.replaceChildren(); this.notamDetailView.button.disabled = false; }
      const controller = this.notamDetailRequest = new AbortController(); this.notamDetailView = { out, button };
      button.disabled = true; out.replaceChildren(el('p', 'Loading full source notice…'));
      try {
        const query = new URLSearchParams({ id, snapshot_id: pin.id });
        const data = await this.request('/notams/detail?' + query, controller);
        if (controller.signal.aborted || generation !== this.notamGeneration) return;
        if (!['available', 'no_reports', 'partial', 'stale', 'unavailable'].includes(data.status) || data.snapshot_id !== pin.id || data.environment !== pin.environment || data.production_data !== pin.production_data || data.notice?.id !== id || data.notice.text_truncated !== false || !data.source_feature || typeof data.source_feature !== 'object' || Array.isArray(data.source_feature))
          throw new Error('NMS detail identity or coverage changed. Reload the notices.');
        out.replaceChildren(el('h4', 'Full original source notice'), el('p', `Detail status: ${data.status} · Environment ${data.environment} · Production feed data: ${data.production_data ? 'yes' : 'no'}`));
        this.renderNotam(out, data.notice); this.source(out, data);
        for (const warning of data.warnings || []) out.append(el('p', warning, { class: 'warning' }));
        const original = el('details'); original.append(el('summary', 'Original source record'), el('pre', JSON.stringify(data.source_feature, null, 2))); out.append(original);
      } catch (error) { if (!controller.signal.aborted && generation === this.notamGeneration) out.replaceChildren(el('p', error.message + ' Reload notices before retrying detail.', { class: 'error' })); }
      finally { if (!controller.signal.aborted && generation === this.notamGeneration) button.disabled = false; }
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
            el('p', source.id === 'faa-nms' ? (source.configured ? 'Cache-reader environment selected; feed availability is separate.' : 'Cache-reader environment not selected.') : (source.configured ? 'Configured' : 'Not configured')), el('p', source.coverage),
            el('p', source.license), el('p', source.limitations, { class: 'hint' })); out.append(article);
        }
      } catch (error) { if (!controller.signal.aborted) out.replaceChildren(el('p', error.message, { class: 'error' })); }
    }
  }
  customElements.define('aviation-data-panel', AviationDataPanel);
})();
