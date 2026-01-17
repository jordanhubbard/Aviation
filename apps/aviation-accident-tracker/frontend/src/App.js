import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
// import MarkerClusterGroup from 'react-leaflet-cluster'; // Package doesn't exist, clustering temporarily disabled
import debounce from 'lodash.debounce';
import { Badge } from './components/Badge';
const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});
function formatDate(iso) {
    return new Date(iso).toISOString().slice(0, 10);
}
function formatInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
export function App() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [page, setPage] = useState(0);
    const pageSize = 50;
    // For detail modal
    const [selected, setSelected] = useState(null);
    const [airportQuery, setAirportQuery] = useState('');
    const [airportOptions, setAirportOptions] = useState([]);
    const [country, setCountry] = useState('');
    const [region, setRegion] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [rangePreset, setRangePreset] = useState('');
    const [options, setOptions] = useState({ countries: [], regions: [] });
    const today = formatInputDate(new Date());
    const fetchAirports = useMemo(() => debounce((q) => {
        if (!q.trim())
            return setAirportOptions([]);
        fetch(`/api/airports?search=${encodeURIComponent(q)}`)
            .then((r) => r.json())
            .then((data) => {
            setAirportOptions((data || []).map((a) => ({
                label: `${a.icao}${a.iata ? ` / ${a.iata}` : ''} — ${a.name}`,
                code: a.icao,
            })));
        })
            .catch(() => setAirportOptions([]));
    }, 300), []);
    const clampToToday = (value) => (value && value > today ? today : value);
    const applyPresetRange = (value) => {
        setRangePreset(value);
        if (!value)
            return;
        const days = Number(value);
        if (!Number.isFinite(days) || days <= 0)
            return;
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));
        setFrom(formatInputDate(start));
        setTo(formatInputDate(end));
        setPage(0);
    };
    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('limit', String(pageSize));
        params.set('offset', String(page * pageSize));
        if (search.trim())
            params.set('search', search.trim());
        if (category !== 'all')
            params.set('category', category);
        if (airportQuery.trim())
            params.set('airport', airportQuery.trim());
        if (country)
            params.set('country', country);
        if (region)
            params.set('region', region);
        if (from)
            params.set('from', from);
        if (to)
            params.set('to', to);
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
    const positioned = useMemo(() => events.filter((e) => typeof e.lat === 'number' && typeof e.lon === 'number'), [events]);
    const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
    const markers = useMemo(() => positioned.map((e) => ({
        id: e.id,
        position: [e.lat, e.lon],
        payload: {
            title: e.registration || e.aircraftType || e.summary,
            subtitle: e.summary,
            category: e.category,
            onClickId: e.id,
        }
    })), [positioned]);
    return (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }, children: [_jsxs("div", { style: { gridColumn: '1 / span 2' }, children: [_jsx("h1", { children: "Aviation Accident Tracker" }), loading && _jsx("p", { children: "Loading events\u2026" }), error && _jsxs("p", { style: { color: 'red' }, children: ["Error: ", error] }), !loading && events.length === 0 && _jsx("p", { children: "No events yet. Run backend seed or ingestion." })] }), _jsxs("div", { style: { gridColumn: '1 / span 2', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsxs("label", { children: ["Search:", ' ', _jsx("input", { value: search, onChange: (e) => {
                                    setPage(0);
                                    setSearch(e.target.value);
                                }, placeholder: "registration/operator/summary", style: { minWidth: 240 } })] }), _jsxs("label", { children: ["Category:", ' ', _jsxs("select", { value: category, onChange: (e) => {
                                    setPage(0);
                                    setCategory(e.target.value);
                                }, children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "general", children: "General" }), _jsx("option", { value: "commercial", children: "Commercial" })] })] }), _jsxs("label", { children: ["Country:", ' ', _jsxs("select", { value: country, onChange: (e) => {
                                    setCountry(e.target.value);
                                    setPage(0);
                                }, children: [_jsx("option", { value: "", children: "All" }), options.countries.map((c) => (_jsx("option", { value: c, children: c }, c)))] })] }), _jsxs("label", { children: ["Region:", ' ', _jsxs("select", { value: region, onChange: (e) => {
                            setRegion(e.target.value);
                            setPage(0);
                        }, children: [_jsx("option", { value: "", children: "All" }), options.regions.map((r) => (_jsx("option", { value: r, children: r }, r)))] })] }), _jsxs("label", { children: ["Range:", ' ', _jsxs("select", { value: rangePreset, onChange: (e) => {
                                    applyPresetRange(e.target.value);
                                }, children: [_jsx("option", { value: "", children: "Custom" }), _jsx("option", { value: "7", children: "Last 7 days" }), _jsx("option", { value: "30", children: "Last 30 days" }), _jsx("option", { value: "90", children: "Last 90 days" }), _jsx("option", { value: "365", children: "Last 365 days" })] })] }), _jsxs("label", { children: ["From:", ' ', _jsx("input", { type: "date", value: from, max: today, onChange: (e) => {
                                    setFrom(clampToToday(e.target.value));
                                    setRangePreset('');
                                    setPage(0);
                                } })] }), _jsxs("label", { children: ["To:", ' ', _jsx("input", { type: "date", value: to, max: today, onChange: (e) => {
                                    setTo(clampToToday(e.target.value));
                                    setRangePreset('');
                                    setPage(0);
                                } })] }), _jsxs("label", { children: ["Airport:", ' ', _jsx("input", { value: airportQuery, onChange: (e) => {
                                    const q = e.target.value;
                                    setAirportQuery(q);
                                    fetchAirports(q);
                                    setPage(0);
                                }, placeholder: "ICAO/IATA or name", style: { minWidth: 200 }, list: "airport-options" }), _jsx("datalist", { id: "airport-options", children: airportOptions.map((opt) => (_jsx("option", { value: opt.code, children: opt.label }, opt.code))) })] }), _jsx("button", { onClick: () => {
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
                        }, children: "Clear" }), _jsxs(Badge, { children: ["Filters active:", ' ', [
                                search && 'search',
                                category !== 'all' && 'category',
                                airportQuery && 'airport',
                                country && 'country',
                                region && 'region',
                                from && 'from',
                                to && 'to',
                            ].filter(Boolean).length || '0'] })] }), _jsx("div", { style: { height: 480, minHeight: 400 }, children: _jsxs(MapContainer, { center: [20, 0], zoom: 2, style: { height: '100%', width: '100%' }, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "\u00A9 OpenStreetMap contributors" }), markers.map((m) => {
                            const evt = m.payload?.onClickId ? eventMap.get(m.payload.onClickId) : undefined;
                            return (_jsx(Marker, { position: m.position, icon: icon, eventHandlers: { click: () => evt && setSelected(evt) }, children: _jsxs(Popup, { children: [_jsx("strong", { children: evt?.registration || 'Unknown' }), " (", evt?.aircraftType || 'Aircraft', ")", _jsx("br", {}), evt ? formatDate(evt.dateZ) : '', " \u2014 ", evt?.summary || 'No summary', _jsx("br", {}), evt?.operator || 'Unknown operator'] }) }, m.id));
                        })] }) }), _jsxs("div", { children: [loading ? (_jsx("p", { children: "Loading\u2026" })) : events.length === 0 ? (_jsx("p", { children: "No events found for current filters." })) : (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Date (Z)" }), _jsx("th", { children: "Reg" }), _jsx("th", { children: "Operator" }), _jsx("th", { children: "Type" }), _jsx("th", { children: "Airport" }), _jsx("th", { children: "Category" })] }) }), _jsx("tbody", { children: events.map((e) => (_jsxs("tr", { onClick: () => setSelected(e), style: { cursor: 'pointer' }, children: [_jsx("td", { children: formatDate(e.dateZ) }), _jsx("td", { children: e.registration }), _jsx("td", { children: e.operator || '—' }), _jsx("td", { children: e.aircraftType || '—' }), _jsx("td", { children: e.airportIcao || e.airportIata || '—' }), _jsx("td", { children: _jsx(Badge, { color: e.category === 'commercial' ? '#e3f2fd' : e.category === 'general' ? '#e8f5e9' : '#eee', border: "#ccc", children: e.category }) })] }, e.id))) })] })), _jsxs("div", { style: { marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("button", { disabled: page === 0, onClick: () => setPage((p) => Math.max(0, p - 1)), children: "Prev" }), _jsxs("span", { children: ["Page ", page + 1] }), _jsx("button", { onClick: () => setPage((p) => p + 1), children: "Next" })] })] }), selected && (_jsx("div", { style: {
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }, onClick: () => setSelected(null), children: _jsxs("div", { style: { background: 'white', padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }, onClick: (e) => e.stopPropagation(), children: [_jsxs("h2", { children: [selected.registration, " \u2014 ", selected.operator || 'Unknown'] }), _jsxs("p", { children: [_jsx("strong", { children: "Date:" }), " ", formatDate(selected.dateZ), " | ", _jsx("strong", { children: "Category:" }), " ", selected.category, " |", ' ', _jsx("strong", { children: "Status:" }), " ", selected.status || 'n/a'] }), _jsxs("p", { children: [_jsx("strong", { children: "Location:" }), " ", selected.airportIcao || selected.airportIata || 'Unknown', " (", selected.country || '—', ",", ' ', selected.region || '—', ") ", selected.lat && selected.lon ? `@ ${selected.lat.toFixed(3)}, ${selected.lon.toFixed(3)}` : ''] }), _jsxs("p", { children: [_jsx("strong", { children: "Type:" }), " ", selected.aircraftType || '—'] }), _jsxs("p", { children: [_jsx("strong", { children: "Summary:" }), " ", selected.summary || '—'] }), _jsxs("p", { children: [_jsx("strong", { children: "Narrative:" }), " ", selected.narrative || '—'] }), _jsxs("p", { children: [_jsx("strong", { children: "Sources:" }), ' ', selected.sources?.map((s) => (_jsx("span", { style: { marginRight: 8 }, children: _jsx("a", { href: s.url, target: "_blank", rel: "noreferrer", children: s.sourceName || 'source' }) }, s.url)))] }), _jsx("button", { onClick: () => setSelected(null), children: "Close" })] }) }))] }));
}
