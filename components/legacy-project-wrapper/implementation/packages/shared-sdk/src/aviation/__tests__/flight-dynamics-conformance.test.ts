import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  coordinatedTurnBankDeg,
  projectPistonEngineInstruments,
} from '../flight-dynamics.js';

interface FlightDynamicsVectors {
  schema: string;
  coordinated_turn: {
    speed_mps: number;
    turn_rate_dps: number;
    expected_bank_deg: number;
  };
  piston_engine_projection: {
    airspeed_kt: number;
    cylinder_count: number;
    expected: {
      rpm: number;
      oil_temp_f: number;
      oil_pressure_psi: number;
      fuel_flow_gph: number;
      bus_volts: number;
      alternator_load_amps: number;
      manifold_pressure_inhg: number;
      battery_temp_f: number;
      egt_f: number[];
      cht_f: number[];
    };
  };
}

const contract = loadConformanceContract<FlightDynamicsVectors>('flight-dynamics');

describe('aviation.flight-dynamics TypeScript conformance', () => {
  it('matches the coordinated-turn vector', () => {
    expect(contract.schema).toBe('aviation/flight-dynamics-vectors@2');
    const vector = contract.coordinated_turn;
    expect(
      coordinatedTurnBankDeg(vector.speed_mps, vector.turn_rate_dps),
    ).toBeCloseTo(vector.expected_bank_deg, 12);
  });

  it('matches the synthetic piston-engine vector', () => {
    const vector = contract.piston_engine_projection;
    const actual = projectPistonEngineInstruments(
      vector.airspeed_kt,
      vector.cylinder_count,
    );
    expect(actual).toEqual({
      rpm: vector.expected.rpm,
      oilTempF: vector.expected.oil_temp_f,
      oilPressurePsi: vector.expected.oil_pressure_psi,
      fuelFlowGph: vector.expected.fuel_flow_gph,
      busVolts: vector.expected.bus_volts,
      alternatorLoadAmps: vector.expected.alternator_load_amps,
      manifoldPressureInHg: vector.expected.manifold_pressure_inhg,
      batteryTempF: vector.expected.battery_temp_f,
      egtF: vector.expected.egt_f,
      chtF: vector.expected.cht_f,
    });
  });

  it('fails closed on invalid projection inputs', () => {
    expect(() => coordinatedTurnBankDeg(-1, 3)).toThrow();
    expect(() => coordinatedTurnBankDeg(Number.NaN, 3)).toThrow();
    expect(() => projectPistonEngineInstruments(-1)).toThrow();
    expect(() => projectPistonEngineInstruments(100, 0)).toThrow();
    expect(() => projectPistonEngineInstruments(100, 2.5)).toThrow();
    expect(() => projectPistonEngineInstruments(Number.POSITIVE_INFINITY)).toThrow();
  });
});
