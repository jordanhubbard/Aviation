export type { IMultiTabWebUI, PaneConfig, TabReorderDirection, TabTheme } from './types.js';
export { MultiTabWebUI } from './registry.js';
export {
  closePane,
  getDefaultActiveId,
  getNextActiveIdAfterClose,
  getNextActiveId,
  getRelativePaneId,
  isPaneCloseable,
  movePane,
  normalizePaneOrder,
  sortPanes,
} from './state.js';
export { PaneContainer, TabNavigation } from './components/index.js';
export { ensureMultiTabStyles } from './styles.js';
