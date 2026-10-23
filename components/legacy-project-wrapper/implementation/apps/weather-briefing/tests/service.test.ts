/**
 * Weather Briefing Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WeatherBriefingService } from '../src/service';

describe('WeatherBriefingService', () => {
  let service: WeatherBriefingService;

  beforeEach(() => {
    service = new WeatherBriefingService({
      name: 'test-weather-briefing',
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
  });

  describe('Airport Briefings', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should generate airport briefing', async () => {
      const briefing = await service.generateAirportBriefing('KSFO');
      
      expect(briefing).toBeDefined();
      expect(briefing.icao).toBe('KSFO');
      expect(briefing.category).toMatch(/VFR|MVFR|IFR|LIFR|UNKNOWN/);
      expect(briefing.briefing).toContain('KSFO');
    });

    it('should cache airport briefings', async () => {
      await service.generateAirportBriefing('KJFK');
      
      const stats = service.getCacheStats();
      expect(stats.airports).toBeGreaterThan(0);
    });

    it('should throw for invalid airport', async () => {
      await expect(
        service.generateAirportBriefing('XXXX')
      ).rejects.toThrow('No METAR available');
    });
  });

  describe('Route Briefings', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should generate route briefing', async () => {
      const route = await service.generateRouteBriefing('KSFO', 'KJFK');
      
      expect(route).toBeDefined();
      expect(route.departure).toBe('KSFO');
      expect(route.destination).toBe('KJFK');
      expect(route.briefings.length).toBe(2);
      expect(route.overallCategory).toMatch(/VFR|MVFR|IFR|LIFR|UNKNOWN/);
    });

    it('should include alternates in route', async () => {
      const route = await service.generateRouteBriefing(
        'KSFO',
        'KJFK',
        ['KORD']
      );
      
      expect(route.briefings.length).toBe(3);
      expect(route.route).toContain('KORD');
    });

    it('should cache route briefings', async () => {
      await service.generateRouteBriefing('KATL', 'KLAX');
      
      const stats = service.getCacheStats();
      expect(stats.routes).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await service.start();
    });

    it('should clear cache', async () => {
      await service.generateAirportBriefing('KSFO');
      await service.generateRouteBriefing('KATL', 'KLAX');
      
      let stats = service.getCacheStats();
      expect(stats.airports).toBeGreaterThan(0);
      expect(stats.routes).toBeGreaterThan(0);
      
      service.clearCache();
      
      stats = service.getCacheStats();
      expect(stats.airports).toBe(0);
      expect(stats.routes).toBe(0);
    });

    it('should return cache stats', async () => {
      const stats = service.getCacheStats();
      expect(stats).toHaveProperty('airports');
      expect(stats).toHaveProperty('routes');
    });
  });
});

// TODO: Add tests for getBestDepartureWindows()
// TODO: Add tests for briefing formatting
// TODO: Add tests for cache TTL expiration
// TODO: Add integration tests with real METAR data
