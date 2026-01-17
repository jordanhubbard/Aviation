import type { IMultiTabWebUI, PaneConfig, TabReorderDirection } from './types';
import { movePane, sortPanes } from './state';

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

  closePane(id: string): void {
    this.unregisterPane(id);
  }

  reorderPane(id: string, direction: TabReorderDirection): void {
    const orderedPanes = sortPanes(Array.from(this.panes.values()));
    const reordered = movePane(orderedPanes, id, direction);
    this.panes = new Map(reordered.map((pane) => [pane.id, pane]));
  }
}
