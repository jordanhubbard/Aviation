import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
<<<<<<< HEAD
import './index.css';

// Types
interface Event {
  id: string;
  dateZ: string;
  registration: string;
  aircraftType?: string;
  operator?: string;
  category: 'general' | 'commercial' | 'unknown';
  airportIcao?: string;
  country?: string;
  lat?: number;
  lon?: number;
  fatalities: number;
  injuries: number;
  summary?: string;
  narrative?: string;
  status?: string;
}

interface EventsResponse {
  events: Event[];
  total: number;
  limit: number;
  offset: number;
}

// API Client
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

async function fetchEvents(params: {
  from?: string;
  to?: string;
  category?: string;
  airport?: string;
  country?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<EventsResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      query.append(key, String(value));
    }
  });
  
  const response = await fetch(`${API_BASE}/events?${query}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchEventDetail(id: string): Promise<Event> {
  const response = await fetch(`${API_BASE}/events/${id}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Components
function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadEvents();
  }, [category, offset]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    loadEvents();
  };
  
  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1>✈️ Aviation Accident Tracker</h1>
        <p style={{ color: '#666' }}>
          Tracking aviation accidents and incidents since 2000
        </p>
      </header>
      
      {/* Filters */}
      <div style={{ 
        background: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0 }}>Filters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setOffset(0);
              }}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="all">All</option>
              <option value="general">General Aviation</option>
              <option value="commercial">Commercial</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Country
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. USA, Canada"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
        </div>
        
        <form onSubmit={handleSearch} style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Search (summary, operator, registration)
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ flex: 1, padding: '8px' }}
            />
            <button type="submit" style={{ padding: '8px 20px' }}>
              Search
            </button>
          </div>
        </form>
      </div>
      
      {/* Results */}
      {error && (
        <div style={{ 
          background: '#fee', 
          padding: '15px', 
          borderRadius: '4px',
          marginBottom: '20px',
          color: '#c00'
        }}>
          Error: {error}
        </div>
      )}
      
      <div style={{ marginBottom: '15px' }}>
        <strong>{total}</strong> events found
      </div>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#e0e0e0' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Registration</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Aircraft</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Operator</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Location</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Fatalities</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>
                      {new Date(event.dateZ).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px' }}>{event.registration}</td>
                    <td style={{ padding: '10px' }}>{event.aircraftType || '—'}</td>
                    <td style={{ padding: '10px' }}>{event.operator || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 
                          event.category === 'commercial' ? '#e3f2fd' :
                          event.category === 'general' ? '#f3e5f5' :
                          '#f5f5f5',
                        fontSize: '0.85em'
                      }}>
                        {event.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {event.airportIcao && `${event.airportIcao}, `}
                      {event.country || '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      {event.fatalities || 0}
                    </td>
                    <td style={{ padding: '10px', maxWidth: '300px' }}>
                      {event.summary || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pages > 1 && (
            <div style={{ 
              marginTop: '20px', 
              display: 'flex', 
              gap: '10px',
              justifyContent: 'center'
            }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setOffset(offset - limit)}
                style={{ padding: '8px 15px' }}
              >
                Previous
              </button>
              <span style={{ padding: '8px' }}>
                Page {currentPage} of {pages}
              </span>
              <button
                disabled={currentPage === pages}
                onClick={() => setOffset(offset + limit)}
                style={{ padding: '8px 15px' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
=======
import { App } from './App';
>>>>>>> cfa134e (feat(accident-tracker): fixtures for ASN/AVHerald and frontend map/table)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
