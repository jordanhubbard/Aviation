/**
 * Aviation Map Framework - Engine Display Component
 */

import React from 'react';

export interface EngineDisplayProps {
  /**
   * Engine RPM
   */
  rpm: number;

  /**
   * Engine temperature in Celsius
   */
  temperature: number;

  /**
   * Fuel level percentage
   */
  fuelLevel: number;
}

/**
 * Engine display component for showing engine instruments
 *
 * @example
 * ```tsx
 * <EngineDisplay 
 *   rpm={2500} 
 *   temperature={85} 
 *   fuelLevel={75}
 * />
 * ```
 */
export const EngineDisplay: React.FC<EngineDisplayProps> = ({
  rpm,
  temperature,
  fuelLevel,
}) => {
  return (
    <div className="engine-display">
      <div>RPM: {rpm}</div>
      <div>Temperature: {temperature}°C</div>
      <div>Fuel Level: {fuelLevel}%</div>
    </div>
  );
};
