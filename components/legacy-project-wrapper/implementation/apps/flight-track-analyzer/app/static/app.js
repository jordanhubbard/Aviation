import { openHelp } from './help.js';
import { lineChart, trackMap, patternPlot, legendFor, PHASES, phaseColor } from './charts.js';

const $view = document.getElementById('view');
const state = { caps: { llm: false }, view: 'flights', flightId: null, targetAgl: null };

// ---------- helpers ----------
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const f = (v, d = 0) => (v == null || !isFinite(v) ? '–' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }));
const dur = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; };
const when = (iso) => new Date(iso).toLocaleString();
async function api(path, opts) {
  const r = await fetch(path, opts);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body;
}
const table = (head, rows, opts = {}) => h('div', { class: 'scroll' }, h('table', {},
  h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, c)))),
  h('tbody', {}, rows.map((r, i) => {
    const tr = h('tr', { class: opts.onRow ? 'click' : '' }, r.map((c) => h('td', {}, c)));
    if (opts.onRow) tr.addEventListener('click', () => opts.onRow(i));
    return tr;
  }))));
const card = (v, l) => h('div', { class: 'card' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
const panel = (title, ...kids) => h('section', { class: 'panel' }, title ? h('h2', {}, title) : null, ...kids);

document.getElementById('help-btn').addEventListener('click', () => openHelp(state.caps));

// ---------- navigation ----------
document.getElementById('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) go(b.dataset.view);
});
function setNav() {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === (state.view === 'detail' ? 'flights' : state.view)));
}
function go(view, id = null) {
  state.view = view; state.flightId = id;
  if (view !== 'detail') state.targetAgl = null;
  location.hash = id ? `#/flight/${id}` : `#/${view}`;
  setNav();
  render();
}
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#\/flight\/([0-9a-f-]+)$/);
  if (m && state.flightId !== m[1]) { state.view = 'detail'; state.flightId = m[1]; setNav(); render(); }
});
async function render() {
  $view.replaceChildren(h('p', { class: 'mute' }, 'Loading…'));
  try {
    if (state.view === 'flights') await viewFlights();
    else if (state.view === 'summary') await viewSummary();
    else if (state.view === 'performance') await viewPerformance();
    else await viewDetail(state.flightId);
  } catch (e) { $view.replaceChildren(panel(null, h('p', { class: 'err' }, e.message))); }
}

// ---------- LLM panels (constructed only when the server reports an LLM) ----------
function llmPanel(kind, flightId) {
  if (!state.caps.llm) return null;
  const out = h('div', { class: 'llm-out', hidden: '' });
  const show = (t, err) => { out.hidden = false; out.textContent = t; out.classList.toggle('err', !!err); };
  const post = (path, body) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const note = h('p', { class: 'mute' }, `Only a compact numeric digest is sent to ${state.caps.model || 'the model'}; raw track points never leave this server. The reply is generated text, not measurement.`);
  const body = h('div', {});
  if (kind === 'debrief') {
    const focus = h('input', { type: 'text', placeholder: 'Optional focus, e.g. “landings”', size: 36 });
    const btn = h('button', { class: 'btn primary', onclick: async () => {
      btn.disabled = true; show('Thinking…');
      try { show((await post(`/api/flights/${flightId}/debrief`, { focus: focus.value || null })).text); }
      catch (e) { show(e.message, true); } finally { btn.disabled = false; }
    } }, 'Generate debrief');
    body.append(h('div', { class: 'row' }, focus, btn));
  } else {
    const q = h('textarea', { placeholder: 'Ask about your flights, e.g. “Is my downwind altitude getting steadier?”' });
    const btn = h('button', { class: 'btn primary', onclick: async () => {
      if (!q.value.trim()) return;
      btn.disabled = true; show('Thinking…');
      try { show((await post('/api/ask', { question: q.value, flight_ids: [] })).text); }
      catch (e) { show(e.message, true); } finally { btn.disabled = false; }
    } }, 'Ask');
    body.append(q, h('div', { class: 'row' }, btn));
  }
  return panel(kind === 'debrief' ? 'AI debrief' : 'Ask about your flights', note, body, out);
}

