import { describe, expect, it } from 'vitest'

import { C172S_OPERATING_PROFILE } from '@aviation/shared-sdk/aviation/aircraft'
import {
  DEFAULT_AIRCRAFT_CRUISE_SPEED_KT,
  DEFAULT_AIRCRAFT_ICAO_TYPE,
  DEFAULT_AIRCRAFT_PROFILE,
  DEFAULT_AIRCRAFT_USABLE_FUEL_GAL,
} from './aircraftDefaults'

describe('Flight Planner aircraft defaults', () => {
  it('come from the common aviation.aircraft profile', () => {
    expect(DEFAULT_AIRCRAFT_PROFILE).toBe(C172S_OPERATING_PROFILE)
    expect(DEFAULT_AIRCRAFT_ICAO_TYPE).toBe('C172')
    expect(DEFAULT_AIRCRAFT_CRUISE_SPEED_KT).toBe(124)
    expect(DEFAULT_AIRCRAFT_USABLE_FUEL_GAL).toBe(53)
  })
})
