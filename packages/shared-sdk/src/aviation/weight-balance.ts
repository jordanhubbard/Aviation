/**
 * Aircraft Weight and Balance Calculations
 *
 * Provides utilities for calculating aircraft weight, center of gravity,
 * and determining if loading is within acceptable limits.
 *
 * @module @aviation/shared-sdk/aviation/weight-balance
 */

export interface Station {
  name: string;
  weight: number; // pounds
  arm: number; // inches from datum
}

export interface AircraftProfile {
  id: string;
  name: string;
  type: string; // e.g., "C172", "PA28", "SR22"
  emptyWeight: number; // pounds
  emptyMoment: number; // pound-inches
  emptyArm: number; // inches
  maxGrossWeight: number; // pounds
  fuelCapacity: number; // gallons
  fuelWeightPerGallon: number; // pounds (default 6.0 for 100LL)
  stations: {
    pilot: { arm: number; maxWeight?: number };
    copilot: { arm: number; maxWeight?: number };
    rearSeats?: { arm: number; maxWeight?: number };
    baggage1?: { arm: number; maxWeight?: number };
    baggage2?: { arm: number; maxWeight?: number };
    fuel: { arm: number };
  };
  cgLimits: CGLimit[];
}

export interface CGLimit {
  weight: number; // pounds
  forwardCG: number; // inches
  aftCG: number; // inches
}

export interface WeightBalanceResult {
  totalWeight: number; // pounds
  totalMoment: number; // pound-inches
  cgPosition: number; // inches from datum
  isWithinLimits: boolean;
  warnings: string[];
  forwardLimit: number; // inches
  aftLimit: number; // inches
  stations: Station[];
}

/**
 * Calculate total weight and moment
 */
export function calculateWeightAndBalance(
  aircraft: AircraftProfile,
  loading: {
    pilot: number;
    copilot?: number;
    rearSeats?: number;
    baggage1?: number;
    baggage2?: number;
    fuelGallons: number;
  }
): WeightBalanceResult {
  const stations: Station[] = [];
  let totalWeight = aircraft.emptyWeight;
  let totalMoment = aircraft.emptyMoment;
  const warnings: string[] = [];

  // Add empty aircraft
  stations.push({
    name: 'Empty Aircraft',
    weight: aircraft.emptyWeight,
    arm: aircraft.emptyArm,
  });

  // Add pilot
  if (loading.pilot > 0) {
    stations.push({
      name: 'Pilot',
      weight: loading.pilot,
      arm: aircraft.stations.pilot.arm,
    });
    totalWeight += loading.pilot;
    totalMoment += loading.pilot * aircraft.stations.pilot.arm;

    if (aircraft.stations.pilot.maxWeight && loading.pilot > aircraft.stations.pilot.maxWeight) {
      warnings.push(`Pilot weight (${loading.pilot} lbs) exceeds max (${aircraft.stations.pilot.maxWeight} lbs)`);
    }
  }

  // Add copilot
  if (loading.copilot && loading.copilot > 0) {
    stations.push({
      name: 'Co-pilot',
      weight: loading.copilot,
      arm: aircraft.stations.copilot.arm,
    });
    totalWeight += loading.copilot;
    totalMoment += loading.copilot * aircraft.stations.copilot.arm;

    if (aircraft.stations.copilot.maxWeight && loading.copilot > aircraft.stations.copilot.maxWeight) {
      warnings.push(`Co-pilot weight (${loading.copilot} lbs) exceeds max (${aircraft.stations.copilot.maxWeight} lbs)`);
    }
  }

  // Add rear seats
  if (loading.rearSeats && loading.rearSeats > 0 && aircraft.stations.rearSeats) {
    stations.push({
      name: 'Rear Seats',
      weight: loading.rearSeats,
      arm: aircraft.stations.rearSeats.arm,
    });
    totalWeight += loading.rearSeats;
    totalMoment += loading.rearSeats * aircraft.stations.rearSeats.arm;

    if (aircraft.stations.rearSeats.maxWeight && loading.rearSeats > aircraft.stations.rearSeats.maxWeight) {
      warnings.push(`Rear seats weight (${loading.rearSeats} lbs) exceeds max (${aircraft.stations.rearSeats.maxWeight} lbs)`);
    }
  }

  // Add baggage 1
  if (loading.baggage1 && loading.baggage1 > 0 && aircraft.stations.baggage1) {
    stations.push({
      name: 'Baggage 1',
      weight: loading.baggage1,
      arm: aircraft.stations.baggage1.arm,
    });
    totalWeight += loading.baggage1;
    totalMoment += loading.baggage1 * aircraft.stations.baggage1.arm;

    if (aircraft.stations.baggage1.maxWeight && loading.baggage1 > aircraft.stations.baggage1.maxWeight) {
      warnings.push(`Baggage 1 weight (${loading.baggage1} lbs) exceeds max (${aircraft.stations.baggage1.maxWeight} lbs)`);
    }
  }

  // Add baggage 2
  if (loading.baggage2 && loading.baggage2 > 0 && aircraft.stations.baggage2) {
    stations.push({
      name: 'Baggage 2',
      weight: loading.baggage2,
      arm: aircraft.stations.baggage2.arm,
    });
    totalWeight += loading.baggage2;
    totalMoment += loading.baggage2 * aircraft.stations.baggage2.arm;

    if (aircraft.stations.baggage2.maxWeight && loading.baggage2 > aircraft.stations.baggage2.maxWeight) {
      warnings.push(`Baggage 2 weight (${loading.baggage2} lbs) exceeds max (${aircraft.stations.baggage2.maxWeight} lbs)`);
    }
  }

  // Add fuel
  const fuelWeight = loading.fuelGallons * aircraft.fuelWeightPerGallon;
  if (fuelWeight > 0) {
    stations.push({
      name: 'Fuel',
      weight: fuelWeight,
      arm: aircraft.stations.fuel.arm,
    });
    totalWeight += fuelWeight;
    totalMoment += fuelWeight * aircraft.stations.fuel.arm;

    if (loading.fuelGallons > aircraft.fuelCapacity) {
      warnings.push(`Fuel (${loading.fuelGallons} gal) exceeds capacity (${aircraft.fuelCapacity} gal)`);
    }
  }

  // Calculate CG position
  const cgPosition = totalWeight > 0 ? totalMoment / totalWeight : 0;

  // Check weight limits
  if (totalWeight > aircraft.maxGrossWeight) {
    warnings.push(`Total weight (${totalWeight.toFixed(1)} lbs) exceeds max gross weight (${aircraft.maxGrossWeight} lbs)`);
  }

  // Find applicable CG limits for this weight
  const { forwardLimit, aftLimit } = getCGLimitsForWeight(aircraft.cgLimits, totalWeight);

  // Check CG limits
  const isWithinLimits = cgPosition >= forwardLimit && cgPosition <= aftLimit && totalWeight <= aircraft.maxGrossWeight;

  if (cgPosition < forwardLimit) {
    warnings.push(`CG (${cgPosition.toFixed(2)}") is forward of limit (${forwardLimit.toFixed(2)}")`);
  } else if (cgPosition > aftLimit) {
    warnings.push(`CG (${cgPosition.toFixed(2)}") is aft of limit (${aftLimit.toFixed(2)}")`);
  }

  return {
    totalWeight: parseFloat(totalWeight.toFixed(1)),
    totalMoment: parseFloat(totalMoment.toFixed(1)),
    cgPosition: parseFloat(cgPosition.toFixed(2)),
    isWithinLimits,
    warnings,
    forwardLimit: parseFloat(forwardLimit.toFixed(2)),
    aftLimit: parseFloat(aftLimit.toFixed(2)),
    stations,
  };
}