// ---------- flights list + upload ----------
async function viewFlights() {
  const { flights } = await api('/api/flights');
  const results = h('div', {});
  const input = h('input', { type: 'file', multiple: '', accept: '.kml,.xml', hidden: '' });
  const drop = h('div', { class: 'drop', tabindex: '0', role: 'button', 'aria-label': 'Upload KML files' }, 'Drop ForeFlight or Garmin KML tracklogs here, or click to choose (you will enter the aircraft tail number for each)');
  const TAIL = /^[A-Z0-9-]{1,10}$/;
  const lastTail = () => { try { return localStorage.getItem('kmlab.tail') || ''; } catch { return ''; } };
  const known = h('datalist', { id: 'known-tails' }, ...(await api('/api/aircraft')).aircraft.map((x) => h('option', { value: x.tail })));
  function stage(files) {
    if (!files.length) return;
    const guess = (n) => (n.match(/\bN\d{1,5}[A-Z]{0,2}\b/i) || [''])[0].toUpperCase() || lastTail();
    const rows = files.map((file) => ({ file, input: h('input', { type: 'text', value: guess(file.name), size: 10, maxlength: 10, list: 'known-tails', placeholder: 'N12345', 'aria-label': `tail number for ${file.name}`, style: 'text-transform:uppercase' }) }));
    const go = h('button', { class: 'btn primary' }, 'Upload');
    const all = h('input', { type: 'text', size: 10, maxlength: 10, list: 'known-tails', placeholder: 'N12345', 'aria-label': 'tail number for all files', style: 'text-transform:uppercase' });
    const valid = () => rows.every((r) => TAIL.test(r.input.value.trim().toUpperCase()));
    const refresh = () => { go.disabled = !valid(); rows.forEach((r) => r.input.classList.toggle('err', r.input.value !== '' && !TAIL.test(r.input.value.trim().toUpperCase()))); };
    rows.forEach((r) => r.input.addEventListener('input', refresh));
    all.addEventListener('input', () => { rows.forEach((r) => { r.input.value = all.value; }); refresh(); });
    go.addEventListener('click', async () => {
      go.disabled = true;
      const fd = new FormData();
      rows.forEach((r) => { fd.append('files', r.file); fd.append('aircraft', r.input.value.trim().toUpperCase()); });
      results.replaceChildren(h('p', { class: 'mute' }, `Analysing ${files.length} file(s)…`));
      try {
        const { results: rs } = await api('/api/flights', { method: 'POST', body: fd });
        try { localStorage.setItem('kmlab.tail', rows[rows.length - 1].input.value.trim().toUpperCase()); } catch { /* optional */ }
        results.replaceChildren(...rs.map((r) => h('p', { class: r.error ? 'err' : 'ok' },
          r.error ? `✗ ${r.filename}: ${r.error}` : `✓ ${r.filename} → ${r.aircraft}: ${r.name}${r.duplicate ? ' (already uploaded; tail updated)' : ''} — ${r.takeoffs} take-off(s), ${r.landings} landing(s)`)));
        if (rs.some((r) => !r.error)) setTimeout(() => { if (state.view === 'flights') render(); }, 1200);
      } catch (e) { results.replaceChildren(h('p', { class: 'err' }, e.message)); go.disabled = false; }
    });
    results.replaceChildren(h('h3', {}, 'Aircraft tail number is required for every file'),
      h('div', { class: 'row', style: 'margin-bottom:6px' }, h('label', {}, 'Same tail for all: ', all)),
      table(['File', 'Size', 'Tail number'], rows.map((r) => [r.file.name, `${f(r.file.size / 1024)} KB`, r.input])),
      h('div', { class: 'row', style: 'margin-top:8px' }, go, h('button', { class: 'btn', onclick: () => results.replaceChildren() }, 'Cancel')));
    refresh();
  }
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { stage([...input.files]); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); stage([...e.dataTransfer.files]); });
  const list = flights.length
    ? table(['Aircraft', 'Flight', 'Source', 'Start', 'Duration', 'Airborne', 'NM', 'T/O', 'Ldg', 'Patterns', ''],
      flights.map((r) => [r.aircraft, r.name, r.source, when(r.start_iso), dur(r.duration_s), dur(r.airborne_s), f(r.distance_nm, 1), r.takeoffs, r.landings, r.patterns,
        h('button', { class: 'btn danger', onclick: async (e) => {
          e.stopPropagation();
          if (confirm(`Delete ${r.name}?`)) { await api(`/api/flights/${r.id}`, { method: 'DELETE' }); render(); }
        } }, 'Delete')]),
      { onRow: (i) => go('detail', flights[i].id) })
    : h('p', { class: 'mute' }, 'No flights yet. Upload a KML tracklog to begin.');
  $view.replaceChildren(panel(null, drop, input, known, results), panel(`Flights (${flights.length})`, list));
}

