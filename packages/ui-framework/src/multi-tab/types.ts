import type { ComponentType } from 'react';

export type PaneRenderer = ComponentType<any>;

export type TabReorderDirection = 'left' | 'right';
export type TabTheme = 'light' | 'dark';

/**
 * Pane configuration for multi-tab interfaces
 */
export interface PaneConfig {
  id: string;
  title: string;
  icon?: string;
  component: PaneRenderer;
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
  closePane(id: string): void;
  reorderPane(id: string, direction: TabReorderDirection): void;
}
