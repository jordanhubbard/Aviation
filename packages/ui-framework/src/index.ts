/**
 * UI Modality types
 */
export type UIModality = 'mobile' | 'web-tab' | 'standalone';

/**
 * Application pane configuration for multi-tab web UI
 */
export interface ApplicationPane {
  id: string;
  title: string;
  icon?: string;
  component: any; // Component reference
  order?: number;
}

/**
 * Base application UI interface
 */
export interface ApplicationUI {
  id: string;
  name: string;
  modality: UIModality;
  render(): void;
}

/**
 * Multi-tab web UI container that holds multiple application panes
 */
export class MultiTabWebUI {
  private panes: Map<string, ApplicationPane>;
  private activePane: string | null;

  constructor() {
    this.panes = new Map();
    this.activePane = null;
  }

  /**
   * Register an application pane
   */
  registerPane(pane: ApplicationPane): void {
    this.panes.set(pane.id, pane);
    
    // Set as active if it's the first pane
    if (this.panes.size === 1) {
      this.activePane = pane.id;
    }
  }

  /**
   * Unregister an application pane
   */
  unregisterPane(paneId: string): void {
    this.panes.delete(paneId);
    
    // If active pane was removed, switch to first available
    if (this.activePane === paneId) {
      const firstPane = Array.from(this.panes.keys())[0];
      this.activePane = firstPane || null;
    }
  }

  /**
   * Switch to a different pane
   */
  switchPane(paneId: string): void {
    if (this.panes.has(paneId)) {
      this.activePane = paneId;
    } else {
      throw new Error(`Pane ${paneId} not found`);
    }
  }

  /**
   * Get the currently active pane
   */
  getActivePane(): ApplicationPane | null {
    if (this.activePane) {
      return this.panes.get(this.activePane) || null;
    }
    return null;
  }

  /**
   * Get all registered panes
   */
  getAllPanes(): ApplicationPane[] {
    return Array.from(this.panes.values()).sort((a, b) => {
      const orderA = a.order || 0;
      const orderB = b.order || 0;
      return orderA - orderB;
    });
  }
}

/**
 * Base class for mobile UIs
 */
export abstract class MobileUI implements ApplicationUI {
  public id: string;
  public name: string;
  public modality: UIModality = 'mobile';

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  abstract render(): void;
}

/**
 * Base class for standalone web UIs
 */
export abstract class StandaloneWebUI implements ApplicationUI {
  public id: string;
  public name: string;
  public modality: UIModality = 'standalone';

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  abstract render(): void;
}

/**
 * Map components and utilities
 */
export * from './map';
