// Own the browser server so a stalled graceful exit cannot strand the E2E driver.
export async function launchOwnedBrowser(browserType, options = {}, {
  graceMs = 5_000, killMs = 5_000,
  report = event => console.error(JSON.stringify({ schema: 'aviation/browser-lifecycle@1', ...event })),
} = {}) {
  const timed = async (phase, action, timeout) => {
    const start = performance.now();
    report({ phase, status: 'started' });
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(action),
        new Promise((_, reject) => { timer = setTimeout(() => {
          const error = new Error(`Browser ${phase} exceeded ${timeout}ms`);
          error.code = 'BROWSER_PHASE_TIMEOUT';
          reject(error);
        }, timeout); }),
      ]);
      report({ phase, status: 'completed', elapsedMs: Math.round(performance.now() - start) });
      return result;
    } catch (error) {
      report({ phase, status: 'failed', elapsedMs: Math.round(performance.now() - start), code: error.code || 'BROWSER_PHASE_ERROR' });
      throw error;
    } finally { clearTimeout(timer); }
  };
  let server;
  let launching;
  let closing;
  const close = () => closing ||= (async () => {
    try {
      const owned = server || await launching;
      await timed('server.close', () => owned.close(), graceMs);
    } catch (error) {
      // BrowserServer.kill targets only this launch's process tree, never a
      // process selected by name. Await its exit before admitting recovery.
      if (server) await timed('server.kill', () => server.kill(), killMs);
      else throw error;
      if (error.code !== 'BROWSER_PHASE_TIMEOUT') throw error;
      report({ phase: 'shutdown', status: 'recovered' });
    } finally {
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    }
  })();
  const handlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal, index) => {
    const handler = () => {
      report({ phase: 'signal', signal, status: 'received' });
      close().then(() => process.exit([130, 143, 129][index]), () => process.exit(1));
    };
    process.once(signal, handler);
    return [signal, handler];
  });
  try {
    launching = timed('launch', () => browserType.launchServer({
      ...options, host: '127.0.0.1', timeout: 30_000,
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    }), 32_000);
    server = await launching;
    server.process?.()?.once('exit', (code, signal) => report({ phase: 'process.exit', status: 'completed', code, signal }));
    const browser = await timed('connect', () => browserType.connect(server.wsEndpoint(), { timeout: 30_000 }), 32_000);
    browser.close = close;
    return browser;
  } catch (error) {
    await close();
    throw error;
  }
}
