/**
 * Flight Tracker Service Tests
 *
 * Comprehensive hermetic tests for FlightTrackerService covering:
 *  - Service lifecycle (start / stop)
 *  - State-vector parsing from OpenSky REST payload
 *  - Position / velocity decoding from raw array
 *  - Stale-track pruning
 *  - Weather-overlay join (airport-conditions cache)
 *  - OpenSky rate-limit back-off (Retry-After header)
 *  - Flight management helpers (add / remove / list)
 *
 * All HTTP is intercepted by the global fetch mock installed in tests/setup.ts.
 * No real network calls are made.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { FlightTrackerService } from '../src/service';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal OpenSky REST response payload. */
function makeOpenSkyPayload(states: unknown[][]): { states: unknown[][] } {
  return { states };
}

/**
 * Build one raw OpenSky state vector array.
 *
 * Array positions (0-indexed):
 *  0  icao24         string
 *  1  callsign       string | null
 *  2  origin_country string
 *  3  time_position  number | null
 *  4  last_contact   number
 *  5  longitude      number | null
 *  6  latitude       number | null
 *  7  baro_altitude  number | null
 *  8  on_ground      boolean
 *  9  velocity       number | null
 * 10  true_track     number | null
 * 11  vertical_rate  number | null
 * 12  sensors        null
 * 13  geo_altitude   number | null
 */
function makeStateVector({
  icao24 = 'abc123',
  callsign = 'UAL100',
  originCountry = 'United States',
  lastContact = 1700000000,
  longitude = -122.4,
  latitude = 37.8,
  baroAltitude = 10668,
  onGround = false,
  velocity = 230,
  heading = 90,
  verticalRate = 0,
  geoAltitude = 10700,
}: {
  icao24?: string;
  callsign?: string;
  originCountry?: string;
  lastContact?: number;
  longitude?: number | null;
  latitude?: number | null;
  baroAltitude?: number | null;
  onGround?: boolean;
  velocity?: number | null;
  heading?: number | null;
  verticalRate?: number | null;
  geoAltitude?: number | null;
} = {}): unknown[] {
  return [
    icao24,          // 0
    callsign,        // 1
    originCountry,   // 2
    null,            // 3 time_position
    lastContact,     // 4 last_contact
    longitude,       // 5
    latitude,        // 6
    baroAltitude,    // 7
    onGround,        // 8
    velocity,        // 9
    heading,         // 10
    verticalRate,    // 11
    null,            // 12 sensors
    geoAltitude,     // 13
  ];
}

