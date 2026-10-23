// Plugin Manager for G1000 Simulator

import { G1000Plugin } from '@aviation/ui-framework';
import { PluginSandbox, PluginSandboxConfig, STANDARD_PERMISSIONS } from '@aviation/shared-sdk/plugin-sandbox';

class PluginManager {
  private plugins: G1000Plugin[] = [];
  private permissions: { [pluginId: string]: string[] } = {};

  registerPlugin(plugin: G1000Plugin): void {
    // Check and apply sandboxing and permissions
    const sandboxConfig: PluginSandboxConfig = {
      allowedAPIs: [STANDARD_PERMISSIONS.READ_FLIGHT_STATE, STANDARD_PERMISSIONS.ACCESS_DISPLAY],
      allowedDataAccess: [],
      maxMemory: 512,
      maxCPUTime: 1000,
      networkAccess: false
    };
    const sandbox = new PluginSandbox(sandboxConfig);
    if (!sandbox.hasPermission(STANDARD_PERMISSIONS.READ_FLIGHT_STATE)) {
      throw new Error(`Plugin ${plugin.id} lacks required permissions.`);
    }
    this.applySandboxing(plugin);
    this.checkPermissions(plugin);
    this.plugins.push(plugin);
    plugin.initialize({
      getState: this.getState,
      subscribeToStateChanges: this.subscribeToStateChanges,
      getServices: this.getServices
    });
  }

  unregisterPlugin(pluginId: string): void {
    const pluginIndex = this.plugins.findIndex(p => p.id === pluginId);
    if (pluginIndex !== -1) {
      this.plugins[pluginIndex].destroy();
      this.plugins.splice(pluginIndex, 1);
    }
  }

  private getState() {
    // Return the current flight state
  }

  private subscribeToStateChanges(callback: (state: FlightState) => void) {
    // Subscribe to flight state changes
  }

  private getServices() {
    // Return available services
  }

  private applySandboxing(plugin: G1000Plugin): void {
    const sandboxedContext = this.createSandboxedContext(plugin.id);
    this.logPluginActivity(plugin.id, 'SANDBOX_APPLIED', { timestamp: new Date() });
  }

  private checkPermissions(plugin: G1000Plugin): void {
    const requiredPermissions = this.getRequiredPermissions(plugin);
    const grantedPermissions = this.permissions[plugin.id] || [];
    for (const permission of requiredPermissions) {
      if (!grantedPermissions.includes(permission)) {
        this.logPluginActivity(plugin.id, 'PERMISSION_DENIED', { permission });
        throw new Error(`Plugin ${plugin.id} requires permission: ${permission}`);
      }
    }
    this.logPluginActivity(plugin.id, 'PERMISSIONS_VERIFIED', { permissions: grantedPermissions });
  }

  private createSandboxedContext(pluginId: string): any {
    return {
      getFlightState: () => this.getState(),
      subscribeToStateChanges: (callback: any) => this.subscribeToStateChanges(callback),
    };
  }

  private getRequiredPermissions(plugin: G1000Plugin): string[] {
    return [];
  }

  private logPluginActivity(pluginId: string, action: string, details: any): void {
    const logEntry = {
      pluginId,
      action,
      timestamp: new Date().toISOString(),
      details
    };
    console.log('[PLUGIN_AUDIT]', JSON.stringify(logEntry));
  }

  public grantPermission(pluginId: string, permission: string): void {
    if (!this.permissions[pluginId]) {
      this.permissions[pluginId] = [];
    }
    this.permissions[pluginId].push(permission);
    this.logPluginActivity(pluginId, 'PERMISSION_GRANTED', { permission });
  }

  public revokePermission(pluginId: string, permission: string): void {
    if (this.permissions[pluginId]) {
      this.permissions[pluginId] = this.permissions[pluginId].filter(p => p !== permission);
      this.logPluginActivity(pluginId, 'PERMISSION_REVOKED', { permission });
    }
  }

  public getPluginPermissions(pluginId: string): string[] {
    return this.permissions[pluginId] || [];
  }
}

export default new PluginManager();
