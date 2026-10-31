import { C172S_OPERATING_PROFILE } from '@aviation/shared-sdk/aviation/aircraft'

export const DEFAULT_AIRCRAFT_PROFILE = C172S_OPERATING_PROFILE
export const DEFAULT_AIRCRAFT_ICAO_TYPE = DEFAULT_AIRCRAFT_PROFILE.icaoTypeDesignator
export const DEFAULT_AIRCRAFT_CRUISE_SPEED_KT =
  DEFAULT_AIRCRAFT_PROFILE.referencePerformance.maximumCruiseSpeedKtas
export const DEFAULT_AIRCRAFT_USABLE_FUEL_GAL =
  DEFAULT_AIRCRAFT_PROFILE.fuelLimits.usableCapacityGal
