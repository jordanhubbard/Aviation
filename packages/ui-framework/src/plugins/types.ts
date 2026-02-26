/**
 * G1000 Plugin Architecture Types
 * 
 * This module defines the core interfaces and types for the G1000 plugin system.
 * Plugins can extend the simulator with custom displays, menu items, and flight state handlers.
 */

/**
 * Flight state provided to plugins - a simplified view of telemetry data
 */
export interface FlightState {
  position: {
    latitude: number
    longitude: number
    altitude: number
  }
  heading: number
  speed: number
  verticalSpeed: number
  pitch: number
  roll: number
  timestamp: number
}

/**
 * Menu item that plugins can register
 */
export interface MenuItem {
  id: string
  label: string
  subLabel?: string
  onClick: () => void
  disabled?: boolean
}

/**
 * Menu manager interface for plugins to register menu items
 */
export interface MenuManager {
  registerMenuItem(item: MenuItem): void
  unregisterMenuItem(itemId: string): void
  getMenuItems(): MenuItem[]
}

/**
 * Services available to plugins through the context
 */
export interface PluginServices {
  sendCommand: (command: unknown) => void
  getAlerts: () => unknown[]
  playAudio: (soundId: string) => void
}

/**
 * Context provided to plugins during initialization and lifecycle
 */
export interface PluginContext {
  getState(): FlightState | null
  subscribeToStateChanges(callback: (state: FlightState) => void): () => void
  getServices(): PluginServices
  getMenuManager(): MenuManager
}

/**
 * Plugin manifest metadata
 */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  main?: string
  dependencies?: Record<string, string>
}

/**
 * Core G1000 Plugin interface
 * 
 * All plugins must implement this interface to be loaded by the plugin manager.
 */
export interface G1000Plugin {
  /** Unique identifier for the plugin */
  id: string
  /** Human-readable name */
  name: string
  /** Semantic version string */
  version: string
  
  /**
   * Called when the plugin is initialized
   * Use this to set up state, register menu items, etc.
   */
  initialize(context: PluginContext): Promise<void>
  
  /**
   * Called when the plugin is being destroyed
   * Use this to clean up resources, unregister handlers, etc.
   */
  destroy(): Promise<void>
  
  /**
   * Optional: Called whenever the flight state updates
   * Use this to react to telemetry changes
   */
  onFlightStateUpdate?(state: FlightState): void
  
  /**
   * Optional: Called when a display needs rendering
   * Use this to draw custom overlays or displays
   */
  onDisplayRender?(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void
  
  /**
   * Optional: Called to allow the plugin to register menu items
   * This is called after initialize() completes
   */
  onMenuRegister?(menuManager: MenuManager): void
}

/**
 * Plugin registration status
 */
export type PluginStatus = 'registered' | 'initializing' | 'active' | 'error' | 'destroyed'

/**
 * Internal plugin entry with status tracking
 */
export interface PluginEntry {
  plugin: G1000Plugin
  status: PluginStatus
  error?: Error
  registeredAt: number
  initializedAt?: number
}
