/**
 * Google Calendar Integration - Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  parseDateTime,
  createSimpleEvent,
  generateRRule,
  addReminder,
  getEventDuration,
  isAllDayEvent,
  isRecurringEvent,
} from '../utils';

describe('formatDateTime', () => {
  it('should format date/time correctly', () => {
    const date = new Date('2026-01-15T10:00:00Z');
    const result = formatDateTime(date, 'America/Los_Angeles');
    
    expect(result.dateTime).toBe('2026-01-15T10:00:00.000Z');
    expect(result.timeZone).toBe('America/Los_Angeles');
    expect(result.date).toBeUndefined();
  });

  it('should format all-day events', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const result = formatDateTime(date, 'UTC', true);
    
    expect(result.date).toBe('2026-01-15');
    expect(result.dateTime).toBeUndefined();
  });
});

describe('parseDateTime', () => {
  it('should parse dateTime format', () => {
    const result = parseDateTime({
      dateTime: '2026-01-15T10:00:00Z',
      timeZone: 'UTC',
    });
    
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('should parse date format', () => {
    const result = parseDateTime({ date: '2026-01-15' });
    
    expect(result).toBeInstanceOf(Date);
  });

  it('should throw on invalid input', () => {
    expect(() => parseDateTime({} as any)).toThrow();
  });
});

describe('createSimpleEvent', () => {
  it('should create a simple event', () => {
    const start = new Date('2026-01-15T10:00:00Z');
    const end = new Date('2026-01-15T11:00:00Z');
    
    const event = createSimpleEvent('Test Event', start, end, {
      description: 'Test description',
      location: 'Test location',
    });
    
    expect(event.summary).toBe('Test Event');
    expect(event.description).toBe('Test description');
    expect(event.location).toBe('Test location');
    expect(event.start.dateTime).toBeTruthy();
    expect(event.end.dateTime).toBeTruthy();
  });

  it('should create all-day event', () => {
    const start = new Date('2026-01-15');
    const end = new Date('2026-01-16');
    
    const event = createSimpleEvent('All Day Event', start, end, {
      allDay: true,
    });
    
    expect(event.start.date).toBe('2026-01-15');
    expect(event.end.date).toBe('2026-01-16');
  });
});

describe('generateRRule', () => {
  it('should generate daily recurrence', () => {
    const result = generateRRule({ freq: 'DAILY', count: 10 });
    expect(result).toBe('RRULE:FREQ=DAILY;COUNT=10');
  });

  it('should generate weekly recurrence with byDay', () => {
    const result = generateRRule({
      freq: 'WEEKLY',
      byDay: ['MO', 'WE', 'FR'],
    });
    expect(result).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('should generate with interval', () => {
    const result = generateRRule({ freq: 'DAILY', interval: 2, count: 5 });
    expect(result).toBe('RRULE:FREQ=DAILY;COUNT=5;INTERVAL=2');
  });

  it('should generate with until date', () => {
    const result = generateRRule({
      freq: 'WEEKLY',
      until: '2026-12-31T00:00:00Z',
    });
    expect(result).toContain('RRULE:FREQ=WEEKLY;UNTIL=');
  });
});

describe('addReminder', () => {
  it('should add reminder to event', () => {
    const event = createSimpleEvent(
      'Test',
      new Date(),
      new Date()
    );
    
    addReminder(event, 15, 'popup');
    
    expect(event.reminders).toBeDefined();
    expect(event.reminders!.useDefault).toBe(false);
    expect(event.reminders!.overrides).toHaveLength(1);
    expect(event.reminders!.overrides![0]).toEqual({
      method: 'popup',
      minutes: 15,
    });
  });

  it('should add multiple reminders', () => {
    const event = createSimpleEvent(
      'Test',
      new Date(),
      new Date()
    );
    
    addReminder(event, 15, 'popup');
    addReminder(event, 60, 'email');
    
    expect(event.reminders!.overrides).toHaveLength(2);
  });
});

describe('getEventDuration', () => {
  it('should calculate duration in minutes', () => {
    const start = new Date('2026-01-15T10:00:00Z');
    const end = new Date('2026-01-15T11:30:00Z');
    
    const event = createSimpleEvent('Test', start, end);
    const duration = getEventDuration(event);
    
    expect(duration).toBe(90);
  });
});

describe('isAllDayEvent', () => {
  it('should identify all-day events', () => {
    const start = new Date('2026-01-15');
    const end = new Date('2026-01-16');
    
    const event = createSimpleEvent('Test', start, end, { allDay: true });
    
    expect(isAllDayEvent(event)).toBe(true);
  });

  it('should identify timed events', () => {
    const start = new Date('2026-01-15T10:00:00Z');
    const end = new Date('2026-01-15T11:00:00Z');
    
    const event = createSimpleEvent('Test', start, end);
    
    expect(isAllDayEvent(event)).toBe(false);
  });
});

describe('isRecurringEvent', () => {
  it('should identify recurring events', () => {
    const event = createSimpleEvent(
      'Test',
      new Date(),
      new Date()
    );
    event.recurrence = ['RRULE:FREQ=DAILY;COUNT=10'];
    
    expect(isRecurringEvent(event)).toBe(true);
  });

  it('should identify non-recurring events', () => {
    const event = createSimpleEvent(
      'Test',
      new Date(),
      new Date()
    );
    
    expect(isRecurringEvent(event)).toBe(false);
  });
});
