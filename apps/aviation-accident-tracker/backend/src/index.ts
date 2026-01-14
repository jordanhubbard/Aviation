import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';

const port = process.env.PORT || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`[accident-tracker] API listening on :${port}`);
});

if (process.env.ENABLE_CRON !== 'false') {
  startScheduler();
}