/**
 * Get CG limits for a specific weight (interpolate if necessary)
 */
export function getCGLimitsForWeight(
  cgLimits: CGLimit[],
  weight: number
): { forwardLimit: number; aftLimit: number } {
  if (cgLimits.length === 0) {
    throw new Error('No CG limits defined');
  }

  // Sort limits by weight
  const sorted = [...cgLimits].sort((a, b) => a.weight - b.weight);

  // If weight is below or at the lowest limit
  if (weight <= sorted[0].weight) {
    return {
      forwardLimit: sorted[0].forwardCG,
      aftLimit: sorted[0].aftCG,
    };
  }

  // If weight is above or at the highest limit
  if (weight >= sorted[sorted.length - 1].weight) {
    return {
      forwardLimit: sorted[sorted.length - 1].forwardCG,
      aftLimit: sorted[sorted.length - 1].aftCG,
    };
  }

  // Interpolate between two limits
  for (let i = 0; i < sorted.length - 1; i++) {
    const lower = sorted[i];
    const upper = sorted[i + 1];

    if (weight >= lower.weight && weight <= upper.weight) {
      const ratio = (weight - lower.weight) / (upper.weight - lower.weight);

      return {
        forwardLimit: lower.forwardCG + ratio * (upper.forwardCG - lower.forwardCG),
        aftLimit: lower.aftCG + ratio * (upper.aftCG - lower.aftCG),
      };
    }
  }

  // Fallback (should never reach here)
  return {
    forwardLimit: sorted[0].forwardCG,
    aftLimit: sorted[0].aftCG,
  };
}

/**
 * Sample aircraft profiles for common types
 */
export const SAMPLE_AIRCRAFT: Record<string, AircraftProfile> = {
  C172N: {
    id: 'c172n',
    name: 'Cessna 172N Skyhawk',
    type: 'C172',
    emptyWeight: 1500,
    emptyMoment: 64500,
    emptyArm: 43.0,
    maxGrossWeight: 2300,
    fuelCapacity: 43,
    fuelWeightPerGallon: 6.0,
    stations: {
      pilot: { arm: 37.0, maxWeight: 400 },
      copilot: { arm: 37.0, maxWeight: 400 },
      rearSeats: { arm: 73.0, maxWeight: 400 },
      baggage1: { arm: 95.0, maxWeight: 120 },
      fuel: { arm: 48.0 },
    },
    cgLimits: [
      { weight: 1500, forwardCG: 35.0, aftCG: 47.3 },
      { weight: 2300, forwardCG: 35.0, aftCG: 47.3 },
    ],
  },
  PA28: {
    id: 'pa28',
    name: 'Piper PA-28 Cherokee',
    type: 'PA28',
    emptyWeight: 1410,
    emptyMoment: 128700,
    emptyArm: 91.3,
    maxGrossWeight: 2150,
    fuelCapacity: 50,
    fuelWeightPerGallon: 6.0,
    stations: {
      pilot: { arm: 85.5, maxWeight: 400 },
      copilot: { arm: 85.5, maxWeight: 400 },
      rearSeats: { arm: 118.1, maxWeight: 400 },
      baggage1: { arm: 142.8, maxWeight: 200 },
      fuel: { arm: 95.0 },
    },
    cgLimits: [
      { weight: 1410, forwardCG: 86.5, aftCG: 96.5 },
      { weight: 2150, forwardCG: 88.0, aftCG: 96.5 },
    ],
  },
};
