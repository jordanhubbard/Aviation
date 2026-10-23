// Entry point for the G1000 Simulator (server/CLI).
// Plugins and React UI are built and run via backend/ and frontend/.

import { initializeHardwareAdapters } from './hardwareAdapters';

initializeHardwareAdapters();

console.log('G1000 Simulator started');
