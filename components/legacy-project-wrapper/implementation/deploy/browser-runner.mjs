// Own the browser server so a stalled graceful exit cannot strand the E2E driver.
export async function launchOwnedBrowser(browserType, options = {}, {
  graceMs = 5_000, killMs = 5_000,
  platform = process.platform,
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
  let disconnectClient;
  let browserProcess;
  let processExit;
  let processExited;
  let serverClosed;
  let isChromium = false;
  const close = () => closing ||= (async () => {
    try {
      const owned = server || await launching;
      if (disconnectClient) await timed('client.close', disconnectClient, graceMs);
      await timed('server.close', async () => {
        // Regular Chromium's native macOS shutdown handler avoids its slow UI
        // quit path. The separate headless shell does not share that handler.
        const nativeApp = platform === 'darwin' && isChromium
          && Number.isSafeInteger(browserProcess?.pid) && browserProcess.pid > 0
          && typeof browserProcess.kill === 'function' && serverClosed
          && /\.app\/Contents\/MacOS\/[^/]+$/.test(browserProcess.spawnfile || '');
        if (nativeApp) {
          if (!processExit) {
            const sent = browserProcess.kill('SIGTERM');
            report({ phase: 'process.terminate', status: 'requested', signal: 'SIGTERM', pid: browserProcess.pid, sent });
          }
          await serverClosed;
        }
        await owned.close();
        if (processExited) {
          const exit = await processExited;
          if (exit.code !== 0 || exit.signal !== null) {
            const error = new Error(`Browser process exit was not normal: code=${exit.code}, signal=${exit.signal}`);
            error.code = 'BROWSER_PROCESS_EXIT';
            throw error;
          }
        }
      }, graceMs);
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
    isChromium = typeof browserType.name === 'function' && browserType.name() === 'chromium';
    const launchOptions = { ...options };
    if (platform === 'darwin' && isChromium && options.headless !== false
      && options.channel === undefined && options.executablePath === undefined) {
      launchOptions.channel = 'chromium';
    }
    launching = timed('launch', () => browserType.launchServer({
      ...launchOptions, host: '127.0.0.1', timeout: 30_000,
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    }), 32_000);
    server = await launching;
    browserProcess = server.process?.();
    if (typeof browserProcess?.once === 'function') {
      const ended = browserProcess.exitCode != null || browserProcess.signalCode != null;
      processExited = new Promise(resolve => {
        const observe = (code, signal) => {
          processExit = { code, signal };
          report({ phase: 'process.exit', status: 'completed', pid: browserProcess.pid, code, signal });
          resolve(processExit);
        };
        if (ended) observe(browserProcess.exitCode ?? null, browserProcess.signalCode ?? null);
        else browserProcess.once('exit', observe);
      });
      if (typeof server.once === 'function') {
        serverClosed = ended ? Promise.resolve() : new Promise(resolve => server.once('close', resolve));
      }
    }
    const browser = await timed('connect', async () => {
      const client = await browserType.connect(server.wsEndpoint(), { timeout: 30_000 });
      disconnectClient = typeof client.close === 'function' ? client.close.bind(client) : undefined;
      if (client.browserType?.().name() === 'chromium') {
        isChromium = true;
        // Keep the owner's last default-context target alive after the client
        // disconnects. Client-created contexts remain isolated from this target.
        await timed('shutdown.target', async () => {
          const session = await client.newBrowserCDPSession();
          try {
            const { targetId } = await session.send('Target.createTarget', { url: 'about:blank' });
            if (typeof targetId !== 'string' || !targetId.trim()) throw new Error('Missing shutdown target identity');
          } finally { await session.detach(); }
        }, graceMs);
      }
      return client;
    }, 32_000);
    browser.close = close;
    return browser;
  } catch (error) {
    await close();
    throw error;
  }
}