// ---------- flight detail ----------
async function viewDetail(id) {
  const q = state.targetAgl ? `?target_agl_ft=${state.targetAgl}` : '';
  const a = await api(`/api/flights/${id}${q}`);
  const s = a.series, perf = a.performance, acc = a.accuracy;
  const els = [];
  els.push(h('div', { class: 'row', style: 'margin-bottom:12px' },
    h('button', { class: 'btn', onclick: () => go('flights') }, '← Flights'),
    h('h2', { style: 'margin:0' }, a.name), h('span', { class: 'tag' }, a.aircraft), h('span', { class: 'tag' }, a.source),
    h('span', { class: 'mute' }, `${when(a.start_iso)} · ${dur(a.duration_s)}`)));
  for (const w of a.warnings) els.push(h('div', { class: 'warn' }, w));
  els.push(h('div', { class: 'cards' },
    card(dur(perf.airborne_s), 'airborne'), card(`${f(perf.distance_nm, 1)} nm`, 'distance'), card(`${f(perf.max_alt_ft)} ft`, 'max GPS altitude'),
    card(a.wind ? `${f(a.wind.from_deg)}° / ${f(a.wind.speed_kt)} kt` : '–', a.wind ? `wind (${a.wind.confidence} confidence)` : 'wind (not estimable)'),
    card(perf.climb ? `${f(perf.climb.mean_rate_fpm)} fpm` : '–', 'mean climb rate'),
    card(perf.cruise ? `${f(perf.cruise.mean_speed_kt)} kt` : '–', 'level-flight speed'),
    card(`${a.takeoffs.length} / ${a.landings.length}`, 'take-offs / landings'), card(a.patterns.length, 'patterns')));

  // ground track
  const at = (t) => Math.min(Math.max(s.t.findIndex((v) => v >= t), 0), s.t.length - 1);
  const evs = [
    ...a.takeoffs.map((t) => ({ x: t.x, y: t.y, shape: 'up', color: 'var(--c-climb)', label: `${t.kind === 'takeoff' ? 'Take-off' : t.kind === 'touch_and_go' ? 'Touch-and-go lift-off' : 'Lift-off'} rwy ${t.runway}` })),
    ...a.landings.map((l) => ({ x: l.x, y: l.y, shape: 'down', color: 'var(--c-landing_roll)', label: `${l.kind === 'landing' ? 'Landing' : l.kind === 'touch_and_go' ? 'Touch-and-go' : 'Touchdown'} rwy ${l.runway}` })),
    ...a.go_arounds.map((g) => ({ x: s.x[at(g.t)], y: s.y[at(g.t)], shape: 'ga', color: 'var(--warn)', label: 'Go-around' }))];
  const mapBox = h('div', {});
  let colorBy = 'alt';
  const drawMap = () => mapBox.replaceChildren(
    trackMap({ x: s.x, y: s.y, alt: s.alt_ft, phase: s.phase, colorBy, events: evs, fields: a.fields }),
    colorBy === 'phase' ? legendFor(PHASES.map((p, i) => [p.replace('_', ' '), phaseColor(i)]))
      : h('div', { class: 'legend' }, 'colour: low altitude (blue) → high (amber)   ▲ lift-off   ▼ touchdown   ◆ go-around'));
  const sel = h('select', { 'aria-label': 'track colouring', onchange: (e) => { colorBy = e.target.value; drawMap(); } },
    h('option', { value: 'alt' }, 'Colour by altitude'), h('option', { value: 'phase' }, 'Colour by phase'));
  drawMap();
  els.push(panel('Ground track', h('div', { class: 'row' }, sel), mapBox));

  // profiles
  const T = s.t;
  const markers = [...a.takeoffs.map((t) => ({ t: t.t, color: 'var(--c-climb)', label: 'T/O' })), ...a.landings.map((l) => ({ t: l.t, color: 'var(--c-landing_roll)', label: 'TD' }))];
  const sp = a.speed_basis.startsWith('wind') ? 'est. airspeed' : 'ground speed';
  els.push(panel('Profiles',
    legendFor(PHASES.map((p, i) => [p.replace('_', ' '), phaseColor(i)])),
    h('h3', {}, 'Altitude (GPS, ft)'),
    lineChart({ t: T, phases: s.phase, markers, yLabel: 'ft', series: [{ y: s.alt_ft, color: 'var(--c-level)', label: 'MSL', unit: 'ft' }, { y: s.agl_ft, color: 'var(--c-takeoff_roll)', label: 'AGL', unit: 'ft' }] }),
    h('h3', {}, `Speed (kt) — ${a.speed_basis}`),
    lineChart({ t: T, phases: s.phase, markers, yLabel: 'kt', fixedLo: 0, series: [{ y: s.gs_kt, color: 'var(--mute)', label: 'ground speed', unit: 'kt' }, { y: s.as_kt, color: 'var(--c-climb)', label: sp, unit: 'kt' }] }),
    h('h3', {}, 'Vertical speed (fpm)'),
    lineChart({ t: T, phases: s.phase, markers, yLabel: 'fpm', series: [{ y: s.vs_fpm, color: 'var(--c-descent)', label: 'vertical speed', unit: 'fpm' }] }),
    h('h3', {}, 'Turn rate (°/s, + right)'),
    lineChart({ t: T, phases: s.phase, markers, yLabel: '°/s', height: 150, series: [{ y: s.turn_dps, color: 'var(--c-takeoff_roll)', label: 'turn rate', unit: '°/s', digits: 1 }] })));

  // events
  const tm = (iso) => new Date(iso).toLocaleTimeString();
  const STYLE = { standing: 'standing', rolling: 'rolling (soft-field style)', stop_and_go: 'stop-and-go', touch_and_go: 'touch-and-go', full_stop: 'full stop' };
  const lab = (x) => STYLE[x] || String(x || '').replace(/_/g, ' ');
  const place = (e) => `${e.airport_icao ? `${e.airport_icao} · ` : ''}rwy ${e.runway}`;
  const field = (e) => `${f(e.field_elev_ft)}${e.field_elev_source === 'airport-msl' ? ' (airport MSL)' : ' (GPS)'}`;
  const to = a.takeoffs.map((t) => [`${t.kind === 'partial' ? 'partial (log starts mid-roll)' : lab(t.style)} · ${place(t)}`, tm(t.t_iso), field(t), f(t.ground_roll_ft), f(t.dist50_ft), f(t.gs_lof_kt), f(t.headwind_kt), f(t.zero_wind_dist50_ft), `±${f(t.timing_uncertainty_ft)}`]);
  const ld = a.landings.map((l) => [`${l.type ? lab(l.type) : l.kind.replace(/_/g, ' ')} · ${place(l)}`, tm(l.t_iso), field(l), f(l.dist50_ft), f(l.roll_ft), f(l.gs_50_kt), f(l.tas_50_kt), f(l.gs_td_kt), f(l.sink_fpm), f(l.headwind_kt), `±${f(l.timing_uncertainty_ft)}`]);
  els.push(panel('Take-offs and landings',
    h('h3', {}, 'Take-offs'),
    to.length ? table(['Event', 'Time', 'Field ft', 'Ground roll ft', 'To 50 ft', 'Lift-off GS kt', 'Headwind kt', 'Zero-wind 50 ft', 'Timing ft'], to) : h('p', { class: 'mute' }, 'None detected.'),
    h('h3', {}, 'Landings'),
    ld.length ? table(['Event', 'Time', 'Field ft', 'From 50 ft', 'Roll ft', 'GS@50 kt', 'Airspd@50 kt', 'TD GS kt', 'Sink fpm', 'Headwind kt', 'Timing ft'], ld) : h('p', { class: 'mute' }, 'None detected.'),
    h('p', { class: 'mute' }, 'Distance from 50 ft to stop does not depend on touchdown timing. Ground roll does; the Timing column is the along-track uncertainty from GPS altitude noise (a few seconds). Rolling take-offs start the roll already moving, so their distances are not comparable to standing starts and are summarised separately. Statistics for full-stop landings exclude touch-and-gos.'),
    a.go_arounds.length ? h('p', {}, `Go-arounds detected: ${a.go_arounds.length}`) : null));

  // patterns
  if (a.patterns.length) {
    const plotBox = h('div', {});
    let which = null;
    const draw = () => plotBox.replaceChildren(patternPlot({ patterns: a.patterns, only: which }),
      legendFor([['upwind', 'var(--c-climb)'], ['crosswind', 'var(--c-takeoff_roll)'], ['downwind', 'var(--c-level)'], ['base', 'var(--c-descent)'], ['final', 'var(--c-landing_roll)']]));
    const psel = h('select', { 'aria-label': 'pattern', onchange: (e) => { which = e.target.value === '' ? null : +e.target.value; draw(); } },
      h('option', { value: '' }, 'All patterns overlaid'),
      a.patterns.map((p, i) => h('option', { value: i }, `Pattern ${i + 1} (${p.kind.replace(/_/g, ' ')}, rwy ${p.runway})`)));
    draw();
    const lg = (p, n, k, d = 0) => (p.legs[n] && p.legs[n][k] != null ? f(Math.abs(p.legs[n][k]), d) : '–');
    const target = h('input', { type: 'number', min: 200, max: 4000, step: 50, value: state.targetAgl || '', placeholder: 'default: median', style: 'width:130px' });
    els.push(panel('Traffic patterns',
      h('div', { class: 'row' }, psel, h('label', {}, 'Target pattern altitude AGL (ft): ', target),
        h('button', { class: 'btn', onclick: () => { state.targetAgl = target.value ? +target.value : null; render(); } }, 'Apply')),
      plotBox,
      table(['#', 'Side', 'Downwind AGL ft', 'Δ target ft', 'Offset ft', 'Offset σ ft', 'DW speed kt', 'Base AGL ft', 'Turn-to-final ft', 'Final nm', 'Glidepath °', 'Centre-line σ ft', 'Max bank °'],
        a.patterns.map((p, i) => [i + 1, p.straight_in ? 'straight-in' : p.side, lg(p, 'downwind', 'agl_ft'), f(p.agl_error_ft), lg(p, 'downwind', 'offset_ft'), lg(p, 'downwind', 'offset_std_ft'), lg(p, 'downwind', 'speed_kt'), lg(p, 'base', 'agl_ft'),
          p.final ? f(p.final.turn_to_final_ft) : '–', lg(p, 'final', 'length_nm', 2), p.final ? f(p.final.glidepath_deg, 1) : '–', p.final ? f(p.final.centerline_err_std_ft) : '–', f(p.max_bank_deg)]))));
  }

  // accuracy
  const rows = [];
  if (acc.altitude_hold) rows.push(['Altitude hold (level flight)', `σ ${f(acc.altitude_hold.rms_ft)} ft · max ${f(acc.altitude_hold.max_dev_ft)} ft · ${f(acc.altitude_hold.within_100ft_pct)} % within ±100 ft`, `${f(acc.altitude_hold.time_s / 60, 1)} min`]);
  for (const k of ['climb', 'level', 'descent']) {
    const v = acc.airspeed_hold[k];
    if (v) rows.push([`Airspeed hold — ${k}`, `σ ${f(v.std_kt, 1)} kt · ${f(v.within_5kt_pct)} % within ±5 kt`, `${f(v.time_s / 60, 1)} min`]);
  }
  if (acc.pattern_altitude) {
    const pa = acc.pattern_altitude;
    rows.push(['Pattern altitude', `median ${f(pa.median_ft)} ft AGL · target ${f(pa.target_ft)} ft${pa.target_is_default ? ' (median)' : ''} · σ ${f(pa.std_ft)} ft · mean |error| ${f(pa.mean_abs_error_ft)} ft`, `${pa.downwind_agl_ft.length} laps`]);
  }
  if (acc.downwind_offset) rows.push(['Downwind offset', `${f(acc.downwind_offset.mean_ft)} ft · σ ${f(acc.downwind_offset.std_ft)} ft`, '']);
  if (acc.final_approach) {
    const fa = acc.final_approach;
    rows.push(['Final approach', `glidepath ${f(fa.glidepath_deg, 1)}° (σ ${f(fa.glidepath_err_std_ft)} ft) · centre-line σ ${f(fa.centerline_err_std_ft)} ft`, '']);
    if (fa.approach_speed_mean_kt != null) rows.push(['Approach speed (500→50 ft)', `${f(fa.approach_speed_mean_kt)} kt · σ across landings ${f(fa.approach_speed_std_across_landings_kt, 1)} kt · σ within final ${f(fa.speed_std_within_final_kt, 1)} kt`, '']);
  }
  for (const r of acc.touchdown_repeatability || []) rows.push([`Touchdown point rwy ${r.runway}`, `σ ${f(r.std_ft)} ft · range ${f(r.range_ft)} ft`, `${r.n} landings`]);
  els.push(panel('Accuracy', h('p', { class: 'mute' }, `Altitude: ${acc.altitude_basis}. Speed: ${acc.speed_basis}.`), table(['Measure', 'Result', 'Sample'], rows)));

  // performance
  const prow = [];
  if (perf.climb) prow.push(['Climb', `${f(perf.climb.mean_rate_fpm)} fpm mean (max ${f(perf.climb.max_rate_fpm)}) at ${f(perf.climb.mean_speed_kt)} kt, gradient ${f(perf.climb.mean_gradient_ft_nm)} ft/nm`]);
  if (perf.best_rate_speed_kt) prow.push(['Best-rate climb speed (est.)', `${f(perf.best_rate_speed_kt)} kt → ${f(perf.best_rate_fpm)} fpm`]);
  if (perf.cruise) prow.push(['Level flight', `${f(perf.cruise.mean_speed_kt)} kt (GS ${f(perf.cruise.mean_gs_kt)}) at ${f(perf.cruise.mean_alt_ft)} ft`]);
  if (perf.descent) prow.push(['Descent', `${f(perf.descent.mean_rate_fpm)} fpm at ${f(perf.descent.mean_speed_kt)} kt, glide ratio ${f(perf.descent.glide_ratio, 1)}:1`]);
  prow.push(['Turns', `max ${f(perf.max_turn_rate_dps, 1)} °/s · 99.5th-percentile implied bank ${f(perf.max_bank_deg)}° (95th ${f(perf.p95_bank_deg)}°)`]);
  if (perf.landing) prow.push(['Landings (full stop)', `approach ${f(perf.landing.approach_speed_kt)} kt · touchdown GS ${f(perf.landing.touchdown_gs_kt)} kt · sink ${f(perf.landing.sink_fpm)} fpm`]);
  const q2 = a.quality;
  els.push(panel('Aircraft performance', table(['Phase', 'Result'], prow),
    h('p', { class: 'mute' }, `Data quality: ${q2.usable_samples} samples, ${q2.native_interval_s} s native interval, ${q2.gaps} gap(s), ${q2.rejected_samples} rejected spike(s).` +
      (a.recorded.speed_unit ? ` Recorded speed unit inferred as ${a.recorded.speed_unit} (RMS vs derived ${f(a.recorded.speed_rmse_kt, 1)} kt).` : '') +
      (a.recorded.gps_acc_horiz_median_m != null ? ` Reported GPS accuracy: horizontal median ${f(a.recorded.gps_acc_horiz_median_m, 0)} m (95th ${f(a.recorded.gps_acc_horiz_p95_m, 0)} m)${a.recorded.gps_acc_vert_median_m != null ? `, vertical median ${f(a.recorded.gps_acc_vert_median_m, 0)} m (95th ${f(a.recorded.gps_acc_vert_p95_m, 0)} m)` : ''}.` : ''))));
  els.push(await conditionsPanel(id));
  const l = llmPanel('debrief', id);
  if (l) els.push(l);
  $view.replaceChildren(...els);
}

