/**
 * Aviation Map Framework - Icon Utilities
 */

import L from 'leaflet';
import type { FlightCategory } from '../types';
import { CATEGORY_COLORS } from '../constants';

/**
 * Generate SVG for wind barb
 * Wind barbs follow meteorological standards
 */
export function windBarbSvg(
  direction: number,
  speedKts: number,
  options: {
    size?: number;
    backgroundFill?: string;
    backgroundStroke?: string;
  } = {}
): string {
  const { size = 40, backgroundFill, backgroundStroke } = options;
  const center = size / 2;
  
  // Normalize direction to 0-360
  const dir = ((direction % 360) + 360) % 360;
  
  // Calculate barb length based on speed
  const barbLength = Math.min(size * 0.4, 16);
  
  // Round speed to nearest 5 knots for barb rendering
  const roundedSpeed = Math.round(speedKts / 5) * 5;
  
  // Calculate number of flags (50kt), full barbs (10kt), and half barbs (5kt)
  const flags = Math.floor(roundedSpeed / 50);
  const fullBarbs = Math.floor((roundedSpeed % 50) / 10);
  const halfBarb = (roundedSpeed % 10) >= 5 ? 1 : 0;
  
  // Rotation: wind direction indicates where wind is coming FROM
  // We want the barb to point in that direction
  const rotation = dir;
  
  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background circle if provided
  if (backgroundFill) {
    svg += `<circle cx="${center}" cy="${center}" r="${center - 2}" 
      fill="${backgroundFill}" 
      stroke="${backgroundStroke || '#ffffff'}" 
      stroke-width="2"/>`;
  }
  
  svg += `<g transform="rotate(${rotation} ${center} ${center})">`;
  
  // Draw shaft (pointing up)
  svg += `<line x1="${center}" y1="${center}" x2="${center}" y2="${center - barbLength}" 
    stroke="${backgroundFill ? '#ffffff' : '#000000'}" stroke-width="2"/>`;
  
  // Draw flags and barbs
  let offset = 2;
  const flagHeight = 4;
  const barbSpacing = 3;
  
  // Flags (50kt each)
  for (let i = 0; i < flags; i++) {
    const y = center - barbLength + offset;
    svg += `<path d="M ${center} ${y} L ${center + 6} ${y + flagHeight} L ${center} ${y + flagHeight * 2} Z" 
      fill="${backgroundFill ? '#ffffff' : '#000000'}"/>`;
    offset += flagHeight * 2 + barbSpacing;
  }
  
  // Full barbs (10kt each)
  for (let i = 0; i < fullBarbs; i++) {
    const y = center - barbLength + offset;
    svg += `<line x1="${center}" y1="${y}" x2="${center + 6}" y2="${y + 3}" 
      stroke="${backgroundFill ? '#ffffff' : '#000000'}" stroke-width="2"/>`;
    offset += barbSpacing;
  }
  
  // Half barb (5kt)
  if (halfBarb) {
    const y = center - barbLength + offset;
    svg += `<line x1="${center}" y1="${y}" x2="${center + 3}" y2="${y + 1.5}" 
      stroke="${backgroundFill ? '#ffffff' : '#000000'}" stroke-width="2"/>`;
  }
  
  svg += '</g></svg>';
  
  return svg;
}

/**
 * Create a wind barb icon for Leaflet
 */
export function createWindBarbIcon(
  direction: number,
  speedKts: number,
  category?: FlightCategory,
  size: number = 40
): L.DivIcon {
  const colors = category ? CATEGORY_COLORS[category] : undefined;
  const hasCategory = category && category !== 'UNKNOWN';
  
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: windBarbSvg(
      direction,
      speedKts,
      hasCategory
        ? {
            size,
            backgroundFill: colors!.fill,
            backgroundStroke: colors!.stroke,
          }
        : { size }
    ),
  });
}

/**
 * Create a simple circle marker icon
 */
export function createCircleIcon(
  color: string,
  size: number = 12,
  stroke: string = '#ffffff',
  strokeWidth: number = 2
): L.DivIcon {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - strokeWidth}" 
        fill="${color}" 
        stroke="${stroke}" 
        stroke-width="${strokeWidth}"/>
    </svg>
  `;
  
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: svg,
  });
}

/**
 * Create an airplane icon
 */
export function createAirplaneIcon(
  color: string = '#1976d2',
  size: number = 24,
  rotation: number = 0
): L.DivIcon {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <g transform="rotate(${rotation} 12 12)">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" 
          fill="${color}"/>
      </g>
    </svg>
  `;
  
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: svg,
  });
}

/**
 * Utility to validate and normalize flight category
 */
export function toFlightCategory(value: string | null | undefined): FlightCategory {
  if (value === 'VFR' || value === 'MVFR' || value === 'IFR' || value === 'LIFR') {
    return value;
  }
  return 'UNKNOWN';
}
