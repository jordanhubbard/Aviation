/**
 * Navigation utilities for aviation applications
 * 
 * Provides comprehensive navigation calculations including:
 * - Distance calculations (great circle, Haversine)
 * - Bearing calculations (initial, final, magnetic)
 * - Wind correction and ground speed
 * - Time/speed/distance problems
 * - Fuel calculations
 * 
 * @module aviation/navigation
 */

// Export all types
export * from './types.js';

// Export distance functions
export * from './distance.js';

// Export bearing functions
export * from './bearing.js';

// Export wind functions
export * from './wind.js';

// Export calculation functions
export * from './calculations.js';
