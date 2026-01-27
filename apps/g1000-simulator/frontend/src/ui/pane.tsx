import type { PaneConfig } from '@aviation/ui-framework';

import App from '../App';

export const G1000SimulatorPane = () => <App />;

export const g1000PaneConfig: PaneConfig = {
  id: 'g1000-simulator',
  title: 'G1000 Simulator',
  component: G1000SimulatorPane,
  order: 6,
};