// ---------- summary ----------
async function viewSummary() {
  const { aircraft: fleet } = await api('/api/aircraft');
  if (state.sumTail && !fleet.some((x) => x.tail === state.sumTail)) state.sumTail = null;
  const s = await api(`/api/summary${state.sumTail ? `?aircraft=${encodeURIComponent(state.sumTail)}` : ''}`);
  const pick = h('select', { 'aria-label': 'aircraft', onchange: (e) => { state.sumTail = e.target.value || null; render(); } },
    h('option', { value: '' }, 'All aircraft'), fleet.map((x) => h('option', { value: x.tail, selected: x.tail === state.sumTail ? '' : null }, `${x.tail} (${x.flights})`)));
  const els = [h('div', { class: 'row', style: 'margin-bottom:10px' }, h('h2', { style: 'margin:0' }, 'Summary'), pick)];
  if (!s.flights) {
    $view.replaceChildren(...els, panel(null, h('p', { class: 'mute' }, 'Upload flights to see aggregate performance.')));
    return;
  }
  const cnt = (o) => Object.entries(o).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ') || '–';
  els.push(h('div', { class: 'cards' }, card(s.flights, 'flights'), card(f(s.hours, 1), 'hours airborne'),
    card(cnt(s.counts.takeoff_style), 'take-off types'), card(cnt(s.counts.landing_type), 'landing types')));
  const statRow = (name, st, d = 0) => [name, st ? st.n : 0, st ? f(st.mean, d) : '–', st ? f(st.median, d) : '–', st && st.std != null ? f(st.std, d) : '–', st ? f(st.min, d) : '–', st ? f(st.max, d) : '–'];
  const HEAD = ['Measure', 'n', 'Mean', 'Median', 'σ', 'Min', 'Max'];
  for (const r of s.runways) {
    els.push(panel(`Runway ${r.runway} · airfield ${f(r.airfield.lat, 3)}, ${f(r.airfield.lon, 3)} · ${f(r.airfield.elev_ft)} ft`,
      h('h3', {}, 'Take-off (standing / stop-and-go)'),
      table(HEAD, [statRow('Ground roll (ft)', r.takeoff.ground_roll_ft), statRow('Distance to 50 ft (ft)', r.takeoff.dist50_ft), statRow('Zero-wind distance to 50 ft (ft)', r.takeoff.zero_wind_dist50_ft), statRow('Lift-off ground speed (kt)', r.takeoff.lift_off_gs_kt), statRow('Headwind (kt)', r.takeoff.headwind_kt)]),
      r.takeoff_rolling.dist50_ft ? [h('h3', {}, 'Rolling take-off (soft-field style)'), table(HEAD, [statRow('Entry speed at roll start (kt)', r.takeoff_rolling.entry_speed_kt), statRow('Ground roll from alignment (ft)', r.takeoff_rolling.ground_roll_ft), statRow('Distance to 50 ft (ft)', r.takeoff_rolling.dist50_ft), statRow('Lift-off ground speed (kt)', r.takeoff_rolling.lift_off_gs_kt)])] : null,
      h('h3', {}, 'Landing (full stop)'),
      table(HEAD, [statRow('Distance from 50 ft (ft)', r.landing.dist50_ft), statRow('Zero-wind distance from 50 ft (ft)', r.landing.zero_wind_dist50_ft), statRow('Ground roll (ft), timing-limited', r.landing.ground_roll_ft), statRow('Approach speed @50 ft (kt)', r.landing.approach_speed_kt), statRow('Touchdown GS (kt)', r.landing.touchdown_gs_kt), statRow('Sink rate (fpm)', r.landing.sink_fpm), statRow('Headwind (kt)', r.landing.headwind_kt)]),
      h('p', { class: 'mute' }, 'Zero-wind figures only appear for flights whose wind was estimated with high confidence (steady legs on several headings).')));
  }
  if (!s.runways.length) els.push(panel('Take-off and landing distances', h('p', { class: 'mute' }, 'No complete take-offs or full-stop landings detected.')));
  const p = s.performance;
  els.push(panel('Performance across flights', table(HEAD, [statRow('Climb rate (fpm)', p.climb_rate_fpm), statRow('Climb speed (kt)', p.climb_speed_kt), statRow('Level-flight speed (kt)', p.cruise_speed_kt), statRow('Descent rate (fpm)', p.descent_rate_fpm), statRow('Glide ratio', p.glide_ratio, 1), statRow('Max bank (°)', p.max_bank_deg)])));
  const a = s.accuracy;
  const trendBox = h('div', {});
  els.push(panel('Accuracy across flights',
    table(['Measure (per flight)', 'n', 'Mean', 'Median', 'σ', 'Min', 'Max'], [statRow('Altitude-hold RMS (ft)', a.altitude_rms_ft), statRow('Pattern altitude σ (ft)', a.pattern_alt_std_ft), statRow('Approach speed σ across landings (kt)', a.approach_speed_std_kt, 1), statRow('Centre-line error σ (ft)', a.centerline_ft), statRow('Glide-path error σ (ft)', a.glidepath_ft)]),
    s.trend.length > 1 ? [h('h3', {}, 'Trend (oldest → newest flight)'), trendBox] : null));
  if (s.trend.length > 1) {
    trendBox.append(
      lineChart({ t: s.trend.map((_, i) => i), yLabel: 'ft', height: 170, fixedLo: 0, series: [
        { y: s.trend.map((r) => r.altitude_rms_ft), color: 'var(--c-level)', label: 'altitude RMS', unit: 'ft' },
        { y: s.trend.map((r) => r.pattern_alt_std_ft), color: 'var(--c-takeoff_roll)', label: 'pattern altitude σ', unit: 'ft' },
        { y: s.trend.map((r) => r.centerline_ft), color: 'var(--c-descent)', label: 'centre-line σ', unit: 'ft' }] }),
      legendFor([['altitude RMS', 'var(--c-level)'], ['pattern altitude σ', 'var(--c-takeoff_roll)'], ['final centre-line σ', 'var(--c-descent)']]));
  }
  const l = llmPanel('ask');
  if (l) els.push(l);
  $view.replaceChildren(...els);
}

