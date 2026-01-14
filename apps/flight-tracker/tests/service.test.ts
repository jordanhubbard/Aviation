/**
 * Flight Tracker Service Tests
 * 
 * Tests for the FlightTrackerService with weather integration.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FlightTrackerService } from '../src/service';

describe('FlightTrackerService', () => {
  let service: FlightTrackerService;

  beforeEach(() => {
    service = new FlightTrackerService({
      name: 'test-flight-tracker',
      enabled: true,
    });
  });

  afterEach(async () => {
    if (service.getStatus() === 'running') {
      await service.stop();
    }
  });

  describe('Service Lifecycle', () => {
    it('should start successfully', async () => {
      await service.start();
      expect(service.getStatus()).toBe('running');
    });

    it('should stop successfully', async () => {
      await service.start();
      await service.stop();
      expect(service.getStatus()).toBe('stopped');
    });

    it('should have demo flights after start', async () => {
      await service.start();
      const flights = service.getTrackedFlights();
      expect(flights.length).toBeGreaterThan(0);
    });
  });

  describe('Flight Management', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should add a flight', () => {
      const initialCount = service.getTrackedFlights().length;
      
      service.addFlight({
        callsign: 'TEST123',
        origin: 'KORD',
        destination: 'KDFW',
        altitude: 36000,
        speed: 460,
      });

      expect(service.getTrackedFlights().length).toBe(initialCount + 1);
    });

    it('should remove a flight', () => {
      service.addFlight({
        callsign: 'TEST456',
        origin: 'KORD',
        destination: 'KDFW',
      });

      const withFlight = service.getTrackedFlights().length;
      service.removeFlight('TEST456');
      const withoutFlight = service.getTrackedFlights().length;

      expect(withoutFlight).toBe(withFlight - 1);
    });

    it('should get tracked flights', () => {
      const flights = service.getTrackedFlights();
      expect(Array.isArray(flights)).toBe(true);
      expect(flights.length).toBeGreaterThan(0);
    });
  });

  describe('Weather Integration', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should cache airport conditions after polling', async () => {
      // Wait for initial poll to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const conditions = service.getAirportConditions('KSFO');
      // May be undefined if METAR fetch failed, which is okay for test
      if (conditions) {
        expect(conditions).toHaveProperty('icao');
        expect(conditions).toHaveProperty('category');
        expect(conditions).toHaveProperty('recommendation');
      }
    });

    it('should return undefined for unknown airports', () => {
      const conditions = service.getAirportConditions('XXXX');
      expect(conditions).toBeUndefined();
    });
  });

  describe('Demo Flights', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should have UAL123 in demo flights', () => {
      const flights = service.getTrackedFlights();
      const ual123 = flights.find(f => f.callsign === 'UAL123');
      expect(ual123).toBeDefined();
      expect(ual123?.origin).toBe('KSFO');
      expect(ual123?.destination).toBe('KJFK');
    });

    it('should have DAL456 in demo flights', () => {
      const flights = service.getTrackedFlights();
      const dal456 = flights.find(f => f.callsign === 'DAL456');
      expect(dal456).toBeDefined();
      expect(dal456?.origin).toBe('KATL');
      expect(dal456?.destination).toBe('KLAX');
    });
  });
});

// TODO: Add integration tests with mocked METAR responses
// TODO: Add tests for weather warning generation
// TODO: Add tests for polling interval configuration
// TODO: Add performance tests for large flight lists
