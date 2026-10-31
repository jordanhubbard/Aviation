/** Portable turn physics and deterministic synthetic engine instrumentation. */

const STANDARD_GRAVITY_MPS2 = 9.80665;

const finite = (name: string, value: number): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

/** Return the non-negative bank magnitude implied by a coordinated turn. */
export function coordinatedTurnBankDeg(
  speedMps: number,
  turnRateDps: number,
): number {
  const speed = finite('speedMps', speedMps);
  const turnRate = finite('turnRateDps', turnRateDps);
  if (speed < 0) throw new RangeError('speedMps must be non-negative');
  return (
    (Math.atan(
      (speed * ((Math.abs(turnRate) * Math.PI) / 180)) /
        STANDARD_GRAVITY_MPS2,
    ) *
      180) /
    Math.PI
  );
}

export interface PistonEngineInstrumentProjection {
  rpm: number;
  oilTempF: number;
  oilPressurePsi: number;
  fuelFlowGph: number;
  busVolts: number;
  alternatorLoadAmps: number;
  manifoldPressureInHg: number;
  batteryTempF: number;
  egtF: number[];
  chtF: number[];
}

/** Project deterministic synthetic piston-engine telemetry from airspeed. */
export function projectPistonEngineInstruments(
  airspeedKt: number,
  cylinderCount = 6,
): PistonEngineInstrumentProjection {
  const airspeed = finite('airspeedKt', airspeedKt);
  if (airspeed < 0) throw new RangeError('airspeedKt must be non-negative');
  if (
    !Number.isInteger(cylinderCount) ||
    cylinderCount < 1 ||
    cylinderCount > 12
  ) {
    throw new RangeError('cylinderCount must be an integer from 1 through 12');
  }

  const egtBase = clamp(1280 + airspeed * 1.6, 1150, 1550);
  const chtBase = clamp(330 + airspeed * 0.45, 300, 430);
  const midpoint = (cylinderCount - 1) / 2;
  const egtF = Array.from({ length: cylinderCount }, (_, index) =>
    Math.round(
      egtBase +
        (index - midpoint) * 12 +
        Math.sin(index + airspeed / 40) * 8,
    ),
  );
  const chtF = Array.from({ length: cylinderCount }, (_, index) =>
    Math.round(
      chtBase +
        (index - midpoint) * 6 +
        Math.cos(index + airspeed / 50) * 5,
    ),
  );

  return {
    rpm: Math.round(clamp(1900 + airspeed * 6, 1800, 2700)),
    oilTempF: Math.round(clamp(175 + airspeed * 0.35, 150, 245)),
    oilPressurePsi: Math.round(clamp(50 + airspeed * 0.12, 40, 85)),
    fuelFlowGph: clamp(7 + airspeed * 0.03, 6, 14),
    busVolts: clamp(27.5 + airspeed * 0.01, 27.5, 28.4),
    alternatorLoadAmps: Math.round(clamp(20 + airspeed * 0.08, 18, 32)),
    manifoldPressureInHg: clamp(18 + airspeed * 0.02, 18, 29),
    batteryTempF: Math.round(clamp(80 + airspeed * 0.1, 70, 120)),
    egtF,
    chtF,
  };
}
