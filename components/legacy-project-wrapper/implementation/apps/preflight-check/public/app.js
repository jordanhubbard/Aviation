import { calculateLoad } from './calculations.js';

const $ = id => document.getElementById(id);
const number = id => Number($(id).value);
const savedKey = 'aviation-preflight-profile-v1';
const riskKey = 'aviation-preflight-risk-v1';

function addStation(name = '', arm = '', weight = '') {
  const row = document.createElement('div');
  row.className = 'row station';
  row.innerHTML = '<label>Station <input class="station-name" maxlength="80" placeholder="Pilot / front seats"></label><label>Arm (in) <input class="station-arm" type="number" step="any"></label><label>Load (lb) <input class="station-weight" type="number" min="0" step="any"></label><button type="button">Remove</button>';
  row.querySelector('.station-name').value = name;
  row.querySelector('.station-arm').value = arm;
  row.querySelector('.station-weight').value = weight;
  row.querySelector('button').onclick = () => { row.remove(); syncLoads(); };
  row.querySelector('.station-name').oninput = syncLoads;
  $('stations').append(row);
  syncLoads();
}

function addEnvelope(weight = '', forward = '', aft = '') {
  const row = document.createElement('div');
  row.className = 'row envelope-row';
  row.innerHTML = '<label>Weight (lb) <input class="envelope-weight" type="number" step="any"></label><label>Forward CG (in) <input class="forward" type="number" step="any"></label><label>Aft CG (in) <input class="aft" type="number" step="any"></label><button type="button">Remove</button>';
  row.querySelector('.envelope-weight').value = weight;
  row.querySelector('.forward').value = forward;
  row.querySelector('.aft').value = aft;
  row.querySelector('button').onclick = () => row.remove();
  $('envelope').append(row);
}

function syncLoads() {
  const loads = $('loads');
  loads.replaceChildren();
  for (const row of document.querySelectorAll('.station')) {
    const label = document.createElement('p');
    label.textContent = `${row.querySelector('.station-name').value || 'Unnamed station'}: ${row.querySelector('.station-weight').value || '0'} lb`;
    loads.append(label);
  }
}

function profile() {
  const stationRows = [...document.querySelectorAll('.station')];
  const envelopeRows = [...document.querySelectorAll('.envelope-row')];
  const stations = stationRows.map(row => ({
    name: row.querySelector('.station-name').value.trim(),
    arm: Number(row.querySelector('.station-arm').value),
  }));
  const envelope = envelopeRows.map(row => ({
    weight: Number(row.querySelector('.envelope-weight').value),
    forward: Number(row.querySelector('.forward').value),
    aft: Number(row.querySelector('.aft').value),
  }));
  if (!$('registration').value.trim() || ['emptyWeight', 'emptyArm', 'maxGross', 'fuelArm', 'fuelDensity'].some(id => !$(id).value)
    || stations.length < 1 || stations.some(station => !station.name)
    || stationRows.some(row => !row.querySelector('.station-arm').value)
    || envelope.length < 2 || envelope.some(row => row.weight <= 0)
    || envelopeRows.some(row => !row.querySelector('.forward').value || !row.querySelector('.aft').value)) {
    throw new Error('Enter aircraft data, at least one named station with an arm, and two valid envelope rows.');
  }
  const ordered = [...envelope].sort((a, b) => a.weight - b.weight);
  if (ordered.some((row, index) => row.forward > row.aft || (index > 0 && row.weight <= ordered[index - 1].weight))) {
    throw new Error('Envelope weights must be distinct, and forward limits must not exceed aft limits.');
  }
  return { registration: $('registration').value.trim(), emptyWeight: number('emptyWeight'),
    emptyArm: number('emptyArm'), maxGross: number('maxGross'), fuelArm: number('fuelArm'),
    fuelDensity: number('fuelDensity'), stations, envelope };
}

function loading() {
  return { stationWeights: [...document.querySelectorAll('.station')].map(row => Number(row.querySelector('.station-weight').value)),
    fuelGallons: number('fuelGallons'), fuelBurnGallons: number('fuelBurnGallons') };
}

function resultTable(result) {
  const format = value => Number.isFinite(value) ? value.toFixed(2) : '—';
  const row = (name, condition) => `<tr><th>${name}</th><td>${format(condition.weight)}</td><td>${format(condition.cg)}</td><td>${condition.limits ? `${format(condition.limits.forward)}–${format(condition.limits.aft)}` : 'Outside entered range'}</td><td class="${condition.withinLimits ? 'good' : 'bad'}">${condition.withinLimits ? 'Within entered limits' : condition.problems.join('; ')}</td></tr>`;
  return `<table><thead><tr><th>Condition</th><th>Weight (lb)</th><th>CG (in)</th><th>CG limits (in)</th><th>Result</th></tr></thead><tbody>${row('Takeoff', result.takeoff)}${row('Landing', result.landing)}</tbody></table>`;
}

function calculate() {
  try {
    const result = calculateLoad(profile(), loading());
    $('results').innerHTML = resultTable(result);
  } catch (error) {
    $('results').replaceChildren(Object.assign(document.createElement('p'), { className: 'bad', textContent: error.message }));
  }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(savedKey) || 'null');
    if (saved) {
      for (const id of ['registration', 'emptyWeight', 'emptyArm', 'maxGross', 'fuelArm', 'fuelDensity']) $(id).value = saved[id] ?? '';
      $('stations').replaceChildren();
      $('envelope').replaceChildren();
      for (const station of saved.stations || []) addStation(station.name, station.arm, 0);
      for (const row of saved.envelope || []) addEnvelope(row.weight, row.forward, row.aft);
    }
  } catch { localStorage.removeItem(savedKey); }
  if (!$('stations').children.length) addStation();
  if (!$('envelope').children.length) { addEnvelope(); addEnvelope(); }
  try {
    const saved = JSON.parse(localStorage.getItem(riskKey) || 'null');
    if (saved) {
      document.querySelectorAll('.risk').forEach(box => { box.checked = Boolean(saved[box.dataset.risk]); });
      $('riskNotes').value = saved.notes || '';
    }
  } catch { localStorage.removeItem(riskKey); }
  updateRisk();
}

function updateRisk() {
  const state = Object.fromEntries([...document.querySelectorAll('.risk')].map(box => [box.dataset.risk, box.checked]));
  state.notes = $('riskNotes').value;
  localStorage.setItem(riskKey, JSON.stringify(state));
  const checked = [...document.querySelectorAll('.risk')].filter(box => box.checked).length;
  $('riskStatus').textContent = `${checked} of 4 review areas checked. This is a planning record, not an automated go/no-go decision.`;
}

$('addStation').onclick = () => addStation();
$('addEnvelope').onclick = () => addEnvelope();
$('calculate').onclick = calculate;
$('saveProfile').onclick = () => {
  try { const current = profile(); calculateLoad(current, { stationWeights: current.stations.map(() => 0), fuelGallons: 0, fuelBurnGallons: 0 }); localStorage.setItem(savedKey, JSON.stringify(current));
    $('results').textContent = 'Aircraft profile saved in this browser. Flight loads are not saved.';
  } catch (error) { $('results').textContent = error.message; }
};
$('clearProfile').onclick = () => { localStorage.removeItem(savedKey); location.reload(); };
document.querySelectorAll('.risk').forEach(box => { box.onchange = updateRisk; });
$('riskNotes').oninput = updateRisk;
restore();
