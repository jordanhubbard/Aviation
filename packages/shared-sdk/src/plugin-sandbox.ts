// Plugin Sandboxing and Permissions Layer

export interface PluginPermission {
  name: string;
  description: string;
  category: 'api' | 'data' | 'system';
}

export interface PluginSandboxConfig {
  allowedAPIs: string[];
  allowedDataAccess: string[];
  maxMemory?: number;
  maxCPUTime?: number;
  networkAccess?: boolean;
}

export class PluginSandbox {
  private config: PluginSandboxConfig;
  private allowedPermissions: Set<string>;
  private activityLog: PluginActivityLog[] = [];

  constructor(config: PluginSandboxConfig) {
    this.config = config;
    this.allowedPermissions = new Set(config.allowedAPIs);
  }

  /**
   * Check if a plugin has permission to access an API
   */
  public hasPermission(apiName: string): boolean {
    return this.allowedPermissions.has(apiName);
  }

  /**
   * Grant a permission to the plugin
   */
  public grantPermission(apiName: string): void {
    this.allowedPermissions.add(apiName);
    this.logActivity('PERMISSION_GRANTED', { apiName });
  }

  /**
   * Revoke a permission from the plugin
   */
  public revokePermission(apiName: string): void {
    this.allowedPermissions.delete(apiName);
    this.logActivity('PERMISSION_REVOKED', { apiName });
  }

  /**
   * Get all granted permissions
   */
  public getPermissions(): string[] {
    return Array.from(this.allowedPermissions);
  }

  /**
   * Create a restricted proxy for an API object
   */
  public createRestrictedProxy<T extends object>(obj: T, allowedMethods: string[]): T {
    return new Proxy(obj, {
      get: (target, prop) => {
        if (typeof prop === 'string' && !allowedMethods.includes(prop)) {
          this.logActivity('UNAUTHORIZED_ACCESS_ATTEMPT', { method: prop });
          throw new Error(`Access to ${String(prop)} is not permitted`);
        }
        return (target as any)[prop];
      },
    }) as T;
  }

  /**
   * Log plugin activity for audit purposes
   */
  private logActivity(action: string, details: any): void {
    const logEntry: PluginActivityLog = {
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    this.activityLog.push(logEntry);
  }

  /**
   * Get activity log
   */
  public getActivityLog(): PluginActivityLog[] {
    return [...this.activityLog];
  }

  /**
   * Clear activity log
   */
  public clearActivityLog(): void {
    this.activityLog = [];
  }
}

export interface PluginActivityLog {
  timestamp: string;
  action: string;
  details: any;
}

/**
 * Standard plugin permissions
 */
export const STANDARD_PERMISSIONS = {
  READ_FLIGHT_STATE: 'read:flight_state',
  WRITE_FLIGHT_STATE: 'write:flight_state',
  READ_AIRCRAFT_DATA: 'read:aircraft_data',
  WRITE_AIRCRAFT_DATA: 'write:aircraft_data',
  ACCESS_MENU: 'access:menu',
  ACCESS_DISPLAY: 'access:display',
  ACCESS_NETWORK: 'access:network',
  ACCESS_STORAGE: 'access:storage',
  ACCESS_SYSTEM_INFO: 'access:system_info',
};

/**
 * Permission categories and their descriptions
 */
export const PERMISSION_CATALOG: { [key: string]: PluginPermission } = {
  [STANDARD_PERMISSIONS.READ_FLIGHT_STATE]: {
    name: 'Read Flight State',
    description: 'Access to current flight state data',
    category: 'data',
  },
  [STANDARD_PERMISSIONS.WRITE_FLIGHT_STATE]: {
    name: 'Write Flight State',
    description: 'Ability to modify flight state',
    category: 'data',
  },
  [STANDARD_PERMISSIONS.READ_AIRCRAFT_DATA]: {
    name: 'Read Aircraft Data',
    description: 'Access to aircraft configuration and data',
    category: 'data',
  },
  [STANDARD_PERMISSIONS.WRITE_AIRCRAFT_DATA]: {
    name: 'Write Aircraft Data',
    description: 'Ability to modify aircraft data',
    category: 'data',
  },
  [STANDARD_PERMISSIONS.ACCESS_MENU]: {
    name: 'Access Menu',
    description: 'Ability to register and interact with menu items',
    category: 'api',
  },
  [STANDARD_PERMISSIONS.ACCESS_DISPLAY]: {
    name: 'Access Display',
    description: 'Ability to render on the display canvas',
    category: 'api',
  },
  [STANDARD_PERMISSIONS.ACCESS_NETWORK]: {
    name: 'Access Network',
    description: 'Ability to make network requests',
    category: 'system',
  },
  [STANDARD_PERMISSIONS.ACCESS_STORAGE]: {
    name: 'Access Storage',
    description: 'Ability to read and write local storage',
    category: 'system',
  },
  [STANDARD_PERMISSIONS.ACCESS_SYSTEM_INFO]: {
    name: 'Access System Info',
    description: 'Access to system information',
    category: 'system',
  },
};
