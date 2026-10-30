# `aviation.flight-dynamics` interface

## Records

- `Vector3(x, y, z)` uses the units declared by the containing record.
- `AtmosphereState` carries density in kg/m3, pressure in Pa, temperature in C,
  and wind velocity in m/s.
- `AircraftState` carries NED position in m, body velocity in m/s, body angular
  rates in rad/s, mass in kg, optional fuel in US gallons, and elapsed time in s.
- `ControlInputs` carries normalized throttle, mixture, propeller, aileron,
  elevator, rudder, flaps, and gear state.
- `AircraftConfig` carries identity, mass properties, aerodynamics, engine, fuel,
  operating limits, performance references, and optional variants.

## Operations

- `isa_atmosphere(altitude_m, wind_velocity_mps?) -> AtmosphereState`
- `density_altitude(density_kg_m3) -> altitude_m`
- `wind_components(config, time_s) -> steady, gust, turbulence, total`
- `force_components(config, state, controls, atmosphere) -> components`
- `integrate(state, forces, config, dt_s, method) -> AircraftState`
- `cruise_performance(config, power_setting, fuel_gal?) -> performance`
- `takeoff_climb_performance(config, atmosphere, weight_lbs?) -> performance`
- `validate_aircraft(config) -> errors, warnings`
- `pid_update(gains, error, dt_s) -> output`
- compatibility scalar lift, drag, thrust, fuel-consumption, wind, and turbulence
  operations for retained applications.

## Compatibility

Realizations MAY expose idiomatic names and richer records. Compatibility adapters
MAY preserve application method names and response shapes, but SHALL delegate the
calculation to this capability and SHALL NOT fork its formula or controller state.
