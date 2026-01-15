import type { PaneConfig } from './types';

export const sortPanes = (panes: PaneConfig[]): PaneConfig[] => {
  return [...panes].sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.title.localeCompare(b.title);
  });
};

export const getDefaultActiveId = (panes: PaneConfig[]): string | null => {
  const defaultPane = panes.find((pane) => pane.defaultOpen);
  if (defaultPane) {
    return defaultPane.id;
  }
  return panes[0]?.id ?? null;
};

export const isPaneCloseable = (pane: PaneConfig): boolean => pane.closeable !== false;

export const getNextActiveId = (
  panes: PaneConfig[],
  currentId: string | null
): string | null => {
  if (panes.length === 0) {
    return null;
  }
  if (!currentId) {
    return getDefaultActiveId(panes);
  }
  const index = panes.findIndex((pane) => pane.id === currentId);
  if (index === -1) {
    return getDefaultActiveId(panes);
  }
  const nextPane = panes[index + 1] ?? panes[index - 1] ?? panes[0];
  return nextPane?.id ?? null;
};
