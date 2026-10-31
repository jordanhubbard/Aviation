import fs from 'node:fs'
import path from 'node:path'

import {
  C172S_OPERATING_PROFILE,
  C172_FUEL_CAPACITY_GALLONS,
  C172_LOADING_PROFILE,
  calculateC172Loading,
  calculateDensityAltitude,
  calculateTripFuel,
} from '../../frontend/src/integrations/sharedSdk'

describe('G1000 shared SDK boundary', () => {
  it('uses common navigation fuel and performance semantics', () => {
    expect(calculateTripFuel(120, 120, 10, 30)).toEqual({
      timeHours: 1,
      fuelRequiredGallons: 15,
    })
    expect(calculateDensityAltitude(5000, 25)).toBeCloseTo(7388.72, 2)
  })

  it('uses the shared C172 profile and loading calculation', () => {
    const result = calculateC172Loading([180, 150, 120, 40], 20)

    expect(C172_LOADING_PROFILE.emptyWeight).toBe(1500)
    expect(C172_FUEL_CAPACITY_GALLONS).toBe(43)
    expect(result.weight).toBe(2110)
    expect(result.cg).toBeCloseTo(45.0379, 4)
  })

  it('uses the shared C172S operating limits for the airspeed tape', () => {
    expect(C172S_OPERATING_PROFILE.airspeedLimits).toEqual({
      vsoKias: 40,
      vsKias: 48,
      vfeKias: 85,
      vaKias: 105,
      vnoKias: 129,
      vneKias: 163,
    })

    const display = fs.readFileSync(
      path.join(__dirname, '../../frontend/src/displays/PFD/AirspeedTape.tsx'),
      'utf8',
    )
    expect(display).toContain('C172S_OPERATING_PROFILE.airspeedLimits')
    expect(display).not.toContain('const V_SPEEDS')
    expect(display).not.toMatch(/\b(?:40|48|85|105|129|163)\b/)
  })

  it('uses the shared C172S identity and reference profile for configuration', () => {
    expect(C172S_OPERATING_PROFILE.icaoTypeDesignator).toBe('C172')
    expect(C172S_OPERATING_PROFILE.fuelLimits).toEqual({
      totalCapacityGal: 56,
      usableCapacityGal: 53,
    })
    expect(C172S_OPERATING_PROFILE.referencePerformance.maximumCruiseSpeedKtas).toBe(124)

    const configStore = fs.readFileSync(
      path.join(__dirname, '../../frontend/src/stores/configStore.ts'),
      'utf8',
    )
    expect(configStore).toContain('C172S_OPERATING_PROFILE.icaoTypeDesignator')
    expect(configStore).not.toContain("aircraftType: 'C172'")
  })

  it('keeps private trip-planning formulas out of the display', () => {
    const display = fs.readFileSync(
      path.join(__dirname, '../../frontend/src/displays/MFD/TripPlanningDisplay.tsx'),
      'utf8',
    )

    expect(display).not.toContain('distanceValue / speedValue')
    expect(display).not.toContain('standardTemp =')
    expect(display).not.toContain('stationTotals')
    expect(display).toContain('calculateTripFuel')
    expect(display).toContain('calculateC172Loading')
    expect(display).toContain('calculateDensityAltitude')
  })
})
