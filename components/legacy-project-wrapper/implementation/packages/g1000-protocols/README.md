# G1000 Protocols SDK

This package is the retained TypeScript realization of the protocol portion of
`aviation.avionics`. It defines runtime-validated communication records and exchange
formats for avionics applications, not only the G1000 simulator.

## Modules

- `websocket/` — message types, serialization, client
- `api/` — REST API types and OpenAPI schema
- `formats/` — flight plan import/export, telemetry, config formats

## Getting Started

Run `pnpm test` to evaluate telemetry, command, and flight-plan behavior against the
Component-owned vectors in `components/aviation-avionics/acceptance/vectors.json`.

## Directory Structure

- `websocket/`: Contains definitions for WebSocket message types, serialization logic, and client implementations.
- `api/`: Defines REST API types and includes the OpenAPI schema for the simulator's API.
- `formats/`: Handles various data formats including flight plan import/export, telemetry data, and configuration formats.

## Usage

Import public records and guards from `@aviation/g1000-protocols`. Applications should
validate unknown wire values with `isTelemetrySnapshot`, `isTelemetryUpdate`, and
`isCommandPayload` before updating application state.
