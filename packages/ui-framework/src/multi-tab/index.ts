export type { PaneConfig, IMultiTabWebUI } from './types';
export { MultiTabWebUI } from './registry';
export {
  getDefaultActiveId,
  getNextActiveId,
  getRelativePaneId,
  isPaneCloseable,
  sortPanes,
} from './state';
export { PaneContainer, TabNavigation } from './components';
