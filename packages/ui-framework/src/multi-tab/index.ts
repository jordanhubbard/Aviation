export type { IMultiTabWebUI, PaneConfig, TabReorderDirection, TabTheme } from './types';
export { MultiTabWebUI } from './registry';
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
} from './state';
export { PaneContainer, TabNavigation } from './components';
export { ensureMultiTabStyles } from './styles';
