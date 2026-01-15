/**
 * Aircraft classification: General Aviation vs Commercial
 */

import type { Category } from './types.js';

// Known airline/commercial operators
const COMMERCIAL_OPERATORS = new Set([
  'american airlines', 'delta', 'united airlines', 'southwest airlines',
  'fedex', 'ups airlines', 'dhl', 'atlas air', 'air france', 'lufthansa',
  'british airways', 'qantas', 'emirates', 'cathay pacific', 'air canada',
  'westjet', 'alaska airlines', 'jetblue', 'spirit airlines', 'frontier',
  'allegiant', 'hawaiian airlines', 'cargo', 'express'
]);

// General aviation indicators
const GA_INDICATORS = ['private', 'owner', 'llc', 'aviation club', 'flying club'];

// Commercial aircraft types (jets, turboprops > 19 seats)
const COMMERCIAL_TYPES = [
  'boeing 737', 'b737', 'boeing 747', 'b747', 'boeing 757', 'b757',
  'boeing 767', 'b767', 'boeing 777', 'b777', 'boeing 787', 'b787',
  'airbus a320', 'a320', 'airbus a330', 'a330', 'airbus a340', 'a340',
  'airbus a350', 'a350', 'airbus a380', 'a380', 'embraer', 'crj', 'bombardier'
];

// Small GA aircraft types
const GA_TYPES = [
  'cessna 172', 'cessna 182', 'piper pa-28', 'piper archer', 'piper cherokee',
  'beechcraft bonanza', 'cirrus sr22', 'diamond da40', 'mooney', 'grumman',
  'cessna 150', 'cessna 152'
];

export class AircraftClassifier {
  /**
   * Classify aircraft as General Aviation, Commercial, or Unknown
   */
  classify(operator?: string, aircraftType?: string): Category {
    if (!operator && !aircraftType) {
      return 'unknown';
    }

    const opLower = operator?.toLowerCase() || '';
    const typeLower = aircraftType?.toLowerCase() || '';

    // Check for commercial indicators
    if (this.isCommercial(opLower, typeLower)) {
      return 'commercial';
    }

    // Check for GA indicators
    if (this.isGeneralAviation(opLower, typeLower)) {
      return 'general';
    }

    return 'unknown';
  }

  private isCommercial(operator: string, aircraftType: string): boolean {
    // Check operator against known commercial carriers
    for (const carrier of COMMERCIAL_OPERATORS) {
      if (operator.includes(carrier)) {
        return true;
      }
    }

    // Check aircraft type for commercial jets/turboprops
    for (const type of COMMERCIAL_TYPES) {
      if (aircraftType.includes(type)) {
        return true;
      }
    }

    // Airlines, cargo, express typically commercial
    if (operator.includes('airline') || operator.includes('cargo') || 
        operator.includes('express') || operator.includes('air freight')) {
      return true;
    }

    return false;
  }

  private isGeneralAviation(operator: string, aircraftType: string): boolean {
    // Check for explicit GA indicators
    for (const indicator of GA_INDICATORS) {
      if (operator.includes(indicator)) {
        return true;
      }
    }

    // Check aircraft type for small GA planes
    for (const type of GA_TYPES) {
      if (aircraftType.includes(type)) {
        return true;
      }
    }

    // N-number only operators typically GA
    if (/^n\d{1,5}[a-z]{0,2}$/i.test(operator.trim())) {
      return true;
    }

    return false;
  }
}

export const classifier = new AircraftClassifier();
