import type { PaneConfig, TabReorderDirection } from './types';

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

export const normalizePaneOrder = (panes: PaneConfig[]): PaneConfig[] => {
  return panes.map((pane, index) => ({
    ...pane,
    order: index + 1,
  }));
};

export const movePane = (
  panes: PaneConfig[],
  paneId: string,
  direction: TabReorderDirection
): PaneConfig[] => {
  const index = panes.findIndex((pane) => pane.id === paneId);
  if (index === -1) {
    return panes;
  }
  const nextIndex = direction === 'left' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= panes.length) {
    return panes;
  }
  const reordered = [...panes];
  const [pane] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, pane);
  return normalizePaneOrder(reordered);
};

export const getNextActiveIdAfterClose = (
  panes: PaneConfig[],
  closedId: string
): string | null => {
  if (panes.length === 0) {
    return null;
  }
  const index = panes.findIndex((pane) => pane.id === closedId);
  if (index === -1) {
    return getDefaultActiveId(panes);
  }
  const nextPane = panes[index + 1] ?? panes[index - 1];
  return nextPane?.id ?? null;
};

export const closePane = (
  panes: PaneConfig[],
  activeId: string | null,
  closedId: string
): { panes: PaneConfig[]; activeId: string | null } => {
  const remaining = panes.filter((pane) => pane.id !== closedId);
  const nextActiveCandidate =
    activeId === closedId ? getNextActiveIdAfterClose(panes, closedId) : activeId;
  const nextActiveId = remaining.find((pane) => pane.id === nextActiveCandidate)
    ? nextActiveCandidate
    : getDefaultActiveId(remaining);
  return {
    panes: normalizePaneOrder(remaining),
    activeId: nextActiveId,
  };
};
