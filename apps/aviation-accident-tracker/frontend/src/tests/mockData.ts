/**
 * Mock data for testing
 */

export const mockEvents = [
  {
    id: '1',
    dateZ: '2024-01-15T10:30:00Z',
    registration: 'N12345',
    aircraftType: 'Cessna 172',
    operator: 'Private Owner',
    category: 'general',
    airportIcao: 'KSFO',
    airportIata: 'SFO',
    country: 'USA',
    region: 'CA',
    lat: 37.6188,
    lon: -122.375,
    summary: 'Engine failure on approach',
    narrative: 'Aircraft experienced sudden engine failure during final approach. Pilot executed successful emergency landing in field adjacent to runway.',
    status: 'final',
    sources: [
      { sourceName: 'ASN', url: 'https://aviation-safety.net/database/record.php?id=20240115-0' },
    ],
  },
  {
    id: '2',
    dateZ: '2024-01-20T14:45:00Z',
    registration: 'N67890',
    aircraftType: 'Boeing 737-800',
    operator: 'United Airlines',
    category: 'commercial',
    airportIcao: 'KJFK',
    airportIata: 'JFK',
    country: 'USA',
    region: 'NY',
    lat: 40.6413,
    lon: -73.7781,
    summary: 'Bird strike on takeoff',
    narrative: 'Commercial flight encountered bird strike during takeoff roll. Aircraft returned safely to airport after dumping fuel.',
    status: 'preliminary',
    sources: [
      { sourceName: 'AVHerald', url: 'https://avherald.com/h?article=12345' },
    ],
  },
  {
    id: '3',
    dateZ: '2024-02-01T08:15:00Z',
    registration: 'N54321',
    aircraftType: 'Piper PA-28',
    operator: 'Flight School Inc',
    category: 'general',
    airportIcao: 'KPAO',
    country: 'USA',
    region: 'CA',
    // No lat/lon for testing markers without location
    summary: 'Hard landing during training',
    narrative: 'Student pilot performed hard landing during solo practice. Aircraft sustained minor damage to landing gear.',
    sources: [
      { sourceName: 'ASN', url: 'https://aviation-safety.net/database/record.php?id=20240201-0' },
    ],
  },
];

export const mockAirports = [
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco International Airport' },
  { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy International Airport' },
  { icao: 'KPAO', iata: 'PAO', name: 'Palo Alto Airport' },
];

export const mockFilterOptions = {
  countries: ['USA', 'Canada', 'Mexico'],
  regions: ['CA', 'NY', 'TX', 'FL'],
};
