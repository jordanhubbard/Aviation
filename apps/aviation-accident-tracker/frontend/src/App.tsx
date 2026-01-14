import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import debounce from 'lodash.debounce';

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
  summary?: string;
  narrative?: string;
  sources: { sourceName: string; url: string }[];
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
  const [airportQuery, setAirportQuery] = useState('');
  const [airportOptions, setAirportOptions] = useState<{ label: string; code: string }[]>([]);

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
          .catch(() => setAirportOptions([]));
      }, 300),
    []
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (category !== 'all') params.set('category', category);
    if (airportQuery.trim()) params.set('airport', airportQuery.trim());
    fetch(`/api/events?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.data ?? data?.data ?? data);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [search, category, page, airportQuery]);

  const positioned = useMemo(() => events.filter((e) => typeof e.lat === 'number' && typeof e.lon === 'number'), [events]);

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
            setPage(0);
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ height: 480, minHeight: 400 }}>
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
          <MarkerClusterGroup chunkedLoading>
            {positioned.map((e) => (
              <Marker key={e.id} position={[e.lat!, e.lon!]} icon={icon} eventHandlers={{ click: () => setSelected(e) }}>
                <Popup>
                  <strong>{e.registration}</strong> ({e.aircraftType || 'Aircraft'})
                  <br />
                  {formatDate(e.dateZ)} — {e.summary || 'No summary'}
                  <br />
                  {e.operator || 'Unknown operator'}
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
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
                <tr key={e.id} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
                  <td>{formatDate(e.dateZ)}</td>
                  <td>{e.registration}</td>
                  <td>{e.operator || '—'}</td>
                  <td>{e.aircraftType || '—'}</td>
                  <td>{e.airportIcao || e.airportIata || '—'}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: e.category === 'commercial' ? '#e3f2fd' : e.category === 'general' ? '#e8f5e9' : '#eee',
                        border: '1px solid #ccc',
                      }}
                    >
                      {e.category}
                    </span>
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
              <strong>Location:</strong> {selected.airportIcao || selected.airportIata || 'Unknown'} ({selected.country || '—'},{' '}
              {selected.region || '—'}) {selected.lat && selected.lon ? `@ ${selected.lat.toFixed(3)}, ${selected.lon.toFixed(3)}` : ''}
            </p>
            <p>
              <strong>Type:</strong> {selected.aircraftType || '—'}
            </p>
            <p>
              <strong>Summary:</strong> {selected.summary || '—'}
            </p>
            <p>
              <strong>Narrative:</strong> {selected.narrative || '—'}
            </p>
            <p>
              <strong>Sources:</strong>{' '}
              {selected.sources?.map((s) => (
                <span key={s.url} style={{ marginRight: 8 }}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.sourceName || 'source'}
                  </a>
                </span>
              ))}
            </p>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
