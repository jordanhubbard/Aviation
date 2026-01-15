import type { IMultiTabWebUI, PaneConfig } from './types';
import { sortPanes } from './state';

/**
 * In-memory registry for multi-tab panes
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
    return sortPanes(Array.from(this.panes.values()));
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