// ---------- boot ----------
(async () => {
  try { state.caps = await api('/api/capabilities'); } catch { state.caps = { llm: false }; }
  const m = location.hash.match(/^#\/(flight\/([0-9a-f-]+)|summary|performance)$/);
  if (m && m[2]) { state.view = 'detail'; state.flightId = m[2]; } else if (m) state.view = 'summary';
  setNav();
  render();
})();

// ---------- flight conditions (inputs a tracklog cannot supply) ----------
async function conditionsPanel(id) {
  const m = await api(`/api/flights/${id}/meta`);
  const inp = (key, label, attrs) => {
    const i = h('input', { type: 'number', step: 'any', value: m[key] ?? '', style: 'width:110px', 'aria-label': label, ...attrs });
    return [h('label', {}, label + ' ', i), i];
  };
  const tail = h('input', { type: 'text', value: m.aircraft || '', placeholder: 'N12345', size: 10, maxlength: 10, 'aria-label': 'aircraft tail number', style: 'text-transform:uppercase' });
  const [lOat, oat] = inp('oat_c', 'OAT °C'), [lAlt, alt] = inp('altimeter_inhg', 'Altimeter inHg'), [lWt, wt] = inp('weight_lb', 'Weight lb');
  const [lWd, wd] = inp('wind_from_deg', 'Wind from °'), [lWk, wk] = inp('wind_kt', 'Wind kt');
  const msg = h('span', { class: 'mute' });
  const num = (e) => (e.value === '' ? null : Number(e.value));
  const save = h('button', { class: 'btn primary', onclick: async () => {
    try {
      await api(`/api/flights/${id}/meta`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        aircraft: tail.value.trim().toUpperCase(), oat_c: num(oat), altimeter_inhg: num(alt), weight_lb: num(wt), wind_from_deg: num(wd), wind_kt: num(wk) }) });
      msg.className = 'ok'; msg.textContent = 'Saved. See the Performance tab.'; render();
    } catch (e) { msg.className = 'err'; msg.textContent = e.message; }
  } }, 'Save');
  return panel('Flight conditions',
    h('p', { class: 'mute' }, 'A tracklog has no aircraft, temperature, altimeter setting, weight or reported wind. Enter what you know; anything blank is assumed (ISA, pressure altitude = field elevation) and labelled so in the Performance tab. A reported wind (e.g. ATIS) is used to normalise distances to zero wind.'),
    h('div', { class: 'row' }, h('label', {}, 'Aircraft tail (required) ', tail), lOat, lAlt, lWt), h('div', { class: 'row', style: 'margin-top:8px' }, lWd, lWk, save, msg));
}

