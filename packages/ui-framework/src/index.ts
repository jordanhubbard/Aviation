/**
 * Aviation UI Framework
 * Shared UI components and patterns for aviation applications
 */

// Map components and utilities
export * from './map';

/**
 * UI Modality Types
 */
export type UIModality = 'mobile' | 'web' | 'multi-tab' | 'embedded' | 'standalone';

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
 * Pane configuration for multi-tab interfaces
 */
export interface PaneConfig {
  id: string;
  title: string;
  icon?: string;
  component: any;
  order?: number;
  closeable?: boolean;
  defaultOpen?: boolean;
}

/**
 * Multi-tab web UI interface
 */
export interface IMultiTabWebUI {
  registerPane(config: PaneConfig): void;
  unregisterPane(id: string): void;
  getAllPanes(): PaneConfig[];
  getActivePane(): PaneConfig | null;
  setActivePane(id: string): void;
}

/**
 * Placeholder class for multi-tab UI implementation
 * To be implemented as needed by applications
 */
export class MultiTabWebUI implements IMultiTabWebUI {
  private panes: Map<string, PaneConfig> = new Map();
  private activeId: string | null = null;

  registerPane(config: PaneConfig): void {
    this.panes.set(config.id, config);
  }

  unregisterPane(id: string): void {
    this.panes.delete(id);
    if (this.activeId === id) {
      this.activeId = null;
    }
  }

  getAllPanes(): PaneConfig[] {
    return Array.from(this.panes.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getActivePane(): PaneConfig | null {
    return this.activeId ? this.panes.get(this.activeId) || null : null;
  }

  setActivePane(id: string): void {
    if (this.panes.has(id)) {
      this.activeId = id;
    }
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
