import { Fragment, useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
// import MarkerClusterGroup from 'react-leaflet-cluster'; // Package doesn't exist, clustering temporarily disabled
import debounce from 'lodash.debounce';
import { distanceKM } from '@aviation/shared-sdk/aviation/navigation';
import { Badge } from './components/Badge';
import { reportFrontendErrorToMac } from './utils/macReporting';
import { countryLabel, regionLabel, parseSearchQuery } from './searchQuery';
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
  causes?: { label: string; sourceName: string; url: string; basis: 'official' | 'occurrence' | 'reported' }[];
  sources: { sourceName: string; title?: string; url: string; fetchedAt?: string }[];
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
  const [category, setCategory] = useState<'all' | 'general' | 'commercial' | 'unknown'>('all');
  const [cause, setCause] = useState('');
  const [naturalQuery, setNaturalQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ lastSuccessAt: string | null; lastError: string | null } | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // For detail modal
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);
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
            void reportFrontendErrorToMac(err, {
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
    setExpandedId(null);
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (cause) params.set('cause', cause);
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
        void reportFrontendErrorToMac(err, {
          kind: 'fetch',
          extra: { endpoint: '/api/events', query: params.toString() },
        });
        setError(String(err));
        setLoading(false);
      });
  }, [search, cause, category, page, airportQuery, country, region, from, to]);

  useEffect(() => {
    const refresh = () => fetch('/api/ingest/status').then(r => r.json()).then(setSyncStatus).catch(() => setSyncStatus(null));
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const applyNaturalQuery = () => {
    const parsed = parseSearchQuery(naturalQuery, options.countries, options.regions);
    setSearch(parsed.search ?? '');
    setCause(parsed.cause ?? '');
    setCategory(parsed.category ?? 'all');
    setCountry(parsed.country ?? '');
    setRegion(parsed.region ?? '');
    setFrom(parsed.from ?? '');
    setTo(parsed.to ?? '');
    setRangePreset('');
    setPage(0);
  };

  const toggleSources = async (event: EventRecord) => {
    if (expandedId === event.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(event.id);
    setExpandedError(null);
    if (event.sources?.length) return;
    setExpandedLoading(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const detail: EventRecord = await response.json();
      setEvents(previous => previous.map(row => row.id === detail.id ? { ...row, ...detail } : row));
    } catch (error) {
      setExpandedError(String(error));
    } finally {
      setExpandedLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/filters/options')
      .then((r) => r.json())
      .then((data) => setOptions(data))
      .catch((err) => {
        void reportFrontendErrorToMac(err, { kind: 'fetch', extra: { endpoint: '/api/filters/options' } });
        setOptions({ countries: [], regions: [] });
      });
  }, []);

  useEffect(() => {
    if (!selected) {
      setSelectedLoading(false);
      setSelectedError(null);
      return;
    }

    // Older list payloads may omit sources; hydrate those from the detail endpoint.
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

        void reportFrontendErrorToMac(err, {
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
      const candidateDistance = distanceKM(lat, lon, entry.lat, entry.lon);
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
    <div id="accident-tracker-app" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }}>
      <style>{`.leaflet-control-attribution a { color: #005a7a; text-decoration: underline; }`}</style>
      <div style={{ gridColumn: '1 / span 2' }}>
        <h1>Aviation Accident Tracker</h1>
        <p>Last successful sync: {syncStatus?.lastSuccessAt ? new Date(syncStatus.lastSuccessAt).toLocaleString() : 'Not recorded yet'}{syncStatus?.lastError ? ' · Latest sync failed' : ''}</p>
        {loading && <p>Loading events…</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {!loading && events.length === 0 && <p>No events yet. Run backend seed or ingestion.</p>}
      </div>

      <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Describe accidents:{' '}
          <input value={naturalQuery} onChange={event => setNaturalQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') applyNaturalQuery(); }}
            placeholder="Engine failure in California last 30 days" style={{ minWidth: 310 }} />
        </label>
        <button type="button" onClick={applyNaturalQuery}>Apply query</button>
        <small>Understands causes, category, place, and date; other words search event text.</small>
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
            <option value="general">General aviation</option>
            <option value="commercial">Commercial aviation</option>
            <option value="unknown">Unknown</option>
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
                {countryLabel(c)}
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
                {regionLabel(r)}
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
            setCause('');
            setNaturalQuery('');
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
            cause && 'cause',
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
                <th aria-label="Citations" />
                <th>Date (Z)</th>
                <th>Reg</th>
                <th>Operator</th>
                <th>Type</th>
                <th>Airport</th>
                <th>Category</th>
                <th>Source</th>
                <th>Cause(s)</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <Fragment key={e.id}>
                <tr
                  key={e.id}
                  tabIndex={0}
                  aria-label={`View details for ${e.registration || 'unknown aircraft'}`}
                  onClick={() => {
                    setSelected(e);
                    setSelectedError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(e);
                      setSelectedError(null);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <button type="button" aria-label={`Show citations for ${e.registration}`}
                      aria-expanded={expandedId === e.id} aria-controls={`citations-${e.id}`}
                      onClick={event => { event.stopPropagation(); void toggleSources(e); }}
                      style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>
                      {expandedId === e.id ? '▾' : '▸'}
                    </button>
                  </td>
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
                  <td>{e.sources?.length ? <a href={e.sources[0].url} target="_blank" rel="noopener noreferrer"
                    onClick={event => event.stopPropagation()}>{e.sources[0].sourceName.toUpperCase()}{e.sources.length > 1 ? ` +${e.sources.length - 1}` : ''}</a> : '—'}</td>
                  <td>{e.causes?.length ? e.causes.filter((cause, index, all) =>
                    all.findIndex(candidate => candidate.label === cause.label) === index).map(cause => (
                    <span key={cause.label} title={`${cause.basis === 'official' ? 'Official probable cause' : cause.basis === 'occurrence' ? 'NTSB occurrence' : 'Reported mechanism'}: ${cause.sourceName}`}
                      style={{ display: 'inline-block', marginRight: 4 }}>
                      <Badge color={cause.basis === 'official' ? '#e3f2fd' : '#fff3cd'} border="#ccc">{cause.label}</Badge>
                    </span>
                  )) : <Badge color="#eee" border="#ccc">Unknown</Badge>}</td>
                </tr>
                {expandedId === e.id && (
                  <tr id={`citations-${e.id}`}>
                    <td colSpan={9} style={{ padding: '10px 24px', background: '#f7f9fc' }}>
                      <strong>Known citations</strong>
                      {e.causes?.length ? <ul aria-label="Cause evidence">{e.causes.map(cause => (
                        <li key={`${cause.label}-${cause.url}`}>
                          {cause.label} ({cause.basis === 'official' ? 'official probable cause' : cause.basis === 'occurrence' ? 'NTSB occurrence' : 'reported mechanism'}):{' '}
                          <a href={cause.url} target="_blank" rel="noopener noreferrer">{cause.sourceName}</a>
                        </li>
                      ))}</ul> : null}
                      {expandedLoading ? <p>Loading citations…</p> : expandedError ? <p role="alert">{expandedError}</p>
                        : e.sources?.length ? <ul style={{ margin: '6px 0' }}>{e.sources.map(source => (
                          <li key={`${source.sourceName}-${source.url}`}>
                            <a href={source.url} target="_blank" rel="noopener noreferrer">
                              {source.title || source.sourceName}
                            </a> {source.title && <span>— {source.sourceName}</span>}
                          </li>
                        ))}</ul> : <p>No citations are available yet.</p>}
                    </td>
                  </tr>
                )}
                </Fragment>
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-title"
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
            <h2 id="event-detail-title">
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
                          {s.title || s.sourceName || 'source'}
                        </a>
                      </span>
                    ))
                  : '—'}
            </p>
            {selectedError && <p style={{ color: 'red' }}>Failed to load event detail: {selectedError}</p>}
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
