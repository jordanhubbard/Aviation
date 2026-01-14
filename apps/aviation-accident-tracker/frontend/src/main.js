import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// API Client
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';
async function fetchEvents(params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            query.append(key, String(value));
        }
    });
    const response = await fetch(`${API_BASE}/events?${query}`);
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    return response.json();
}
async function fetchEventDetail(id) {
    const response = await fetch(`${API_BASE}/events/${id}`);
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    return response.json();
}
// Components
function App() {
    const [events, setEvents] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Filters
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [country, setCountry] = useState('');
    // Pagination
    const [offset, setOffset] = useState(0);
    const limit = 20;
    const loadEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchEvents({
                category: category !== 'all' ? category : undefined,
                search: search || undefined,
                country: country || undefined,
                limit,
                offset
            });
            setEvents(response.events);
            setTotal(response.total);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load events');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadEvents();
    }, [category, offset]);
    const handleSearch = (e) => {
        e.preventDefault();
        setOffset(0);
        loadEvents();
    };
    const pages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    return (_jsxs("div", { style: { maxWidth: '1200px', margin: '0 auto', padding: '20px' }, children: [_jsxs("header", { style: { marginBottom: '30px' }, children: [_jsx("h1", { children: "\u2708\uFE0F Aviation Accident Tracker" }), _jsx("p", { style: { color: '#666' }, children: "Tracking aviation accidents and incidents since 2000" })] }), _jsxs("div", { style: {
                    background: '#f5f5f5',
                    padding: '20px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }, children: [_jsx("h3", { style: { marginTop: 0 }, children: "Filters" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }, children: [_jsxs("div", { children: [_jsx("label", { style: { display: 'block', marginBottom: '5px' }, children: "Category" }), _jsxs("select", { value: category, onChange: (e) => {
                                            setCategory(e.target.value);
                                            setOffset(0);
                                        }, style: { width: '100%', padding: '8px' }, children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "general", children: "General Aviation" }), _jsx("option", { value: "commercial", children: "Commercial" }), _jsx("option", { value: "unknown", children: "Unknown" })] })] }), _jsxs("div", { children: [_jsx("label", { style: { display: 'block', marginBottom: '5px' }, children: "Country" }), _jsx("input", { type: "text", value: country, onChange: (e) => setCountry(e.target.value), placeholder: "e.g. USA, Canada", style: { width: '100%', padding: '8px' } })] })] }), _jsxs("form", { onSubmit: handleSearch, style: { marginTop: '15px' }, children: [_jsx("label", { style: { display: 'block', marginBottom: '5px' }, children: "Search (summary, operator, registration)" }), _jsxs("div", { style: { display: 'flex', gap: '10px' }, children: [_jsx("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search...", style: { flex: 1, padding: '8px' } }), _jsx("button", { type: "submit", style: { padding: '8px 20px' }, children: "Search" })] })] })] }), error && (_jsxs("div", { style: {
                    background: '#fee',
                    padding: '15px',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    color: '#c00'
                }, children: ["Error: ", error] })), _jsxs("div", { style: { marginBottom: '15px' }, children: [_jsx("strong", { children: total }), " events found"] }), loading ? (_jsx("div", { children: "Loading..." })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { style: { background: '#e0e0e0' }, children: [_jsx("th", { style: { padding: '10px', textAlign: 'left' }, children: "Date" }), _jsx("th", { style: { padding: '10px', textAlign: 'left' }, children: "Registration" }), _jsx("th", { style: { padding: '10px', textAlign: 'left' }, children: "Aircraft" }), _jsx("th", { style: { padding: '10px', textAlign: 'left' }, children: "Operator" }), _jsx("th", { style: { padding: '10px', textAlign: 'left' }, children: "Category" }), _jsx("th", { style: { padding: '10px', textAlign: 'left' }, children: "Location" }), _jsx("th", { style: { padding: '10px', textAlign: 'right' }, children: "Fatalities" }), _jsx("th", { style: { padding: '10px', textAlign: 'left' }, children: "Summary" })] }) }), _jsx("tbody", { children: events.map((event) => (_jsxs("tr", { style: { borderBottom: '1px solid #ddd' }, children: [_jsx("td", { style: { padding: '10px' }, children: new Date(event.dateZ).toLocaleDateString() }), _jsx("td", { style: { padding: '10px' }, children: event.registration }), _jsx("td", { style: { padding: '10px' }, children: event.aircraftType || '—' }), _jsx("td", { style: { padding: '10px' }, children: event.operator || '—' }), _jsx("td", { style: { padding: '10px' }, children: _jsx("span", { style: {
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        background: event.category === 'commercial' ? '#e3f2fd' :
                                                            event.category === 'general' ? '#f3e5f5' :
                                                                '#f5f5f5',
                                                        fontSize: '0.85em'
                                                    }, children: event.category }) }), _jsxs("td", { style: { padding: '10px' }, children: [event.airportIcao && `${event.airportIcao}, `, event.country || '—'] }), _jsx("td", { style: { padding: '10px', textAlign: 'right' }, children: event.fatalities || 0 }), _jsx("td", { style: { padding: '10px', maxWidth: '300px' }, children: event.summary || '—' })] }, event.id))) })] }) }), pages > 1 && (_jsxs("div", { style: {
                            marginTop: '20px',
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'center'
                        }, children: [_jsx("button", { disabled: currentPage === 1, onClick: () => setOffset(offset - limit), style: { padding: '8px 15px' }, children: "Previous" }), _jsxs("span", { style: { padding: '8px' }, children: ["Page ", currentPage, " of ", pages] }), _jsx("button", { disabled: currentPage === pages, onClick: () => setOffset(offset + limit), style: { padding: '8px 15px' }, children: "Next" })] }))] }))] }));
}
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
