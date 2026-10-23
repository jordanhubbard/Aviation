// In-app help: how the analysis works and how your data is used. Static text, built with DOM calls (no innerHTML).
// Thresholds quoted here mirror app/flightlab/*.py; update both together.

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (v != null) e.setAttribute(k, v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const p = (...k) => el('p', {}, ...k);
const ul = (...items) => el('ul', {}, items.map((i) => el('li', {}, i)));
const code = (s) => el('code', {}, s);
const b = (s) => el('strong', {}, s);

function sections(caps) {
  const S = [];
  const add = (id, title, ...body) => S.push({ id, title, body });

  add('overview', 'What this app does',
    p('You upload GPS tracklogs (KML) from ForeFlight or Garmin. The server turns each log into a cleaned, evenly sampled track and derives: take-off and landing distances, the type of each take-off and landing, wind, traffic-pattern shape, how accurately altitude and airspeed were held, aircraft climb / cruise / descent performance, and AFM/POH-style performance tables.'),
    p('Everything is computed from the position, time and altitude in the file. A tracklog does not contain temperature, aircraft weight, altimeter setting or true airspeed, so wherever those matter the app either asks you for them (the ', b('Flight conditions'), ' panel) or tells you what it assumed.'));

  add('data', 'Your data: what is read, stored and shared',
    ul(
      [b('Read: '), 'the time-stamped positions and altitudes (', code('gx:Track'), ', time-stamped points, or a line with a time span). If the file has per-sample arrays such as ', code('speed_kts'), ' and ', code('course'), ', they are read and used only to cross-check the speed and course the app derives itself. Bank and pitch arrays are not used (ForeFlight logs often leave them empty); bank angles shown are inferred from turn rate. Reported GPS accuracy arrays are summarised as a data-quality figure.'],
      [b('Stored: '), 'the uploaded KML file and the resulting analysis are saved on the server (a SQLite database plus the raw file) so you can come back to them. Identical files are stored once. There are no accounts and no login: anyone who can open this site can see and delete flights. Use the Delete button on the Flights list to remove a flight and its raw file.'],
      [b('Aircraft tail number: '), 'required for every file you upload. Every stored record is keyed by the tail number (aircraft, flights, conditions, take-off / landing events, patterns, documented reference tables), so flights can be grouped, compared and averaged per aircraft. Uploading the same file again with a different tail moves the flight to that aircraft.'],
      [b('Conditions you type: '), 'OAT, altimeter, weight and reported wind are stored with the flight and used by the Performance tab.'],
      [b('Shared: '), 'nothing is sent to any third party by the analysis. Charts are drawn in your browser with no external map tiles or scripts.'],
      [b('Cleaning: '), 'files are parsed with a hardened XML reader (entity expansion and external entities are refused) and are size-limited. A bad file is reported on its own without affecting others uploaded at the same time.']));

  add('conditioning', 'Cleaning the track',
    ul(
      'Samples are sorted by time and duplicates removed.',
      'Altitudes that are clearly placeholders (below −1,000 m or above 30,000 m, such as the −100,000 m "no fix" value some apps write on the first fixes) are removed, with a warning.',
      'Spikes in position or altitude are found with a Hampel filter (7-sample median, 6 × robust deviation, with floors of 100 m for position and 60 m for altitude) and dropped.',
      'The track is resampled to 1 sample per second. Gaps longer than 15 s are flagged and excluded from statistics rather than bridged.',
      'Position and altitude are smoothed with a Savitzky–Golay filter (quadratic, 9 samples for position, 11 for altitude at 1 Hz). The same filter gives the derivatives: ground speed, course, turn rate, vertical speed and along-track acceleration.',
      'If the file records speed, its unit is inferred by comparing to the speed derived from positions (knots, m/s, mph or km/h). The data-quality line on each flight shows how closely the two agree.'));

  add('ground', 'Height above the airfield',
    p('A stretch of 10 seconds or more below about 8 kt gives a GPS ground-altitude reference. Stops within 2 km are merged. Aviation’s bundled airport data can identify a nearby airport and provide its published field elevation in feet MSL. An observed ground block calibrates the GPS altitude offset before that airport elevation can extend the reference to another field where the log has no stop.'),
    p('A nearby published elevation alone does not establish touchdown. The descent, vertical-speed transition, and rollout still matter. GPS geometric altitude can differ from published field elevation and from the runway surface; an unavailable or distant airport falls back to track-only analysis.'));

  add('events', 'Detecting take-offs and landings',
    ul(
      [b('Airborne: '), 'a flight becomes airborne when AGL exceeds about 30 ft with ground speed above about 39 kt, and returns to the ground when AGL falls below about 13 ft while vertical speed is small.'],
      [b('Lift-off: '), 'a straight line is fitted to the first part of the climb (between about 10 and 100 ft AGL) and extended back to zero height; that crossing is the lift-off time. Height here is measured against the runway altitude seen during the take-off roll, which cancels slow GPS altitude drift.'],
      [b('Start of roll: '), 'found by walking back from lift-off to the onset of sustained acceleration (above about 0.3 m/s²) while still on the runway heading; the high-speed part of the roll is always included.'],
      [b('50 ft: '), 'the first (take-off) or last (landing) time AGL crosses 50 ft. Distances are path length along the smoothed track between events.'],
      [b('Touchdown: '), 'AGL is re-referenced to the altitude seen during the roll-out, and touchdown is the first time it falls below about 2.5 ft. If there is no usable roll-out, the point where the descent ends is used instead.'],
      [b('End of landing roll: '), 'when ground speed falls below 15 kt.']),
    p(b('How accurate is it? '), 'Position is good to a few metres, but GPS altitude is only good to a few metres and drifts. A few metres of height is several seconds in a flare, which is hundreds of feet along the runway at landing speed. So:'),
    ul('Distance to or from 50 ft is the most dependable figure, because it does not depend on the exact touchdown instant.',
      'Take-off ground roll is reasonably dependable.',
      'Landing ground roll and touchdown speed depend on touchdown timing. Each event shows a timing uncertainty in feet (about 1.5 s of ground speed for lift-off, 4 s for touchdown). On fast aircraft, or when reported GPS vertical accuracy is poor, treat these as rough.'));

  add('types', 'Take-off and landing types',
    ul([b('Standing take-off: '), 'the roll begins from near rest (under about 8 kt) on the runway.'],
      [b('Rolling take-off (soft-field style): '), 'the aircraft is already moving at taxi speed when the roll begins, with no stop on the runway.'],
      [b('Stop-and-go: '), 'a landing that slows to taxi speed and takes off again from the same runway within 4 minutes.'],
      [b('Touch-and-go: '), 'a touchdown followed by lift-off within 2 minutes without slowing below about 23 kt.'],
      [b('Full-stop landing: '), 'ground speed falls below 15 kt and the aircraft does not take off again soon.'],
      [b('Go-around: '), 'a descent to under about 115 ft AGL that climbs away again without touching down.'],
      [b('Partial: '), 'a take-off whose roll begins before the log starts; it is shown but not used in averages.']),
    p('Rolling take-offs are summarised separately because their distances are not comparable with standing starts.'));

  add('wind', 'Wind and airspeed',
    p('A GPS log gives ground speed, not airspeed. The app estimates wind by fitting a circle to the ground-velocity vectors: with constant airspeed, those vectors lie on a circle whose radius is true airspeed and whose centre is the wind. The fit uses a robust least-squares solver (SciPy) with speeds up to jet range.'),
    ul([b('High confidence: '), 'at least three steady, straight, level legs of 60 s or more on at least three headings 40° or more apart (typical of cross-country flying), with a good fit.'],
      [b('Low confidence: '), 'a fit over all airborne samples with good heading coverage. In traffic-pattern flying airspeed differs between legs, which pulls the centre toward the faster legs, so direction and speed can be off by many knots. Airspeed values are then indicative; deviations within a leg are still reliable.'],
      [b('No estimate: '), 'straight cruise or too little heading variety (for example a long airline-style leg). Speeds are then ground speeds.']),
    p('Estimated airspeed is the length of (ground velocity − wind). You can instead enter a ', b('reported wind'), ' (for example from ATIS) in Flight conditions; it is used in place of the estimate for headwind and zero-wind distances.'),
    p(b('Zero-wind distance: '), 'a first-order correction D₀ = D × ((GS + HW) / GS)², where GS is ground speed at lift-off (or at 50 ft / touchdown for landings) and HW is the headwind component. It is produced only with a reported wind or a high-confidence estimate, and not for rolling take-offs.'));

  add('patterns', 'Traffic patterns',
    p('For each landing the track is placed in a runway frame: origin at touchdown, one axis along the landing course. The app looks back from touchdown (to the previous lift-off, or up to 15 minutes) and labels legs by track relative to the runway: upwind and final (within about 25–35° of the runway heading), crosswind and base (about 90° off), downwind (more than 150° off). Left or right is taken from which side of the runway the downwind leg lies.'),
    ul('Downwind: offset from the runway, its steadiness, altitude AGL, speed.',
      'Base and final: lengths, turn-to-final distance, altitude at the start of final.',
      'Final approach: glide-path angle from a straight-line fit between about 65 and 1,000 ft AGL, glide-path scatter, centre-line scatter, and speed from 500 to 50 ft.',
      'Bank is the coordinated-turn bank implied by ground speed and turn rate, not a measured bank.'),
    p('A landing with no recognisable downwind leg is labelled straight-in. The pattern altitude target defaults to the median downwind altitude of the flight; you can enter your own.'));

  add('accuracy', 'Accuracy metrics',
    ul([b('Altitude hold: '), 'in level segments (vertical speed under about 400 fpm, at least 60 s, above 100 ft AGL): scatter about the segment median, worst deviation, and the share of time within ±100 ft. This is GPS altitude, so GPS error is included.'],
      [b('Airspeed hold: '), 'scatter and share within ±5 kt in climb, level and descent segments, using the airspeed estimate or ground speed, whichever the flight allows.'],
      [b('Pattern altitude: '), 'downwind altitude per lap versus the target.'],
      [b('Approach consistency: '), 'mean approach speed and its spread across landings, glide-path and centre-line error.'],
      [b('Touchdown repeatability: '), 'spread of touchdown points along the runway for the same runway.']));

  add('performance', 'Aircraft performance',
    ul('Climb, descent and level segments are runs of at least 30 s (level: 90 s) above about 300 / −300 / ±200 fpm. Reported are mean rates, speed, gradient and glide ratio.',
      'Best-rate climb speed is estimated only when climbs cover at least an 8 kt spread of airspeeds; otherwise it is not shown.',
      'Maximum turn rate and the implied bank angle are shown (99.5th percentile, to ignore noise).',
      'Wind-corrected speeds follow the confidence rules above.'));

  add('poh', 'POH-style performance tables',
    p('The Performance tab lays out measured take-off and landing distances the way an AFM/POH does: weight, pressure altitude, OAT, wind, ground roll, and total over (or from) a 50 ft obstacle, one row per event plus mean rows for the aircraft and for each runway, and a pressure-altitude × OAT matrix.'),
    ul([b('Pressure altitude: '), 'field elevation plus (29.92 − altimeter setting) × 1,000 ft. With no altimeter entered, pressure altitude is taken equal to the field elevation (marked *).'],
      [b('OAT: '), 'what you enter, otherwise standard (ISA) temperature for that pressure altitude (marked *). Density altitude = pressure altitude + 120 × (OAT − ISA).'],
      [b('Aircraft: '), 'the tail number you gave when uploading. Flights with the same tail are pooled for means; Summary and Performance can be viewed per aircraft.'],
      [b('Documented reference: '), 'paste the table from your own POH (pressure altitude, OAT, ground roll, total). The app interpolates it to each event\'s conditions and never extrapolates outside the table. Differences are measured zero-wind distance versus documented distance. If no wind is known, it falls back to the measured value only when the headwind is about 3 kt or less. The app ships with no documented values.']),
    p('These are measured results, not certified data. Weight, technique, runway surface and slope, and temperature all affect them and are not in the log.'));

  add('limits', 'Known limitations',
    ul('GPS altitude noise limits touchdown and lift-off timing; fast aircraft are affected most.',
      'Pattern-only flights give an approximate wind; straight cruise gives none.',
      'Airport matches use the bundled database within 5 km and valid MSL elevation. Runway numbers are still inferred from track heading (for example 27); no runway database is used.',
      'Logs that start or end airborne, or that have long gaps, lose the affected events.',
      'Helicopters, gliders and very slow aircraft are not specifically handled.',
      'The thresholds above were tuned on synthetic flights and a small number of real logs; unusual aircraft or procedures may be misclassified. The Warnings shown on each flight say when the data did not support a conclusion.'));

  if (caps && caps.llm) {
    add('ai', 'AI debrief and questions',
      p('An AI model is configured on this server. When you ask for a debrief or ask a question, a compact digest of numbers (distances, speeds, pattern and accuracy figures, warnings) is sent to the model. Your raw track points, coordinates and timestamps are never sent. The model is told to use only the numbers it is given; what it writes is generated text, not measurement, and can be wrong.'));
  }
  return S;
}

export function openHelp(caps) {
  const secs = sections(caps);
  const toc = el('nav', { class: 'help-toc', 'aria-label': 'Help contents' }, secs.map((s) => {
    const a = el('a', { href: `#help-${s.id}` }, s.title);
    a.addEventListener('click', (ev) => { ev.preventDefault(); body.querySelector(`#help-${s.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    return a;
  }));
  const body = el('div', { class: 'help-body', tabindex: '0' },
    secs.map((s) => el('section', { id: `help-${s.id}` }, el('h3', {}, s.title), s.body)));
  const close = el('button', { class: 'btn', 'aria-label': 'Close help' }, 'Close');
  const dlg = el('dialog', { class: 'help', 'aria-label': 'Help' },
    el('div', { class: 'help-head' }, el('h2', {}, 'How it works'), close),
    el('div', { class: 'help-main' }, toc, body));
  const done = () => { dlg.close ? dlg.close() : dlg.removeAttribute('open'); dlg.remove(); };
  close.addEventListener('click', done);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) done(); });      // click on the backdrop
  document.body.append(dlg);
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  body.focus();
  return dlg;
}
