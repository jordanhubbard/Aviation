// Fixtures for E2E tests

export const flightPlans = [
  {
    origin: 'KSFO',
    destination: 'KLAX',
    waypoints: ['SFO', 'LAX'],
    altitude: 35000,
    speed: 450,
  },
  {
    origin: 'KJFK',
    destination: 'EGLL',
    waypoints: ['JFK', 'LHR'],
    altitude: 37000,
    speed: 480,
  },
];

export const navData = {
  airports: [
    { code: 'KSFO', name: 'San Francisco International Airport' },
    { code: 'KLAX', name: 'Los Angeles International Airport' },
    { code: 'KJFK', name: 'John F. Kennedy International Airport' },
    { code: 'EGLL', name: 'London Heathrow Airport' },
  ],
  navaids: [
    { id: 'SFO', type: 'VOR', frequency: 115.8 },
    { id: 'LAX', type: 'VOR', frequency: 113.6 },
  ],
};

export const demoScenarios = [
  {
    name: 'Transcontinental Flight',
    description: 'A flight from New York to London',
    flightPlan: flightPlans[1],
  },
  {
    name: 'California Shuttle',
    description: 'A short flight from San Francisco to Los Angeles',
    flightPlan: flightPlans[0],
  },
];

export const mockApis = [
  {
    urlPattern: '**/api/weather/**',
    response: {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        airport: 'TEST',
        conditions: 'Clear',
        temperature: 70,
        wind_speed: 5,
        wind_direction: 270,
        visibility: 10,
        ceiling: 10000,
        metar: '',
        flight_category: 'VFR',
        recommendation: 'VFR conditions.',
        warnings: [],
      }),
    },
  },
];
