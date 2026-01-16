import type { PaneConfig } from './types';

export const sortPanes = (panes: PaneConfig[]): PaneConfig[] => {
  return [...panes].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
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

export const getRelativePaneId = (
  panes: PaneConfig[],
  currentId: string | null,
  delta: number
): string | null => {
  const sortedPanes = sortPanes(panes);
  if (sortedPanes.length === 0) {
    return null;
  }
  const index = sortedPanes.findIndex((pane) => pane.id === currentId);
  if (index === -1) {
    return getDefaultActiveId(sortedPanes);
  }
  const nextIndex = (index + delta + sortedPanes.length) % sortedPanes.length;
  return sortedPanes[nextIndex]?.id ?? null;
};

export const getNextActiveId = (
  panes: PaneConfig[],
  currentId: string | null
): string | null => {
  const sortedPanes = sortPanes(panes);
  if (sortedPanes.length === 0) {
    return null;
  }
  if (!currentId) {
    return getDefaultActiveId(sortedPanes);
  }
  const index = sortedPanes.findIndex((pane) => pane.id === currentId);
  if (index === -1) {
    return getDefaultActiveId(sortedPanes);
  }
  const nextPane = sortedPanes[index + 1] ?? sortedPanes[index - 1] ?? sortedPanes[0];
  return nextPane?.id ?? null;
};
