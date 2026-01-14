import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

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

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (search.trim()) params.set('search', search.trim());
    if (category !== 'all') params.set('category', category);
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
  }, [search, category]);

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="registration/operator/summary"
            style={{ minWidth: 240 }}
          />
        </label>
        <label>
          Category:{' '}
          <select value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="all">All</option>
            <option value="general">General</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <button onClick={() => { setSearch(''); setCategory('all'); }}>Clear</button>
      </div>

      <div style={{ height: 480, minHeight: 400 }}>
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
          {positioned.map((e) => (
            <Marker key={e.id} position={[e.lat!, e.lon!]} icon={icon}>
              <Popup>
                <strong>{e.registration}</strong> ({e.aircraftType || 'Aircraft'})
                <br />
                {formatDate(e.dateZ)} — {e.summary || 'No summary'}
                <br />
                {e.operator || 'Unknown operator'}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div>
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
              <tr key={e.id}>
                <td>{formatDate(e.dateZ)}</td>
                <td>{e.registration}</td>
                <td>{e.operator || '—'}</td>
                <td>{e.aircraftType || '—'}</td>
                <td>{e.airportIcao || e.airportIata || '—'}</td>
                <td>{e.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
