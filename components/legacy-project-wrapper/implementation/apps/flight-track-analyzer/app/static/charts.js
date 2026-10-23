// Dependency-free SVG charts. All text goes through textContent / setAttribute (no innerHTML).
const NS = 'http://www.w3.org/2000/svg';
export const PHASES = ['ground', 'takeoff_roll', 'climb', 'level', 'descent', 'landing_roll'];
export const phaseColor = (i) => `var(--c-${PHASES[i]})`;

export function svg(tag, attrs = {}, children = []) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) e.append(c);
  return e;
}
const txt = (x, y, s, attrs = {}) => { const t = svg('text', { x, y, ...attrs }); t.textContent = s; return t; };

export function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let tipEl;
function tip(text, ev) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.append(tipEl); }
  if (text == null) { tipEl.style.display = 'none'; return; }
  tipEl.style.display = 'block'; tipEl.textContent = text;
  tipEl.style.left = ev.clientX + 12 + 'px'; tipEl.style.top = ev.clientY + 12 + 'px';
}

/** Line chart over time. series: [{y:[..], color, label, unit}], phases: int[] (optional shading). */
export function lineChart({ t, series, phases, yLabel, markers = [], height = 190, fixedLo }) {
  const W = 900, H = height, L = 54, R = 10, T = 8, B = 22;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': yLabel });
  const ys = series.flatMap((s) => s.y).filter((v) => v != null && isFinite(v));
  let lo = fixedLo ?? Math.min(...ys), hi = Math.max(...ys);
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  const pad = (hi - lo) * 0.06 || 1; if (fixedLo == null) lo -= pad; hi += pad;
  const t0 = t[0], t1 = t[t.length - 1];
  const X = (v) => L + ((v - t0) / (t1 - t0 || 1)) * (W - L - R);
  const Y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  if (phases) {
    let s = 0;
    for (let i = 1; i <= t.length; i++) if (i === t.length || phases[i] !== phases[s]) {
      root.append(svg('rect', { x: X(t[s]), y: T, width: Math.max(X(t[i - 1]) - X(t[s]), 0.5), height: H - T - B, fill: phaseColor(phases[s]), opacity: 0.1 }));
      s = i;
    }
  }
  for (const v of niceTicks(lo, hi, 4)) {
    root.append(svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' }), txt(L - 6, Y(v) + 4, Math.abs(v) >= 1000 ? Math.round(v) : +v.toFixed(1), { 'text-anchor': 'end' }));
  }
  for (const v of niceTicks(t0, t1, 8)) root.append(txt(X(v), H - 6, mmss(v), { 'text-anchor': 'middle' }));
  root.append(svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'axis' }), svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'axis' }));
  root.append(txt(4, T + 10, yLabel));
  for (const s of series) {
    let d = '', pen = false;
    s.y.forEach((v, i) => { if (v == null || !isFinite(v)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(t[i]).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; });
    root.append(svg('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
  }
  for (const m of markers) {
    if (m.t < t0 || m.t > t1) continue;
    const g = svg('g'); g.append(svg('line', { x1: X(m.t), x2: X(m.t), y1: T, y2: H - B, stroke: m.color, 'stroke-dasharray': '3 3' }));
    const lab = txt(X(m.t) + 3, T + 22, m.label, { fill: m.color }); lab.style.fill = m.color; g.append(lab); root.append(g);
  }
  const cross = svg('line', { y1: T, y2: H - B, stroke: 'var(--mute)', opacity: 0 });
  root.append(cross);
  root.addEventListener('mousemove', (ev) => {
    const r = root.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    const tt = t0 + ((px - L) / (W - L - R)) * (t1 - t0);
    if (tt < t0 || tt > t1) { tip(null); cross.setAttribute('opacity', 0); return; }
    let i = 0; { let a = 0, b = t.length - 1; while (a < b) { const m = (a + b) >> 1; if (t[m] < tt) a = m + 1; else b = m; } i = a; }
    cross.setAttribute('x1', X(t[i])); cross.setAttribute('x2', X(t[i])); cross.setAttribute('opacity', 0.6);
    tip(`${mmss(t[i])}` + (phases ? `  ${PHASES[phases[i]]}` : '') + series.map((s) => `\n${s.label}: ${s.y[i] == null ? '–' : (+s.y[i]).toFixed(s.digits ?? 0)} ${s.unit || ''}`).join(''), ev);
  });
  root.addEventListener('mouseleave', () => { tip(null); cross.setAttribute('opacity', 0); });
  return root;
}

function altColor(f) { // 0..1 -> blue->green->amber
  const h = 220 - 190 * f; return `hsl(${h} 70% 48%)`;
}

/** Ground track in a local metric frame. colorBy: 'alt' | 'phase'. */
export function trackMap({ x, y, alt, phase, colorBy = 'alt', events = [], fields = [], size = 520 }) {
  const W = size, H = size * 0.8, P = 28;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'ground track' });
  const xs = x.filter(isFinite), ys = y.filter(isFinite);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sc = Math.min((W - 2 * P) / (x1 - x0 || 1), (H - 2 * P) / (y1 - y0 || 1));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const X = (v) => W / 2 + (v - cx) * sc, Y = (v) => H / 2 - (v - cy) * sc;
  const amin = Math.min(...alt), amax = Math.max(...alt);
  for (let i = 1; i < x.length; i++) {
    const col = colorBy === 'phase' ? phaseColor(phase[i]) : altColor((alt[i] - amin) / (amax - amin || 1));
    root.append(svg('line', { x1: X(x[i - 1]), y1: Y(y[i - 1]), x2: X(x[i]), y2: Y(y[i]), stroke: col, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  }
  for (const f of fields) root.append(svg('circle', { cx: X(f.x), cy: Y(f.y), r: 4, fill: 'none', stroke: 'var(--mute)' }));
  for (const e of events) {
    const px = X(e.x), py = Y(e.y);
    const up = e.shape === 'up', ga = e.shape === 'ga';
    const pts = ga ? `${px},${py - 6} ${px + 6},${py} ${px},${py + 6} ${px - 6},${py}` : up ? `${px},${py - 7} ${px + 6},${py + 5} ${px - 6},${py + 5}` : `${px},${py + 7} ${px + 6},${py - 5} ${px - 6},${py - 5}`;
    const p = svg('polygon', { points: pts, fill: e.color, stroke: 'var(--panel)', 'stroke-width': 1 });
    p.addEventListener('mousemove', (ev) => tip(e.label, ev)); p.addEventListener('mouseleave', () => tip(null));
    root.append(p);
  }
  // scale bar + north arrow
  const nice = niceTicks(0, (W / 4) / sc, 3).filter((v) => v > 0).pop() || 1;
  const label = nice >= 1852 ? `${(nice / 1852).toFixed(nice % 1852 ? 1 : 0)} nm` : `${Math.round(nice)} m`;
  root.append(svg('line', { x1: P, x2: P + nice * sc, y1: H - 10, y2: H - 10, stroke: 'var(--ink)', 'stroke-width': 2 }), txt(P, H - 14, label));
  root.append(svg('path', { d: `M${W - 18},${34} l0,-22 m0,0 l-4,7 m4,-7 l4,7`, stroke: 'var(--ink)', fill: 'none' }), txt(W - 22, 46, 'N'));
  return root;
}

/** Pattern overlay in runway frame (landing course to the right; right-of-course is down). */
export function patternPlot({ patterns, only = null, size = 640 }) {
  const W = size, H = size * 0.62, P = 30;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'traffic pattern in runway frame' });
  const sel = patterns.filter((p, i) => only == null || i === only);
  let us = [], vs = [];
  for (const p of sel) { us = us.concat(p.path.u_ft); vs = vs.concat(p.path.v_ft); }
  if (!us.length) return root;
  const u0 = Math.min(...us, -500), u1 = Math.max(...us, 500), v0 = Math.min(...vs, -500), v1 = Math.max(...vs, 500);
  const sc = Math.min((W - 2 * P) / (u1 - u0), (H - 2 * P) / (v1 - v0));
  const X = (u) => W / 2 + (u - (u0 + u1) / 2) * sc, Y = (v) => H / 2 + (v - (v0 + v1) / 2) * sc;
  root.append(svg('line', { x1: X(u0), x2: X(u1), y1: Y(0), y2: Y(0), class: 'grid' }));
  root.append(svg('circle', { cx: X(0), cy: Y(0), r: 4, fill: 'var(--c-landing_roll)' }), txt(X(0) + 6, Y(0) - 6, 'touchdown'));
  const legCol = { upwind: 'var(--c-climb)', crosswind: 'var(--c-takeoff_roll)', downwind: 'var(--c-level)', base: 'var(--c-descent)', final: 'var(--c-landing_roll)', '': 'var(--mute)' };
  sel.forEach((p) => {
    const q = p.path;
    for (let i = 1; i < q.u_ft.length; i++) {
      root.append(svg('line', { x1: X(q.u_ft[i - 1]), y1: Y(q.v_ft[i - 1]), x2: X(q.u_ft[i]), y2: Y(q.v_ft[i]), stroke: legCol[q.leg[i]] || legCol[''], 'stroke-width': only == null ? 1.4 : 2.2, opacity: only == null ? 0.7 : 1 }));
    }
  });
  const nm = 6076; const barNm = nm <= (u1 - u0) / 3 ? nm : 2000; 
  root.append(svg('line', { x1: P, x2: P + barNm * sc, y1: H - 10, y2: H - 10, stroke: 'var(--ink)', 'stroke-width': 2 }), txt(P, H - 14, barNm === nm ? '1 nm' : '2000 ft'));
  root.append(txt(W - P, 14, 'landing course →', { 'text-anchor': 'end' }));
  return root;
}

export const legendFor = (items) => {
  const d = document.createElement('div'); d.className = 'legend';
  for (const [name, col] of items) { const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = col; s.append(i, name); d.append(s); }
  return d;
};