// ---------- POH-style performance ----------
const dash = '–';
const pct = (v) => (v == null ? dash : `${v > 0 ? '+' : ''}${f(v, 0)} %`);
const ROWSRC = { reported: 'reported', 'estimated-high': 'est.', 'estimated-low': 'est. (approx)' };

function pohTable(kind, sec, hasPoh) {
  const isTO = kind !== 'landing';
  const head = ['Date', 'Rwy', isTO ? 'Start' : 'Type', 'Weight lb', 'Press alt ft', 'OAT °C', 'Dens alt ft', 'Wind kt (HW)', isTO ? 'Lift-off GS kt' : 'Speed @50 ft kt',
    'Ground roll ft', isTO ? 'Total over 50 ft' : 'Total from 50 ft', 'Zero-wind roll ft', 'Zero-wind total ft'];
  if (hasPoh) head.push('POH roll ft', 'POH total ft', 'Δ roll', 'Δ total');
  const assumed = (v, flag, d = 0) => (flag ? `${f(v, d)}*` : f(v, d));
  const row = (r) => [new Date(r.t_iso).toLocaleDateString(), r.runway, r.style.replace(/_/g, ' '), r.weight_lb ? f(r.weight_lb) : dash, assumed(r.pa_ft, r.pa_assumed), assumed(r.oat_c, r.oat_assumed, 0), f(r.da_ft),
    r.headwind_kt == null ? dash : `${f(r.headwind_kt, 0)} (${ROWSRC[r.wind_source]})`, f(r.speed_kt), `${f(r.ground_roll_ft)} ±${f(r.uncertainty_ft)}`, f(r.total50_ft), f(r.zw_ground_roll_ft), f(r.zw_total50_ft),
    ...(hasPoh ? [f(r.poh_ground_roll_ft), f(r.poh_total50_ft), pct(r.delta_ground_roll_pct), pct(r.delta_total50_pct)] : [])];
  const mean = (m) => [`${m.label} (n=${m.n}, ${m.flights} flight${m.flights === 1 ? '' : 's'})`, '', '', m.weight_lb_n ? f(m.weight_lb) : dash, f(m.pa_ft), f(m.oat_c), f(m.da_ft), m.headwind_kt == null ? dash : f(m.headwind_kt, 0), f(m.speed_kt),
    `${f(m.ground_roll_ft)}${m.ground_roll_ft_std != null ? ` σ${f(m.ground_roll_ft_std)}` : ''}`, `${f(m.total50_ft)}${m.total50_ft_std != null ? ` σ${f(m.total50_ft_std)}` : ''}`, f(m.zw_ground_roll_ft), f(m.zw_total50_ft),
    ...(hasPoh ? [f(m.poh_ground_roll_ft), f(m.poh_total50_ft), pct(m.delta_ground_roll_pct), pct(m.delta_total50_pct)] : [])];
  const all = [...sec.rows.map(row), ...sec.by_runway.map(mean), mean(sec.mean)];
  const t = table(head, all);
  const trs = t.querySelectorAll('tbody tr');
  for (let i = sec.rows.length; i < trs.length; i++) trs[i].style.fontWeight = '650';
  return t;
}

