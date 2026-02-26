// Entry point for the G1000 Simulator

import { initializeHardwareAdapters } from './hardwareAdapters';
import pluginManager from './pluginManager';
import TrafficDisplayPlugin from './plugins/TrafficDisplayPlugin';

// Initialize hardware input adapters
initializeHardwareAdapters();

// Register plugins
pluginManager.registerPlugin(new TrafficDisplayPlugin());

console.log('G1000 Simulator started');
