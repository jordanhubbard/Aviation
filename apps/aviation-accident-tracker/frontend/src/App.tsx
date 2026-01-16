import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import debounce from 'lodash.debounce';
import { Badge } from './components/Badge';

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
  status?: string;
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
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [options, setOptions] = useState<{ countries: string[]; regions: string[] }>({ countries: [], regions: [] });
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx' | 'pdf'>('csv');
  const [exportAll, setExportAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportColumns = useMemo(
    () => [
      'dateZ',
      'registration',
      'aircraftType',
      'operator',
      'category',
      'airportIcao',
      'country',
      'region',
      'fatalities',
      'injuries',
      'summary'
    ],
    []
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>(exportColumns);

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
        setError(String(err));
        setLoading(false);
      });
  }, [search, category, page, airportQuery, country, region, from, to]);

  useEffect(() => {
    fetch('/api/filters/options')
      .then((r) => r.json())
      .then((data) => setOptions(data))
      .catch(() => setOptions({ countries: [], regions: [] }));
  }, []);

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const payload = exportAll
        ? { format: exportFormat, columns: selectedColumns, exportAll: true }
        : {
            format: exportFormat,
            columns: selectedColumns,
            exportAll: false,
            search,
            category,
            airport: airportQuery,
            country,
            region,
            from,
            to
          };

      const response = await fetch('/api/events/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const extension = exportFormat === 'xlsx' ? 'xlsx' : exportFormat;
      const filename = `accidents_export.${extension}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

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
          Country:{' '}
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {(options.countries || []).map((c) => (
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
            {(options.regions || []).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          From:{' '}
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          To:{' '}
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
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

      <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Export format:{' '}
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="xlsx">Excel (XLSX)</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={exportAll}
            onChange={(e) => setExportAll(e.target.checked)}
          />
          Export all data
        </label>
        <button onClick={handleExport} disabled={exporting || selectedColumns.length === 0}>
          {exporting ? 'Exporting…' : 'Export'}
        </button>
        {exportError && <span style={{ color: 'red' }}>Export error: {exportError}</span>}
      </div>

      <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <strong>Columns:</strong>
        <button
          type="button"
          onClick={() => setSelectedColumns(exportColumns)}
          disabled={selectedColumns.length === exportColumns.length}
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setSelectedColumns([])}
          disabled={selectedColumns.length === 0}
        >
          Clear
        </button>
        {exportColumns.map((col) => (
          <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={selectedColumns.includes(col)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selectedColumns, col]
                  : selectedColumns.filter((c) => c !== col);
                setSelectedColumns(next);
              }}
            />
            {col}
          </label>
        ))}
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
