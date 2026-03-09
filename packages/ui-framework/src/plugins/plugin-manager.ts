/**
 * Plugin Manager for G1000 Simulator
 * 
 * Manages plugin lifecycle, initialization, and communication with the simulator.
 */

import type { G1000Plugin, PluginContext, PluginServices, MenuManager, MenuItem, FlightState, PluginEntry, PluginStatus } from './types'

export interface PluginManagerConfig {
  maxMemory?: number
  maxCPUTime?: number
  enableSandboxing?: boolean
}

/**
 * Manages plugin registration, initialization, and lifecycle
 */
export class PluginManager {
  private plugins: Map<string, PluginEntry> = new Map()
  private flightStateSubscribers: Map<string, (state: FlightState) => void> = new Map()
  private currentFlightState: FlightState | null = null
  private menuManager: MenuManager
  private services: PluginServices
  private config: PluginManagerConfig

  constructor(
    menuManager: MenuManager,
    services: PluginServices,
    config: PluginManagerConfig = {}
  ) {
    this.menuManager = menuManager
    this.services = services
    this.config = {
      maxMemory: 512,
      maxCPUTime: 1000,
      enableSandboxing: true,
      ...config
    }
  }

  /**
   * Register and initialize a plugin
   */
  async registerPlugin(plugin: G1000Plugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id "${plugin.id}" is already registered`)
    }

    const entry: PluginEntry = {
      plugin,
      status: 'registered',
      registeredAt: Date.now()
    }

    this.plugins.set(plugin.id, entry)

    try {
      entry.status = 'initializing'
      const context = this.createPluginContext(plugin.id)
      await plugin.initialize(context)
      entry.status = 'active'
      entry.initializedAt = Date.now()

      // Call onMenuRegister if implemented
      if (plugin.onMenuRegister) {
        plugin.onMenuRegister(this.menuManager)
      }

      console.log(`[PLUGIN] Registered and initialized plugin: ${plugin.name} (${plugin.id})`)
    } catch (error) {
      entry.status = 'error'
      entry.error = error instanceof Error ? error : new Error(String(error))
      this.plugins.delete(plugin.id)
      throw new Error(`Failed to initialize plugin "${plugin.id}": ${entry.error.message}`)
    }
  }

  /**
   * Unregister and destroy a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId)
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" is not registered`)
    }

    try {
      await entry.plugin.destroy()
      entry.status = 'destroyed'
      this.flightStateSubscribers.delete(pluginId)
      this.plugins.delete(pluginId)
      console.log(`[PLUGIN] Unregistered plugin: ${entry.plugin.name} (${pluginId})`)
    } catch (error) {
      entry.status = 'error'
      entry.error = error instanceof Error ? error : new Error(String(error))
      throw new Error(`Failed to destroy plugin "${pluginId}": ${entry.error.message}`)
    }
  }

  /**
   * Update flight state and notify all subscribed plugins
   */
  updateFlightState(state: FlightState): void {
    this.currentFlightState = state

    // Notify all subscribed plugins
    for (const [pluginId, callback] of this.flightStateSubscribers) {
      const entry = this.plugins.get(pluginId)
      if (entry && entry.status === 'active') {
        try {
          callback(state)
          // Also call onFlightStateUpdate if implemented
          if (entry.plugin.onFlightStateUpdate) {
            entry.plugin.onFlightStateUpdate(state)
          }
        } catch (error) {
          console.error(`[PLUGIN] Error in flight state update for plugin "${pluginId}":`, error)
        }
      }
    }
  }

  /**
   * Render all plugins that implement onDisplayRender
   */
  renderPlugins(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    for (const entry of this.plugins.values()) {
      if (entry.status === 'active' && entry.plugin.onDisplayRender) {
        try {
          entry.plugin.onDisplayRender(canvas, ctx)
        } catch (error) {
          console.error(`[PLUGIN] Error rendering plugin "${entry.plugin.id}":`, error)
        }
      }
    }
  }

  /**
   * Get a registered plugin by ID
   */
  getPlugin(pluginId: string): G1000Plugin | undefined {
    return this.plugins.get(pluginId)?.plugin
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): G1000Plugin[] {
    return Array.from(this.plugins.values())
      .filter(entry => entry.status === 'active')
      .map(entry => entry.plugin)
  }

  /**
   * Get plugin status
   */
  getPluginStatus(pluginId: string): PluginStatus | undefined {
    return this.plugins.get(pluginId)?.status
  }

  /**
   * Get all plugin entries with status information
   */
  getPluginEntries(): PluginEntry[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Create a plugin context for initialization
   */
  private createPluginContext(pluginId: string): PluginContext {
    return {
      getState: () => this.currentFlightState,
      subscribeToStateChanges: (callback: (state: FlightState) => void) => {
        this.flightStateSubscribers.set(pluginId, callback)
        // Return unsubscribe function
        return () => {
          this.flightStateSubscribers.delete(pluginId)
        }
      },
      getServices: () => this.services,
      getMenuManager: () => this.menuManager
    }
  }
}
