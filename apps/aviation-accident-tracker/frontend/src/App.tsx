import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
// import MarkerClusterGroup from 'react-leaflet-cluster'; // Package doesn't exist, clustering temporarily disabled
import debounce from 'lodash.debounce';
import { Badge } from './components/Badge';
import { reportFrontendErrorToBeads } from './utils/beadsReporting';
// import { normalizeMarkers, defaultClusterOptions } from '@aviation/ui-framework';

type EventRecord = {
  id: string;
  dateZ: string;
  registration: string;
  aircraftType?: string;
  operator?: string;
  category: string;
  airportIcao?: string;
  airportIata?: string;
  country?: string;
  region?: string;
  lat?: number;
  lon?: number;
  fatalities?: number;
  injuries?: number;
  summary?: string;
  narrative?: string;
  status?: string;
  sources: { sourceName: string; url: string; fetchedAt?: string }[];
};

type CountryCentroid = {
  country: string;
  lat: number;
  lon: number;
};

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function formatDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (event) => {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function App() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'general' | 'commercial'>('all');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // For detail modal
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  // AI Explainer
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  const handleExplain = async (event: EventRecord) => {
    setExplainLoading(true);
    setExplainText(null);
    setExplainError(null);
    try {
      const context = [
        `Aircraft: ${event.aircraftType || 'unknown'}`,
        `Registration: ${event.registration}`,
        `Operator: ${event.operator || 'unknown'}`,
        `Date: ${event.dateZ}`,
        `Category: ${event.category}`,
        `Country: ${event.country || 'unknown'}`,
        `Fatalities: ${event.fatalities ?? 'unknown'}`,
        `Injuries: ${event.injuries ?? 'unknown'}`,
        `Summary: ${event.summary || 'n/a'}`,
        `Narrative: ${event.narrative || 'n/a'}`,
      ].join('\n');
      const question = 'Why did this aviation accident occur and what factors contributed to it?';
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExplainError(data.error || `Error ${res.status}`);
      } else {
        setExplainText(data.explanation);
      }
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Failed to get explanation');
    } finally {
      setExplainLoading(false);
    }
  };
  const [airportQuery, setAirportQuery] = useState('');
  const [airportOptions, setAirportOptions] = useState<{ label: string; code: string }[]>([]);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rangePreset, setRangePreset] = useState('');
  const [options, setOptions] = useState<{ countries: string[]; regions: string[] }>({ countries: [], regions: [] });
  const today = formatInputDate(new Date());

  const fetchAirports = useMemo(
    () =>
      debounce((q: string) => {
        if (!q.trim()) return setAirportOptions([]);
        fetch(`/api/airports?search=${encodeURIComponent(q)}`)
          .then((r) => r.json())
          .then((data) => {
            setAirportOptions(
              (data || []).map((a: any) => ({
                label: `${a.icao}${a.iata ? ` / ${a.iata}` : ''} — ${a.name}`,
                code: a.icao,
              }))
            );
          })
          .catch((err) => {
            void reportFrontendErrorToBeads(err, {
              kind: 'fetch',
              extra: { endpoint: '/api/airports', query: q },
            });
            setAirportOptions([]);
          });
      }, 300),
    []
  );

  const clampToToday = (value: string) => (value && value > today ? today : value);

  const applyPresetRange = (value: string) => {
    setRangePreset(value);
    if (!value) return;
    const days = Number(value);
    if (!Number.isFinite(days) || days <= 0) return;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    setFrom(formatInputDate(start));
    setTo(formatInputDate(end));
    setSelected(null);
    setPage(0);
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (category !== 'all') params.set('category', category);
    if (airportQuery.trim()) params.set('airport', airportQuery.trim());
    if (country) params.set('country', country);
    if (region) params.set('region', region);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    fetch(`/api/events?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.data ?? data?.data ?? data);
        setLoading(false);
      })
      .catch((err) => {
        void reportFrontendErrorToBeads(err, {
          kind: 'fetch',
          extra: { endpoint: '/api/events', query: params.toString() },
        });
        setError(String(err));
        setLoading(false);
      });
  }, [search, category, page, airportQuery, country, region, from, to]);

  useEffect(() => {
    fetch('/api/filters/options')
      .then((r) => r.json())
      .then((data) => setOptions(data))
      .catch((err) => {
        void reportFrontendErrorToBeads(err, { kind: 'fetch', extra: { endpoint: '/api/filters/options' } });
        setOptions({ countries: [], regions: [] });
      });
  }, []);

  useEffect(() => {
    if (!selected) {
      setSelectedLoading(false);
      setSelectedError(null);
      return;
    }

    // List payload intentionally omits sources for performance; hydrate from detail endpoint.
    if (selected.sources && selected.sources.length > 0) {
      setSelectedLoading(false);
      return;
    }

    const controller = new AbortController();
    setSelectedLoading(true);
    setSelectedError(null);

    fetch(`/api/events/${encodeURIComponent(selected.id)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Failed to load event detail (HTTP ${r.status})`);
        }
        return r.json();
      })
      .then((detail: EventRecord) => {
        setEvents((prev) => prev.map((e) => (e.id === detail.id ? { ...e, ...detail } : e)));
        setSelected((prev) => (prev && prev.id === detail.id ? { ...prev, ...detail } : prev));
        setSelectedLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        void reportFrontendErrorToBeads(err, {
          kind: 'fetch',
          extra: { endpoint: `/api/events/${selected.id}` },
        });
        setSelectedError(String(err));
        setSelectedLoading(false);
      });

    return () => controller.abort();
  }, [selected?.id]);

  const positioned = useMemo(() => events.filter((e) => typeof e.lat === 'number' && typeof e.lon === 'number'), [events]);
  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const markers = useMemo(
    () =>
      positioned.map((e) => ({
        id: e.id,
        position: [e.lat!, e.lon!] as [number, number],
        payload: {
          title: e.registration || e.aircraftType || e.summary,
          subtitle: e.summary,
          category: e.category,
          onClickId: e.id,
        }
      })),
    [positioned]
  );
  const countryCentroids = useMemo(() => {
    const totals = new Map<string, { lat: number; lon: number; count: number }>();
    events.forEach((event) => {
      if (typeof event.lat !== 'number' || typeof event.lon !== 'number' || !event.country) return;
      const current = totals.get(event.country) ?? { lat: 0, lon: 0, count: 0 };
      totals.set(event.country, {
        lat: current.lat + event.lat,
        lon: current.lon + event.lon,
        count: current.count + 1,
      });
    });
    return Array.from(totals.entries()).map(([countryCode, totalsForCountry]) => ({
      country: countryCode,
      lat: totalsForCountry.lat / totalsForCountry.count,
      lon: totalsForCountry.lon / totalsForCountry.count,
    }));
  }, [events]);

  const handleMapClick = (lat: number, lon: number) => {
    if (!countryCentroids.length) return;
    let nearest: CountryCentroid | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const entry of countryCentroids) {
      const candidateDistance = distanceKm(lat, lon, entry.lat, entry.lon);
      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearest = entry;
      }
    }
    if (!nearest) return;
    setCountry(nearest.country);
    setSelected(null);
    setPage(0);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }}>
      <div style={{ gridColumn: '1 / span 2' }}>
        <h1>Aviation Accident Tracker</h1>
        {loading && <p>Loading events…</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {!loading && events.length === 0 && <p>No events yet. Run backend seed or ingestion.</p>}
      </div>

      <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Search:{' '}
          <input
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            placeholder="registration/operator/summary"
            style={{ minWidth: 240 }}
          />
        </label>
        <label>
          Category:{' '}
          <select
            value={category}
            onChange={(e) => {
              setPage(0);
              setCategory(e.target.value as any);
            }}
          >
            <option value="all">All</option>
            <option value="general">General</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label>
          Country:{' '}
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {options.countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region:{' '}
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {options.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Range:{' '}
          <select
            value={rangePreset}
            onChange={(e) => {
              applyPresetRange(e.target.value);
            }}
          >
            <option value="">Custom</option>
            <option value="1">Last day</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
          </select>
        </label>
        <label>
          From:{' '}
          <input
            type="date"
            value={from}
            max={today}
            onChange={(e) => {
              setFrom(clampToToday(e.target.value));
              setRangePreset('');
              setSelected(null);
              setPage(0);
            }}
          />
        </label>
        <label>
          To:{' '}
          <input
            type="date"
            value={to}
            max={today}
            onChange={(e) => {
              setTo(clampToToday(e.target.value));
              setRangePreset('');
              setSelected(null);
              setPage(0);
            }}
          />
        </label>
        <label>
          Airport:{' '}
          <input
            value={airportQuery}
            onChange={(e) => {
              const q = e.target.value;
              setAirportQuery(q);
              fetchAirports(q);
              setPage(0);
            }}
            placeholder="ICAO/IATA or name"
            style={{ minWidth: 200 }}
            list="airport-options"
          />
          <datalist id="airport-options">
            {airportOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </datalist>
        </label>
        <button
          onClick={() => {
            setSearch('');
            setCategory('all');
            setAirportQuery('');
            setAirportOptions([]);
            setCountry('');
            setRegion('');
            setFrom('');
            setTo('');
            setRangePreset('');
            setPage(0);
          }}
        >
          Clear
        </button>
        <Badge>
          Filters active:{' '}
          {[
            search && 'search',
            category !== 'all' && 'category',
            airportQuery && 'airport',
            country && 'country',
            region && 'region',
            from && 'from',
            to && 'to',
          ].filter(Boolean).length || '0'}
        </Badge>
      </div>

      <div style={{ height: 480, minHeight: 400 }}>
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
          <MapClickHandler onMapClick={handleMapClick} />
          {/* Marker clustering temporarily disabled due to missing package */}
          {markers.map((m) => {
            const evt = m.payload?.onClickId ? eventMap.get(m.payload.onClickId as string) : undefined;
            return (
              <Marker
                key={m.id}
                position={m.position as [number, number]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    if (!evt) return;
                    setSelected(evt);
                    setSelectedError(null);
                  },
                }}
              >
                <Popup>
                  <strong>{evt?.registration || 'Unknown'}</strong> ({evt?.aircraftType || 'Aircraft'})
                  <br />
                  {evt ? formatDate(evt.dateZ) : ''} — {evt?.summary || 'No summary'}
                  <br />
                  {evt?.operator || 'Unknown operator'}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div>
        {loading ? (
          <p>Loading…</p>
        ) : events.length === 0 ? (
          <p>No events found for current filters.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Date (Z)</th>
                <th>Reg</th>
                <th>Operator</th>
                <th>Type</th>
                <th>Airport</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => {
                    setSelected(e);
                    setSelectedError(null);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{formatDate(e.dateZ)}</td>
                  <td>{e.registration}</td>
                  <td>{e.operator || '—'}</td>
                  <td>{e.aircraftType || '—'}</td>
                  <td>{e.airportIcao || e.airportIata || '—'}</td>
                  <td>
                    <Badge
                      color={e.category === 'commercial' ? '#e3f2fd' : e.category === 'general' ? '#e8f5e9' : '#eee'}
                      border="#ccc"
                    >
                      {e.category}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Prev
          </button>
          <span>Page {page + 1}</span>
          <button onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: 'white', padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {selected.registration} — {selected.operator || 'Unknown'}
            </h2>
            <p>
              <strong>Date:</strong> {formatDate(selected.dateZ)} | <strong>Category:</strong> {selected.category} |{' '}
              <strong>Status:</strong> {selected.status || 'n/a'}
            </p>
            <p>
              <strong>Fatalities:</strong> {selected.fatalities ?? '—'} | <strong>Injuries:</strong> {selected.injuries ?? '—'}
            </p>
            <p>
              <strong>Location:</strong> {selected.airportIcao || selected.airportIata || 'Unknown'} ({selected.country || '—'},{' '}
              {selected.region || '—'}){' '}
              {typeof selected.lat === 'number' && typeof selected.lon === 'number'
                ? `@ ${selected.lat.toFixed(3)}, ${selected.lon.toFixed(3)}`
                : ''}
            </p>
            <p>
              <strong>Type:</strong> {selected.aircraftType || '—'}
            </p>
            <p>
              <strong>Summary:</strong> {selected.summary || '—'}
            </p>
            <p>
              <strong>Narrative:</strong>{' '}
              {selected.narrative
                ? selected.summary && selected.narrative.trim() === selected.summary.trim()
                  ? `${selected.narrative} (see sources for details)`
                  : selected.narrative
                : '—'}
            </p>
            <p>
              <strong>Sources:</strong>{' '}
              {selectedLoading
                ? 'Loading…'
                : selected.sources?.length
                  ? selected.sources.map((s) => (
                      <span key={s.url} style={{ marginRight: 8 }}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.sourceName || 'source'}
                        </a>
                      </span>
                    ))
                  : '—'}
            </p>
            {selectedError && <p style={{ color: 'red' }}>Failed to load event detail: {selectedError}</p>}

            {/* AI Explainer */}
            <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
              <button
                onClick={() => handleExplain(selected)}
                disabled={explainLoading}
                title="Ask AI to explain this accident"
                style={{ background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: explainLoading ? 'wait' : 'pointer' }}
              >
                {explainLoading ? '⏳ Thinking…' : '? Explain with AI'}
              </button>
              {explainError && <p style={{ color: 'red', marginTop: 8 }}>{explainError}</p>}
              {explainText && (
                <div style={{ marginTop: 10, background: '#f0f4ff', borderRadius: 6, padding: 12, fontSize: 14 }}>
                  <strong>AI Explanation:</strong>
                  <p style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{explainText}</p>
                </div>
              )}
            </div>

            <button style={{ marginTop: 12 }} onClick={() => { setSelected(null); setExplainText(null); setExplainError(null); }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
