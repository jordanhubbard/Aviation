/**
 * MapView — SVG accident map with equirectangular projection.
 *
 * Renders accident markers on a world-outline SVG map with no external
 * map tile or Leaflet dependency.  Clicking a marker opens a detail sidebar.
 *
 * Features:
 *   - Equirectangular lat/lon → SVG pixel projection
 *   - Color-coded markers: fatal=red, serious=orange, minor=yellow, none=green
 *   - Severity legend
 *   - Zoom controls (+/−) via SVG viewBox manipulation
 *   - Click marker → detail sidebar (registration, date, location, injuries)
 *   - Hover tooltip (aircraft type + location)
 *   - Responsive (fills parent container)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { AccidentEvent } from '../types';

interface MapViewProps {
  accidents: AccidentEvent[];
  /** Called when the user clicks an accident marker */
  onSelectAccident?: (acc: AccidentEvent | null) => void;
  selectedId?: string;
  height?: number | string;
}

// ── Equirectangular projection ────────────────────────────────────────────────
// Maps (lon, lat) to (x, y) within an [0, W] × [0, H] viewport.
// Standard: lon ∈ [-180, 180], lat ∈ [90, -90] (y flipped)
const WORLD_ASPECT = 2; // width / height for equirectangular

function project(lon: number, lat: number, W: number, H: number): [number, number] {
  const x = ((lon + 180) / 360) * W;
  const y = ((90  - lat)  / 180) * H;
  return [x, y];
}

// ── Marker color by severity ──────────────────────────────────────────────────
function severityColor(acc: AccidentEvent): string {
  if ((acc.injuries?.fatal ?? 0) > 0)   return '#e53935'; // red
  if ((acc.injuries?.serious ?? 0) > 0) return '#fb8c00'; // orange
  if ((acc.injuries?.minor ?? 0) > 0)   return '#fdd835'; // yellow
  return '#43a047';                                         // green
}

// ── Simplified world coastline outline (equirectangular path data) ────────────
// A minimal polygon that gives the "world countries" silhouette as a base layer.
// Uses only major continent shapes (no island detail) for a clean at-a-glance view.
// Points: [lon, lat] pairs, "M lon lat L lon lat ... Z" format.
const WORLD_OUTLINE = `
M -180,90 L 180,90 L 180,-90 L -180,-90 Z
M -73,46 L -67,44 L -67,48 L -73,48 Z
M -124,49 L -67,49 L -67,25 L -97,25 L -97,15 L -87,15 L -87,9 L -79,9 L -77,7 L -77,3 L -60,3 L -60,-55 L -70,-55 L -70,-50 L -68,-48 L -68,-40 L -73,-40 L -80,-55 L -82,-55 L -82,-40 L -73,-35 L -73,-30 L -70,-28 L -70,-12 L -75,-5 L -73,10 L -66,10 L -63,10 L -60,12 L -60,20 L -87,22 L -87,25 L -124,25 Z
M 36,37 L 42,37 L 43,34 L 51,22 L 56,13 L 43,11 L 43,20 L 36,20 Z
M -18,28 L 51,28 L 51,-34 L 32,-34 L 32,-28 L 26,-20 L 22,-20 L 10,-8 L 10,5 L 8,5 L 5,4 L -2,5 L -16,14 L -18,28 Z
M 109,53 L 140,48 L 140,20 L 120,20 L 100,8 L 95,5 L 72,22 L 72,38 L 63,38 L 60,46 L 72,52 L 109,53 Z
M 114,-8 L 118,-8 L 118,-5 L 114,-5 Z
M 120,40 L 129,40 L 129,22 L 120,22 Z
M 14,71 L 30,71 L 30,55 L 22,55 L 14,58 Z
M -10,38 L 28,38 L 28,36 L 20,36 L 20,30 L 10,30 L 5,35 L -10,35 Z
M 113,22 L 120,22 L 120,18 L 110,18 L 110,20 Z
M 143,-12 L 153,-24 L 153,-38 L 138,-38 L 130,-18 L 133,-12 Z
M 165,-44 L 168,-44 L 168,-46 L 165,-46 Z
M -63,46 L -52,46 L -52,44 L -63,44 Z
`.trim();

