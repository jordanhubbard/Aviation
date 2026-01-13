/**
 * Base interface for source adapters
 */

import type { EventRecord } from '../types';

export interface SourceAdapter {
  /**
   * Fetch recent events from source
   * @param windowDays Number of days to look back
   */
  fetchRecent(windowDays: number): Promise<EventRecord[]>;
  
  /**
   * Source identifier
   */
  readonly sourceName: string;
}

/**
 * Normalize a date string to UTC (YYYY-MM-DD)
 */
export function normalizeToUTC(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Check if date is >= 2000-01-01
 */
export function isWithinRetentionWindow(dateZ: string): boolean {
  return dateZ >= '2000-01-01';
}
