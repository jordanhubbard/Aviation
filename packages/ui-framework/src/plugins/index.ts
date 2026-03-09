/**
 * G1000 Plugin System
 * 
 * This module exports the core plugin interfaces and utilities for extending
 * the G1000 Simulator with custom displays, menu items, and flight state handlers.
 */

export type { G1000Plugin, PluginContext, PluginServices, PluginManifest, MenuItem, MenuManager, FlightState, PluginStatus, PluginEntry } from './types'
export { telemetryToFlightState } from './types'
export { PluginManager } from './plugin-manager'
export type { PluginManagerConfig } from './plugin-manager'