function matrixView(mx, kind) {
  const head = [kind === 'landing' ? 'Press alt ft \\ OAT °C (ground roll / total from 50 ft)' : 'Press alt ft \\ OAT °C (ground roll / total over 50 ft)', ...mx.oat_axis.map((t) => `${t} °C`)];
  const rows = mx.pa_axis.map((p) => [f(p), ...mx.oat_axis.map((t) => {
    const c = mx.cells.find((x) => x.pa_ft === p && x.oat_c === t);
    if (!c && true) return dash;
    const poh = c.poh_total50_ft != null ? `  (POH ${f(c.poh_ground_roll_ft)} / ${f(c.poh_total50_ft)})` : '';
    return `${f(c.ground_roll_ft)} / ${f(c.total50_ft)}${c.zero_wind ? '' : ' †'} n=${c.n}${poh}`;
  })]);
  return [table(head, rows), h('p', { class: 'mute' }, 'Measured cells are means of the events nearest each pressure-altitude/OAT point. † = not wind-normalised (no reported or high-confidence wind).')];
}

async function pohEditor(tail) {
  const cur = await api(`/api/aircraft/${encodeURIComponent(tail)}/poh`);
  const toCsv = (rows) => rows.map((r) => [r.pa_ft, r.oat_c, r.ground_roll_ft ?? '', r.total50_ft ?? ''].join(',')).join('\n');
  const ta = (k, rows) => h('textarea', { 'aria-label': `${k} POH table`, placeholder: 'pa_ft,oat_c,ground_roll_ft,total50_ft\n0,15,780,1385\n2000,15,865,1545', style: 'min-height:110px;font-family:monospace' }, toCsv(rows));
  const to = ta('take-off', cur.takeoff), ld = ta('landing', cur.landing);
  const wt = h('input', { type: 'number', value: cur.weight_lb ?? '', style: 'width:110px', 'aria-label': 'POH weight' });
  const parse = (txt) => txt.split('\n').map((l) => l.trim()).filter((l) => l && !/^pa/i.test(l)).map((l) => {
    const [pa, oat, gr, tot] = l.split(',').map((x) => x.trim());
    return { pa_ft: Number(pa), oat_c: Number(oat), ground_roll_ft: gr === '' || gr == null ? null : Number(gr), total50_ft: tot === '' || tot == null ? null : Number(tot) };
  });
  const msg = h('span', { class: 'mute' });
  const save = h('button', { class: 'btn primary', onclick: async () => {
    try {
      await api(`/api/aircraft/${encodeURIComponent(tail)}/poh`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ takeoff: parse(to.value), landing: parse(ld.value), weight_lb: wt.value ? Number(wt.value) : null, notes: '' }) });
      render();
    } catch (e) { msg.className = 'err'; msg.textContent = e.message; }
  } }, 'Save reference');
  const d = h('details', {}, h('summary', {}, 'Documented (AFM/POH) reference table'),
    h('p', { class: 'mute' }, 'Paste the table values from your aircraft\'s POH, one row per pressure-altitude/OAT point: pa_ft,oat_c,ground_roll_ft,total50_ft. Values are interpolated, never extrapolated, and compared against zero-wind measured distances. No documented values are supplied by this app.'),
    h('div', { class: 'grid2' }, h('div', {}, h('h3', {}, 'Take-off'), to), h('div', {}, h('h3', {}, 'Landing'), ld)),
    h('div', { class: 'row' }, h('label', {}, 'POH weight lb ', wt), save, msg));
  return d;
}