/** Build a minimal successful fetch Response stub. */
function makeFetchResponse(body: unknown, status = 200): object {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (_name: string) => null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** Build a 429 (rate-limited) fetch Response stub. */
function makeRateLimitResponse(retryAfterSeconds?: number): object {
  return {
    ok: false,
    status: 429,
    headers: {
      get: (name: string) => (name === 'retry-after' ? String(retryAfterSeconds ?? 60) : null),
    },
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  };
}

function makeService(): FlightTrackerService {
  return new FlightTrackerService({
    name: 'test-flight-tracker',
    enabled: true,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('FlightTrackerService', () => {
  let service: FlightTrackerService;

  beforeEach(() => {
    service = makeService();
    // Default: OpenSky returns an empty state list (no flights, no errors)
    (global as any).fetch.mockResolvedValue(makeFetchResponse(makeOpenSkyPayload([])));
  });

  afterEach(async () => {
    const st = (service.getStatus() as any);
    if (st.status === 'running') {
      await service.stop();
    }
  });

  // -------------------------------------------------------------------------
  // Service lifecycle
  // -------------------------------------------------------------------------
  describe('Service Lifecycle', () => {
    it('should start successfully', async () => {
      await service.start();
      expect((service.getStatus() as any).status).toBe('running');
    });

    it('should stop successfully', async () => {
      await service.start();
      await service.stop();
      expect((service.getStatus() as any).status).toBe('stopped');
    });

    it('should have demo flights after start', async () => {
      await service.start();
      const flights = service.getTrackedFlights();
      expect(flights.length).toBeGreaterThan(0);
    });

    it('should reject double-start', async () => {
      await service.start();
      await expect(service.start()).rejects.toThrow();
    });

    it('should have UAL123 demo flight', async () => {
      await service.start();
      const flights = service.getTrackedFlights();
      const ual = flights.find((f) => f.callsign === 'UAL123');
      expect(ual).toBeDefined();
      expect(ual?.origin).toBe('KSFO');
      expect(ual?.destination).toBe('KJFK');
    });

    it('should have DAL456 demo flight', async () => {
      await service.start();
      const flights = service.getTrackedFlights();
      const dal = flights.find((f) => f.callsign === 'DAL456');
      expect(dal).toBeDefined();
      expect(dal?.origin).toBe('KATL');
      expect(dal?.destination).toBe('KLAX');
    });
  });

  // -------------------------------------------------------------------------
  // State-vector parsing
  // -------------------------------------------------------------------------
  describe('State-vector parsing (mapOpenSkyState)', () => {
    function parse(raw: unknown): any {
      return (service as any).mapOpenSkyState(raw);
    }

    it('should parse a well-formed state vector', () => {
      const raw = makeStateVector({
        icao24: 'abc123',
        callsign: 'UAL100 ',
        originCountry: 'United States',
        lastContact: 1700000000,
        longitude: -122.4,
        latitude: 37.8,
        baroAltitude: 10668,
        onGround: false,
        velocity: 230,
        heading: 90,
        verticalRate: -5,
        geoAltitude: 10700,
      });

      const result = parse(raw);
      expect(result).not.toBeNull();
      expect(result.icao24).toBe('abc123');
      expect(result.callsign).toBe('UAL100');  // trimmed
      expect(result.originCountry).toBe('United States');
      expect(result.longitude).toBeCloseTo(-122.4);
      expect(result.latitude).toBeCloseTo(37.8);
      expect(result.baroAltitude).toBe(10668);
      expect(result.onGround).toBe(false);
      expect(result.velocity).toBe(230);
      expect(result.heading).toBe(90);
      expect(result.verticalRate).toBe(-5);
      expect(result.geoAltitude).toBe(10700);
      expect(result.lastContact).toBe(1700000000);
    });

    it('should trim callsign whitespace', () => {
      const raw = makeStateVector({ callsign: '  SWA501  ' });
      const result = parse(raw);
      expect(result).not.toBeNull();
      expect(result.callsign).toBe('SWA501');
    });

    it('should trim icao24 whitespace', () => {
      const raw = makeStateVector({ icao24: ' abc456 ' });
      const result = parse(raw);
      expect(result).not.toBeNull();
      expect(result.icao24).toBe('abc456');
    });

    it('should return null for null longitude', () => {
      const raw = makeStateVector({ longitude: null });
      expect(parse(raw)).toBeNull();
    });

    it('should return null for null latitude', () => {
      const raw = makeStateVector({ latitude: null });
      expect(parse(raw)).toBeNull();
    });

    it('should return null for non-array input', () => {
      expect(parse(null)).toBeNull();
      expect(parse('string')).toBeNull();
      expect(parse({ icao24: 'x' })).toBeNull();
    });

    it('should return null for array shorter than 11 elements', () => {
      expect(parse(['x', 'y'])).toBeNull();
    });

    it('should accept null altitude (aircraft on ground)', () => {
      const raw = makeStateVector({ baroAltitude: null, geoAltitude: null, onGround: true });
      const result = parse(raw);
      expect(result).not.toBeNull();
      expect(result.baroAltitude).toBeNull();
      expect(result.geoAltitude).toBeNull();
      expect(result.onGround).toBe(true);
    });

    it('should accept null velocity', () => {
      const raw = makeStateVector({ velocity: null });
      const result = parse(raw);
      expect(result).not.toBeNull();
      expect(result.velocity).toBeNull();
    });

    it('should accept null heading', () => {
      const raw = makeStateVector({ heading: null });
      const result = parse(raw);
      expect(result).not.toBeNull();
      expect(result.heading).toBeNull();
    });

    it('should use "Unknown" for non-string origin country', () => {
      const raw = makeStateVector({});
      (raw as any)[2] = 42;  // non-string origin country
      const result = parse(raw);
      expect(result).not.toBeNull();
      expect(result.originCountry).toBe('Unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Position / velocity decoding (end-to-end via fetchOpenSkyStates)
  // -------------------------------------------------------------------------
  describe('Position / velocity decoding (fetchOpenSkyStates)', () => {
    it('should decode a single-aircraft payload correctly', async () => {
      const vector = makeStateVector({
        icao24: 'abc123',
        callsign: 'UAL100',
        longitude: -122.4094,
        latitude: 37.7749,
        velocity: 235.5,
        heading: 275.0,
        geoAltitude: 10973,
      });

      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([vector]))
      );

      const states = await (service as any).fetchOpenSkyStates();
      expect(states).toHaveLength(1);
      const s = states[0];
      expect(s.icao24).toBe('abc123');
      expect(s.longitude).toBeCloseTo(-122.4094);
      expect(s.latitude).toBeCloseTo(37.7749);
      expect(s.velocity).toBeCloseTo(235.5);
      expect(s.heading).toBeCloseTo(275.0);
      expect(s.geoAltitude).toBe(10973);
    });

    it('should filter out vectors with missing position', async () => {
      const good = makeStateVector({ icao24: 'aaa111' });
      const noLon = makeStateVector({ icao24: 'bbb222', longitude: null });
      const noLat = makeStateVector({ icao24: 'ccc333', latitude: null });

      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([good, noLon, noLat]))
      );

      const states = await (service as any).fetchOpenSkyStates();
      expect(states).toHaveLength(1);
      expect(states[0].icao24).toBe('aaa111');
    });

    it('should return empty array when payload has no states key', async () => {
      (global as any).fetch.mockResolvedValueOnce(makeFetchResponse({}));
      const states = await (service as any).fetchOpenSkyStates();
      expect(states).toHaveLength(0);
    });

    it('should pass bounding-box query params when bounds provided', async () => {
      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([]))
      );

      const bounds = { lamin: 30, lomin: -130, lamax: 50, lomax: -60 };
      await (service as any).fetchOpenSkyStates(bounds);

      const calledUrl: string = (global as any).fetch.mock.calls[0][0];
      expect(calledUrl).toContain('lamin=30');
      expect(calledUrl).toContain('lomin=-130');
      expect(calledUrl).toContain('lamax=50');
      expect(calledUrl).toContain('lomax=-60');
    });

    it('should include Basic auth header when credentials are set via env', async () => {
      const savedUser = process.env.OPENSKY_USERNAME;
      const savedPass = process.env.OPENSKY_PASSWORD;
      process.env.OPENSKY_USERNAME = 'testuser';
      process.env.OPENSKY_PASSWORD = 'testpass';

      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([]))
      );

      await (service as any).fetchOpenSkyStates();

      const calledOpts: any = (global as any).fetch.mock.calls[0][1];
      expect(calledOpts.headers.Authorization).toMatch(/^Basic /);

      process.env.OPENSKY_USERNAME = savedUser;
      process.env.OPENSKY_PASSWORD = savedPass;
    });

    it('should throw on non-429 HTTP error', async () => {
      (global as any).fetch.mockResolvedValueOnce(makeFetchResponse({}, 503));
      await expect((service as any).fetchOpenSkyStates()).rejects.toThrow('503');
    });
  });

  // -------------------------------------------------------------------------
  // Rate-limit back-off
  // -------------------------------------------------------------------------
  describe('Rate-limit back-off', () => {
    it('should return empty array and set throttle on 429 response', async () => {
      (global as any).fetch.mockResolvedValueOnce(makeRateLimitResponse(30));

      const states = await (service as any).fetchOpenSkyStates();
      expect(states).toHaveLength(0);
      expect((service as any).liveThrottleUntil).toBeGreaterThan(Date.now());
    });

    it('should not fetch while throttled', async () => {
      // Force throttle to a future time
      (service as any).liveThrottleUntil = Date.now() + 60_000;
      (service as any).lastLiveFetch = 0; // would allow fetch if not throttled

      await (service as any).refreshLiveFlights();
      // fetch should NOT have been called at all
      expect((global as any).fetch.mock.calls).toHaveLength(0);
    });

    it('should double backoff on repeated 429', async () => {
      const initial = (service as any).liveBackoffMs as number;

      (global as any).fetch.mockResolvedValue(makeRateLimitResponse());
      await (service as any).fetchOpenSkyStates();
      const afterFirst = (service as any).liveBackoffMs as number;
      expect(afterFirst).toBe(initial * 2);
    });

    it('should reset backoff on successful fetch', async () => {
      (service as any).liveBackoffMs = 120_000; // simulate grown backoff

      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([]))
      );
      await (service as any).fetchOpenSkyStates();
      expect((service as any).liveBackoffMs).toBe((service as any).liveBaseBackoffMs);
    });
  });

  // -------------------------------------------------------------------------
  // Retry-After header parsing
  // -------------------------------------------------------------------------
  describe('parseRetryAfterMs', () => {
    function parse(value: string | null): number | null {
      return (service as any).parseRetryAfterMs(value);
    }

    it('should return null for null input', () => {
      expect(parse(null)).toBeNull();
    });

    it('should parse numeric seconds', () => {
      expect(parse('60')).toBe(60_000);
    });

    it('should parse zero seconds', () => {
      expect(parse('0')).toBe(0);
    });

    it('should parse a future HTTP-date string', () => {
      const futureMs = Date.now() + 30_000;
      const futureDate = new Date(futureMs).toUTCString();
      const result = parse(futureDate);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(32_000);
    });

    it('should return 0 for a past HTTP-date string', () => {
      const past = new Date(Date.now() - 10_000).toUTCString();
      expect(parse(past)).toBe(0);
    });

    it('should return null for a non-parseable string', () => {
      expect(parse('garbage-value')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Stale-track pruning via updateTrackedAircraft
  // -------------------------------------------------------------------------
  describe('Stale-track pruning', () => {
    it('should mark tracked aircraft inactive when absent from live flights', async () => {
      await service.start();

      // Seed a live flight
      const vector = makeStateVector({ icao24: 'abc123' });
      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([vector]))
      );
      await (service as any).refreshLiveFlights();
      const tracked = service.trackAircraft('abc123');
      expect(tracked).toBe(true);

      // Clear live flights and run update — aircraft should become inactive
      (service as any).liveFlights.clear();
      (service as any).updateTrackedAircraft();

      const aircraft = service.getTrackedAircraft()
        .find((a: any) => a.icao24 === 'abc123');
      expect(aircraft).toBeDefined();
      expect(aircraft?.isActive).toBe(false);
    });

    it('should mark tracked aircraft active when it re-appears', async () => {
      await service.start();

      const vector = makeStateVector({ icao24: 'def456', latitude: 37.0, longitude: -122.0 });
      (global as any).fetch.mockResolvedValue(
        makeFetchResponse(makeOpenSkyPayload([vector]))
      );
      await (service as any).refreshLiveFlights();
      service.trackAircraft('def456');

      // Disappear then reappear
      (service as any).liveFlights.clear();
      (service as any).updateTrackedAircraft();

      await (service as any).refreshLiveFlights();
      (service as any).updateTrackedAircraft();

      const aircraft = service.getTrackedAircraft()
        .find((a: any) => a.icao24 === 'def456');
      expect(aircraft?.isActive).toBe(true);
    });

    it('should cap track history at maxTrackPoints', async () => {
      (service as any).maxTrackPoints = 3;
      await service.start();

      const vector = makeStateVector({ icao24: 'ghi789', latitude: 37.0, longitude: -122.0 });
      (global as any).fetch.mockResolvedValue(
        makeFetchResponse(makeOpenSkyPayload([vector]))
      );
      await (service as any).refreshLiveFlights();
      service.trackAircraft('ghi789');

      for (let i = 0; i < 5; i++) {
        (service as any).updateTrackedAircraft();
      }

      const aircraft = service.getTrackedAircraft()
        .find((a: any) => a.icao24 === 'ghi789');
      expect(aircraft?.history.length).toBeLessThanOrEqual(3);
    });

    it('should remove aircraft via untrackAircraft', async () => {
      await service.start();

      const vector = makeStateVector({ icao24: 'jkl012' });
      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([vector]))
      );
      await (service as any).refreshLiveFlights();
      service.trackAircraft('jkl012');
      expect(service.getTrackedAircraft()).toHaveLength(1);

      service.untrackAircraft('jkl012');
      expect(service.getTrackedAircraft()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Weather-overlay join
  // -------------------------------------------------------------------------
  describe('Weather-overlay join', () => {
    it('should return undefined for airports not yet fetched', () => {
      expect(service.getAirportConditions('KORD')).toBeUndefined();
    });

    it('should return undefined for unknown airports', () => {
      expect(service.getAirportConditions('ZZZZ')).toBeUndefined();
    });

    it('should expose getAirportConditions after start (METAR disabled)', async () => {
      // DISABLE_METAR_FETCH=1 (set in tests/setup.ts) means fetchMetarRaw always
      // returns null, so no airports are cached. The method must not throw.
      await service.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const cond = service.getAirportConditions('KSFO');
      if (cond !== undefined) {
        expect(cond).toHaveProperty('icao');
        expect(cond).toHaveProperty('category');
        expect(cond).toHaveProperty('recommendation');
        expect(cond).toHaveProperty('warnings');
      } else {
        expect(cond).toBeUndefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // getLiveFlights bounding-box filter
  // -------------------------------------------------------------------------
  describe('getLiveFlights bounding-box filter', () => {
    it('should return all flights when no bounds specified', async () => {
      await service.start();

      const vectors = [
        makeStateVector({ icao24: 'a1', latitude: 37.0, longitude: -122.0 }),
        makeStateVector({ icao24: 'b2', latitude: 50.0, longitude: 10.0 }),
      ];
      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload(vectors))
      );
      await (service as any).refreshLiveFlights();

      const flights = service.getLiveFlights();
      expect(flights).toHaveLength(2);
    });

    it('should filter flights to bounding box', async () => {
      await service.start();

      const vectors = [
        makeStateVector({ icao24: 'a1', latitude: 37.0, longitude: -122.0 }),
        makeStateVector({ icao24: 'b2', latitude: 50.0, longitude: 10.0 }),
      ];
      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload(vectors))
      );
      await (service as any).refreshLiveFlights();

      const bounds = { lamin: 30, lomin: -130, lamax: 45, lomax: -100 };
      const flights = service.getLiveFlights(bounds);
      expect(flights).toHaveLength(1);
      expect(flights[0].icao24).toBe('a1');
    });
  });

  // -------------------------------------------------------------------------
  // Flight management helpers
  // -------------------------------------------------------------------------
  describe('Flight management helpers', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should add a flight', () => {
      const before = service.getTrackedFlights().length;
      service.addFlight({
        callsign: 'TST100',
        origin: 'KORD',
        destination: 'KDFW',
        altitude: 36000,
        speed: 460,
      });
      expect(service.getTrackedFlights().length).toBe(before + 1);
    });

    it('should remove a flight', () => {
      service.addFlight({ callsign: 'TST200', origin: 'KORD', destination: 'KDFW' });
      const before = service.getTrackedFlights().length;
      service.removeFlight('TST200');
      expect(service.getTrackedFlights().length).toBe(before - 1);
    });

    it('should return tracked flights as an array', () => {
      const flights = service.getTrackedFlights();
      expect(Array.isArray(flights)).toBe(true);
    });

    it('trackAircraft should return false when aircraft not in live map', () => {
      const result = service.trackAircraft('notexist');
      expect(result).toBe(false);
    });

    it('trackAircraft should return true when aircraft is in live map', async () => {
      const vector = makeStateVector({ icao24: 'lmn345' });
      (global as any).fetch.mockResolvedValueOnce(
        makeFetchResponse(makeOpenSkyPayload([vector]))
      );
      await (service as any).refreshLiveFlights();

      const result = service.trackAircraft('lmn345');
      expect(result).toBe(true);
      expect(service.getTrackedAircraft()).toHaveLength(1);
    });
  });
});
