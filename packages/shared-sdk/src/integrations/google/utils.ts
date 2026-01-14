/**
 * Google Calendar Integration - Utility Functions
 */

import type { CalendarEvent, CalendarDateTime, RecurrenceRule } from './types';

/**
 * Format a Date object to CalendarDateTime format
 * 
 * @param date JavaScript Date object
 * @param timeZone Optional timezone (default: UTC)
 * @param allDay Whether this is an all-day event
 * @returns CalendarDateTime object
 */
export function formatDateTime(
  date: Date,
  timeZone: string = 'UTC',
  allDay: boolean = false
): CalendarDateTime {
  if (allDay) {
    // All-day events use date format YYYY-MM-DD in UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
    };
  }

  return {
    dateTime: date.toISOString(),
    timeZone,
  };
}

/**
 * Parse CalendarDateTime to Date object
 * 
 * @param calendarDateTime CalendarDateTime object
 * @returns JavaScript Date object
 */
export function parseDateTime(calendarDateTime: CalendarDateTime): Date {
  if (calendarDateTime.dateTime) {
    return new Date(calendarDateTime.dateTime);
  }
  if (calendarDateTime.date) {
    return new Date(calendarDateTime.date);
  }
  throw new Error('Invalid CalendarDateTime: missing dateTime or date');
}

/**
 * Create a simple event helper
 * 
 * @param summary Event title
 * @param start Start date/time
 * @param end End date/time
 * @param options Additional event options
 * @returns CalendarEvent object
 */
export function createSimpleEvent(
  summary: string,
  start: Date,
  end: Date,
  options: {
    description?: string;
    location?: string;
    timeZone?: string;
    allDay?: boolean;
  } = {}
): CalendarEvent {
  return {
    summary,
    description: options.description,
    location: options.location,
    start: formatDateTime(start, options.timeZone, options.allDay),
    end: formatDateTime(end, options.timeZone, options.allDay),
  };
}

/**
 * Generate RRULE string from RecurrenceRule object
 * 
 * @param rule Recurrence rule object
 * @returns RFC 5545 RRULE string
 * 
 * @example
 * generateRRule({ freq: 'WEEKLY', count: 10, byDay: ['MO', 'WE', 'FR'] })
 * // Returns: 'RRULE:FREQ=WEEKLY;COUNT=10;BYDAY=MO,WE,FR'
 */
export function generateRRule(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.freq}`];

  if (rule.count !== undefined) {
    parts.push(`COUNT=${rule.count}`);
  }

  if (rule.until) {
    // Convert ISO string to RRULE format (YYYYMMDDTHHMMSSZ)
    const date = new Date(rule.until);
    const formatted = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${formatted}`);
  }

  if (rule.interval !== undefined && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }

  return `RRULE:${parts.join(';')}`;
}

/**
 * Create recurring event helper
 * 
 * @param summary Event title
 * @param start Start date/time
 * @param end End date/time
 * @param recurrence Recurrence rule
 * @param options Additional event options
 * @returns CalendarEvent object with recurrence
 */
export function createRecurringEvent(
  summary: string,
  start: Date,
  end: Date,
  recurrence: RecurrenceRule,
  options: {
    description?: string;
    location?: string;
    timeZone?: string;
  } = {}
): CalendarEvent {
  return {
    summary,
    description: options.description,
    location: options.location,
    start: formatDateTime(start, options.timeZone),
    end: formatDateTime(end, options.timeZone),
    recurrence: [generateRRule(recurrence)],
  };
}

/**
 * Add reminder to event
 * 
 * @param event Event to add reminder to
 * @param minutes Minutes before event to remind
 * @param method Reminder method ('email' or 'popup')
 * @returns Updated event
 */
export function addReminder(
  event: CalendarEvent,
  minutes: number,
  method: 'email' | 'popup' = 'popup'
): CalendarEvent {
  if (!event.reminders) {
    event.reminders = {
      useDefault: false,
      overrides: [],
    };
  }

  if (!event.reminders.overrides) {
    event.reminders.overrides = [];
  }

  event.reminders.overrides.push({ method, minutes });
  return event;
}

/**
 * Calculate duration of event in minutes
 * 
 * @param event Calendar event
 * @returns Duration in minutes
 */
export function getEventDuration(event: CalendarEvent): number {
  const start = parseDateTime(event.start);
  const end = parseDateTime(event.end);
  return (end.getTime() - start.getTime()) / (1000 * 60);
}

/**
 * Check if event is all-day
 * 
 * @param event Calendar event
 * @returns True if event is all-day
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return Boolean(event.start.date && event.end.date);
}

/**
 * Check if event is recurring
 * 
 * @param event Calendar event
 * @returns True if event has recurrence rules
 */
export function isRecurringEvent(event: CalendarEvent): boolean {
  return Boolean(event.recurrence && event.recurrence.length > 0);
}

/**
 * Format event for display
 * 
 * @param event Calendar event
 * @returns Formatted string
 */
export function formatEventDisplay(event: CalendarEvent): string {
  const start = parseDateTime(event.start);
  const end = parseDateTime(event.end);
  const isAllDay = isAllDayEvent(event);

  if (isAllDay) {
    return `${event.summary} (All day on ${start.toLocaleDateString()})`;
  }

  return `${event.summary} (${start.toLocaleString()} - ${end.toLocaleTimeString()})`;
}
