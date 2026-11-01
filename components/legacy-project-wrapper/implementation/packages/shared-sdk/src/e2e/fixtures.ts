import { type E2ERunId, tagTestData } from './index.js';

/** A ForeFlight CSV whose filename and flight comment identify its test run. */
export function standardForeFlightCsv(runId: E2ERunId): { filename: string; content: string } {
  const filename = `${runId}-solo-pic.csv`;
  return { filename, content: [
    'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'Aircraft Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA),,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'Flights Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance',
    `2026-10-20,N125CM,KOAK,KSFO,0.2,0.0,0.0,0.0,0.0,0.0,0.2,0.0,0.0,0.2,1,0,${runId},,10`,
    '',
  ].join('\n') };
}

/** Deterministic aviation fixtures; every record carries database isolation columns. */
export function standardE2EFixtures(runId: E2ERunId) {
  const tag = <T extends object>(value: T) => tagTestData(runId, value);
  return {
    aircraft: tag({ registration: 'N123ET', type_code: 'C172', empty_weight_lb: 1500, empty_arm_in: 39 }),
    airport: tag({ icao: 'KOAK', name: 'Oakland International', elevation_ft: 9 }),
    weather: tag({ station: 'KOAK', raw_metar: 'KOAK 241953Z 28008KT 10SM FEW020 18/10 A3002' }),
    mission: tag({ title: `E2E mission ${runId}`, category: 'Training', objective: 'Practice a local pattern' }),
    accident: tag({ dateZ: '2026-10-20T00:00:00Z', registration: 'N123ET', category: 'general',
      country: 'USA', region: 'CA', lat: 37.721, lon: -122.221,
      summary: 'Synthetic E2E event',
      sources: [{ sourceName: 'e2e-fixture', url: `https://example.invalid/e2e/${runId}`,
        fetchedAt: '2026-10-20T00:00:00Z' }] }),
    flight: tag({ registration: 'N123ET', from: 'KOAK', to: 'KSFO', total_hours: 0.5 }),
    track: tag({ registration: 'N123ET', points: [[37.721, -122.221, 1200], [37.73, -122.23, 1500]] }),
  };
}

/** External responses are inert and carry the same run tag as database fixtures. */
export function standardE2EMocks(runId: E2ERunId) {
  const tag = <T extends object>(value: T) => tagTestData(runId, value);
  return {
    weather: tag({ station: 'KOAK', metar: 'KOAK 241953Z 28008KT 10SM FEW020 18/10 A3002',
      taf: 'TAF KOAK 241720Z 2418/2518 28008KT P6SM FEW020' }),
    weatherStations: tag({ region: 'us', stations: [{ code: 'KSFO', name: 'San Francisco International',
      category: 'VFR', latitude: 37.619, longitude: -122.375, wind_speed_kt: 8,
      wind_direction: 280, visibility_sm: 10, ceiling_ft: 12000, temperature_f: 64,
      updatedAt: '2026-10-24T19:53:00Z' }] }),
    notams: tag({ station: 'KOAK', items: [] as object[] }),
    airportSearch: tag({ query: 'Oakland', results: [{ icao: 'KOAK', name: 'Oakland International' }] }),
    ai: tag({ answer: 'Synthetic E2E response; no external model was called.' }),
    githubIssue: tag({ number: 100000, url: `https://example.invalid/e2e/${runId}/issue/100000` }),
    tracker: tag({ flights: [{ icao24: 'e2e123', callsign: 'E2E123', originCountry: 'United States',
      latitude: 37.721, longitude: -122.221, baroAltitude: 1200, geoAltitude: 1200,
      velocity: 40, heading: 270, onGround: false, lastContact: 1_800_000_000, verticalRate: 0 }],
      total: 1, updatedAt: '2026-10-24T19:53:00Z' }),
    planner: tag({
      airport: { icao: 'KOAK', iata: 'OAK', name: `E2E Oakland ${runId}`, city: 'Oakland',
        country: 'US', latitude: 37.721, longitude: -122.221, elevation: 9, type: 'large_airport' },
      weather: { airport: 'KOAK', conditions: 'Clear', temperature: 64, wind_speed: 8,
        wind_direction: 280, visibility: 10, ceiling: 12000,
        metar: 'KOAK 241953Z 28008KT 10SM FEW020 18/10 A3002', flight_category: 'VFR',
        recommendation: 'Synthetic E2E weather', warnings: [] },
      savedPlan: { id: runId, name: `E2E saved plan ${runId}`, origin: 'KOAK',
        destination: 'KSFO', speed: 110, altitude: 3500 },
      routePlan: tag({ route: ['KOAK', 'KSFO'], distance_nm: 10, time_hr: 0.1,
        origin_coords: [37.721, -122.221], destination_coords: [37.619, -122.375],
        departure_time_utc: '2026-10-24T20:00:00Z', arrival_time_utc: '2026-10-24T20:06:00Z',
        segments: [{ start: [37.721, -122.221], end: [37.619, -122.375], type: 'cruise', vfr_altitude: 3500 }],
        legs: [{ from_code: 'KOAK', to_code: 'KSFO', distance_nm: 10, groundspeed_kt: 100,
          ete_minutes: 6, elapsed_minutes: 6, fuel_stop: false }],
        alternates: [], groundspeed_kt: 100, headwind_kt: 10 }),
    }),
  };
}
