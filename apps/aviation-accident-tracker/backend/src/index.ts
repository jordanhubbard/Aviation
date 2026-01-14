import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { config } from './config.js';

const port = process.env.PORT || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`[accident-tracker] API listening on :${port}`);
});

if (config.ingestion.enabled) {
  startScheduler();
}
