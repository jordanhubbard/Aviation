# G1000 Rendering SDK

This package provides a canvas rendering library for G1000 PFD/MFD displays and visual themes.

It is the retained TypeScript realization of the rendering portion of
`aviation.avionics`. Public primitives, layouts, themes, and pipelines are exported
from `@aviation/g1000-rendering` and are independently testable without a browser.

## Modules

- `primitives/` — tapes, attitude sphere, compass rose, arcs, text rendering
- `pfd/` — PFD layout and instruments
- `mfd/` — map, terrain, weather overlays, engine gauges
- `themes/` — day/night/high-contrast visual themes
- `utils/` — canvas helpers and color utilities

## Purpose

The SDK is designed to facilitate the rendering of G1000 displays, providing essential components and utilities for creating realistic and functional PFD and MFD interfaces.

Run `pnpm test` to evaluate layout, one-shot pipeline ordering, and canvas operation
traces against the Component-owned acceptance vectors.