// ── MapView component ─────────────────────────────────────────────────────────

export function MapView({ accidents, onSelectAccident, selectedId, height = 480 }: MapViewProps) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(800);
  const H = W / WORLD_ASPECT;

  // ViewBox for zoom/pan: [minX, minY, width, height]
  const [vb, setVb] = useState<[number, number, number, number]>([0, 0, W, H]);

  const [tooltip, setTooltip]       = useState<{ text: string; x: number; y: number } | null>(null);
  const [selected, setSelected]     = useState<AccidentEvent | null>(null);

  // Sync W with container width
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setW(e.contentRect.width || 800));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Keep viewBox in sync with W
  useEffect(() => {
    setVb(vb => {
      const scale = W / vb[2];
      return [vb[0] * scale, vb[1] * scale, W, W / WORLD_ASPECT];
    });
  }, [W]);

  const zoom = useCallback((factor: number) => {
    setVb(([x, y, w, h]) => {
      const nw = Math.min(W, Math.max(W * 0.1, w * factor));
      const nh = nw / WORLD_ASPECT;
      const cx = x + w / 2;
      const cy = y + h / 2;
      return [cx - nw / 2, cy - nh / 2, nw, nh];
    });
  }, [W]);

  const handleMarkerClick = (acc: AccidentEvent) => {
    setSelected(prev => prev?.id === acc.id ? null : acc);
    onSelectAccident?.(acc);
  };

  const currentH = W / WORLD_ASPECT;

  // Build SVG marker paths
  const markers = accidents
    .filter(a => a.latitude != null && a.longitude != null)
    .map(a => {
      const [px, py] = project(a.longitude!, a.latitude!, W, currentH);
      const color     = severityColor(a);
      const isSelected = selectedId === a.id || selected?.id === a.id;
      const r = isSelected ? 8 : 5;
      return (
        <circle
          key={a.id}
          cx={px} cy={py} r={r}
          fill={color}
          stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.4)'}
          strokeWidth={isSelected ? 2 : 0.8}
          style={{ cursor: 'pointer', transition: 'r 0.1s' }}
          onClick={() => handleMarkerClick(a)}
          onMouseEnter={(e) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (rect) {
              setTooltip({
                text: `${a.aircraft_type ?? 'Aircraft'} — ${a.location ?? 'Unknown'}`,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top - 12,
              });
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        />
      );
    });

  return (
    <div style={{ position: 'relative', width: '100%', height: typeof height === 'number' ? `${height}px` : height }}>
      {/* Map SVG */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}`}
        style={{ background: '#1a2a3a', display: 'block', userSelect: 'none' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean background */}
        <rect x={0} y={0} width={W} height={currentH} fill="#1a2a3a" />

        {/* Land outline (simplified) */}
        <path
          d={WORLD_OUTLINE.split('\n').join(' ')}
          fill="#2a3a2a"
          stroke="#3a5a3a"
          strokeWidth={0.5}
        />

        {/* Grid lines (every 30°) */}
        {[-60, -30, 0, 30, 60].map(lat => {
          const [, y] = project(0, lat, W, currentH);
          return <line key={`lat${lat}`} x1={0} y1={y} x2={W} y2={y} stroke="#1e3a50" strokeWidth={0.3} />;
        })}
        {[-120, -60, 0, 60, 120].map(lon => {
          const [x] = project(lon, 0, W, currentH);
          return <line key={`lon${lon}`} x1={x} y1={0} x2={x} y2={currentH} stroke="#1e3a50" strokeWidth={0.3} />;
        })}

        {/* Accident markers */}
        {markers}
      </svg>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {['+', '−'].map((label, i) => (
          <button key={label} onClick={() => zoom(i === 0 ? 0.7 : 1.4)} style={{
            width: 28, height: 28, background: 'rgba(30,50,70,0.9)',
            border: '1px solid #3a5a7a', color: '#8af', cursor: 'pointer',
            borderRadius: 4, fontSize: 16, lineHeight: '1', fontWeight: 'bold',
          }}>{label}</button>
        ))}
        <button onClick={() => setVb([0, 0, W, W / WORLD_ASPECT])} style={{
          width: 28, height: 28, background: 'rgba(30,50,70,0.9)',
          border: '1px solid #3a5a7a', color: '#8af', cursor: 'pointer',
          borderRadius: 4, fontSize: 10,
        }}>⊞</button>
      </div>

      {/* Severity legend */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(20,30,40,0.85)', border: '1px solid #3a5a7a',
        borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#9bb',
      }}>
        {[
          { color: '#e53935', label: 'Fatal' },
          { color: '#fb8c00', label: 'Serious' },
          { color: '#fdd835', label: 'Minor' },
          { color: '#43a047', label: 'No injury' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <svg width={10} height={10}>
              <circle cx={5} cy={5} r={4} fill={color} />
            </svg>
            {label}
          </div>
        ))}
        <div style={{ marginTop: 4, color: '#567' }}>{accidents.length} accidents</div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x + 8, top: tooltip.y - 4,
          background: 'rgba(20,30,40,0.95)', border: '1px solid #3a5a7a',
          borderRadius: 4, padding: '4px 8px', fontSize: 12, color: '#cde',
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
        }}>
          {tooltip.text}
        </div>
      )}

      {/* Detail sidebar */}
      {selected && (
        <div style={{
          position: 'absolute', top: 0, right: 40, bottom: 0,
          width: 260, background: 'rgba(15,25,35,0.97)', border: '1px solid #3a5a7a',
          borderRadius: '0 0 8px 8px', padding: 14, overflowY: 'auto',
          fontSize: 13, color: '#cde',
        }}>
          <button onClick={() => { setSelected(null); onSelectAccident?.(null); }} style={{
            position: 'absolute', top: 8, right: 8, background: 'none',
            border: 'none', color: '#8ab', cursor: 'pointer', fontSize: 16,
          }}>✕</button>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#fff', fontSize: 14 }}>
            {selected.aircraft_type ?? 'Unknown aircraft'}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            {[
              ['Registration', selected.registration ?? '—'],
              ['Date',        selected.date_z?.slice(0, 10) ?? '—'],
              ['Location',    selected.location ?? '—'],
              ['Country',     selected.country ?? '—'],
              ['Phase',       selected.phase_of_flight ?? '—'],
              ['Weather',     selected.weather_condition ?? '—'],
              ['Source',      selected.source ?? '—'],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ color: '#789', paddingRight: 8, paddingBottom: 4, whiteSpace: 'nowrap' }}>{k}</td>
                <td style={{ color: '#cde', paddingBottom: 4 }}>{v}</td>
              </tr>
            ))}
          </table>
          {selected.injuries && (
            <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(30,40,50,0.8)', borderRadius: 4 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#9bb' }}>Injuries</div>
              {[
                ['Fatal',     selected.injuries.fatal,     '#e53935'],
                ['Serious',   selected.injuries.serious,   '#fb8c00'],
                ['Minor',     selected.injuries.minor,     '#fdd835'],
                ['Uninjured', selected.injuries.uninjured, '#43a047'],
              ].map(([label, val, color]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: '#789' }}>{label}</span>
                  <span style={{ color: String(color), fontWeight: 600 }}>{val ?? 0}</span>
                </div>
              ))}
            </div>
          )}
          {selected.summary && (
            <div style={{ marginTop: 8, color: '#9bb', fontSize: 12, lineHeight: 1.5 }}>
              {selected.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MapView;
