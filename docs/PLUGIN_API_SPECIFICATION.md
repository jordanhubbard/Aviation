# Plugin API Specification

## Overview
This document specifies the API surface for plugins extending the G1000 Simulator. It includes lifecycle hooks, extension points, and the plugin manifest format.

## Plugin Lifecycle Hooks
- **initialize(context: PluginContext): Promise<void>;**: Invoked when the plugin is initialized.
- **destroy(): Promise<void>;**: Invoked when the plugin is destroyed.

## Extension Points
- **onFlightStateUpdate?(state: FlightState): void;**: Triggered on flight state updates.
- **onDisplayRender?(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;**: Triggered for display rendering.
- **onMenuRegister?(menuManager: MenuManager): void;**: Allows plugins to register menu items.

## Plugin Manifest Format
Plugins must include a `manifest.json` file with metadata and capabilities.

### Example `manifest.json`
```json
{
  "id": "traffic-display-plugin",
  "name": "Traffic Display",
  "version": "1.0.0",
  "main": "./TrafficDisplayPlugin.js",
  "description": "A plugin to display traffic information on the G1000 Simulator",
  "author": "John Doe",
  "license": "MIT",
  "dependencies": {
    "@aviation/ui-framework": "^1.0.0"
  }
}
```

### Required Fields
- **id**: Unique identifier for the plugin.
- **name**: Name of the plugin.
- **version**: Version of the plugin.
- **main**: Entry point file of the plugin.
- **description**: Brief description of the plugin.
- **author**: Author of the plugin.
- **license**: License under which the plugin is distributed.
- **dependencies**: Dependencies required by the plugin.

## Conclusion
This specification outlines the necessary components for developing plugins for the G1000 Simulator, enabling extensibility and customization.