async function viewPerformance() {
  const { aircraft } = await api('/api/aircraft');
  if (!aircraft.length) { $view.replaceChildren(panel('Performance', h('p', { class: 'mute' }, 'Upload flights first.'))); return; }
  if (!state.perfTail || !aircraft.some((a) => a.tail === state.perfTail)) state.perfTail = aircraft[0].tail;
  const sel = h('select', { 'aria-label': 'aircraft', onchange: (e) => { state.perfTail = e.target.value; render(); } },
    aircraft.map((a) => h('option', { value: a.tail, selected: a.tail === state.perfTail ? '' : null }, `${a.tail} (${a.flights} flight${a.flights === 1 ? '' : 's'})`)));
  const { aircraft: [ac] } = await api(`/api/performance?aircraft=${encodeURIComponent(state.perfTail)}`);
  const els = [h('div', { class: 'row', style: 'margin-bottom:12px' }, h('h2', { style: 'margin:0' }, 'Performance'), sel,
    h('span', { class: 'mute' }, 'derived from measured take-offs and landings, laid out like an AFM/POH table'))];
  els.push(h('div', { class: 'warn' }, 'Measured, not certified. * = assumed (ISA temperature, pressure altitude = field elevation). Take-off total is over a 50 ft obstacle; landing total is from 50 ft. Landing ground roll depends on GPS touchdown timing (± shown). Zero-wind columns need a reported wind (enter it on the flight) or a high-confidence estimate.'));
  const titles = { takeoff: 'Take-off distance (standing / stop-and-go starts)', takeoff_rolling: 'Take-off distance, rolling start (soft-field style)', landing: 'Landing distance (full stop / stop-and-go)' };
  for (const k of ['takeoff', 'takeoff_rolling', 'landing']) {
    const sec = ac.sections[k];
    if (!sec) continue;
    els.push(panel(titles[k], pohTable(k, sec, ac.has_poh), sec.matrix ? [h('h3', {}, 'POH layout: pressure altitude × OAT'), ...matrixView(sec.matrix, k)] : null));
  }
  if (!ac.sections.takeoff && !ac.sections.takeoff_rolling && !ac.sections.landing) els.push(panel(null, h('p', { class: 'mute' }, 'No complete take-offs or full-stop landings for this aircraft.')));
  els.push(panel(null, await pohEditor(state.perfTail)));
  $view.replaceChildren(...els);
}
