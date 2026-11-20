import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { launchOwnedBrowser } from './browser-runner.mjs';
import { supportedBrowserNode } from './browser-runtime.mjs';

// #607 recurrence controls. These are ownership simulations, not native exit evidence.
function nativeFixture({ nativeExit = [0, null], sdkExit = [0, null], stall = false,
  executable = '/owned/Chromium.app/Contents/MacOS/Chromium', engine = 'chromium' } = {}) {
  const events = [];
  const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, signalCode: null, spawnfile: executable });
  const server = Object.assign(new EventEmitter(), { process: () => child, wsEndpoint: () => 'ws://owned' });
  const finish = (code, signal) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.exitCode = code;child.signalCode = signal;
    child.emit('exit', code, signal);server.emit('close', code, signal);
  };
  child.kill = signal => { events.push(`native:${signal}`);if (!stall) queueMicrotask(() => finish(...nativeExit));return true; };
  server.close = async () => { events.push('sdk:close');finish(...sdkExit); };
  server.kill = async () => { events.push('sdk:kill');finish(null, 'SIGKILL'); };
  let launchOptions;
  const type = {
    name: () => engine,
    launchServer: async options => { launchOptions = options;return server; },
    connect: async () => ({
      browserType: () => ({ name: () => engine }),
      close: async () => events.push('client:close'),
      newBrowserCDPSession: async () => ({ send: async () => ({ targetId: 'owned-target' }), detach: async () => {} }),
    }),
  };
  return { type, child, server, events, options: { platform: 'darwin', graceMs: 20, killMs: 20, report: e => events.push(e) }, launchOptions: () => launchOptions };
}

test('macOS headless default uses pinned regular Chromium and one owned graceful request', async () => {
  const f = nativeFixture();const b = await launchOwnedBrowser(f.type, { headless: true }, f.options);
  assert.equal(f.launchOptions().channel, 'chromium');
  await Promise.all([b.close(), b.close()]);
  assert.equal(f.events.filter(e => e === 'native:SIGTERM').length, 1);
  assert.equal(f.events.filter(e => e === 'sdk:close').length, 1);
  assert.ok(f.events.indexOf('client:close') < f.events.indexOf('native:SIGTERM'));
  assert.ok(f.events.indexOf('native:SIGTERM') < f.events.indexOf('sdk:close'));
  assert.ok(!f.events.includes('sdk:kill'));
  assert.ok(!f.events.some(e => e.status === 'recovered'));
});

for (const options of [{ channel: 'chrome' }, { channel: 'chromium' }, { executablePath: '/explicit/browser' }, { headless: false }]) {
  test(`explicit browser selection is preserved ${JSON.stringify(options)}`, async () => {
    const f = nativeFixture();const b = await launchOwnedBrowser(f.type, options, f.options);
    assert.equal(f.launchOptions().channel, options.channel);
    assert.equal(f.launchOptions().executablePath, options.executablePath);
    await b.close();
  });
}

for (const platform of ['linux', 'win32']) {
  test(`other platforms retain the SDK close path: ${platform}`, async () => {
    const f = nativeFixture();const b = await launchOwnedBrowser(f.type, {}, { ...f.options, platform });
    assert.equal(f.launchOptions().channel, undefined);await b.close();
    assert.ok(!f.events.includes('native:SIGTERM'));assert.ok(f.events.includes('sdk:close'));
  });
}

test('other browser engines retain their launch and close behavior', async () => {
  const f = nativeFixture({ engine: 'firefox' });const b = await launchOwnedBrowser(f.type, {}, f.options);
  assert.equal(f.launchOptions().channel, undefined);await b.close();assert.ok(!f.events.includes('native:SIGTERM'));
});

test('an explicitly chosen headless shell does not treat SIGTERM exit143 as normal', async () => {
  const executable = '/owned/chrome-headless-shell';const f = nativeFixture({ executable, nativeExit: [143, null] });
  const b = await launchOwnedBrowser(f.type, { executablePath: executable }, f.options);await b.close();
  assert.ok(!f.events.includes('native:SIGTERM'));assert.ok(f.events.includes('sdk:close'));
});

for (const nativeExit of [[2, null], [143, null], [null, 'SIGTERM'], [0, 'SIGTERM']]) {
  test(`non-normal native exit remains a failure: ${JSON.stringify(nativeExit)}`, async () => {
    const f = nativeFixture({ nativeExit });const b = await launchOwnedBrowser(f.type, {}, f.options);
    await assert.rejects(b.close(), /exit|signal|code/i);assert.ok(!f.events.some(e => e.status === 'recovered'));
  });
}

test('SDK close fulfillment cannot approve a nonzero process exit', async () => {
  const f = nativeFixture({ sdkExit: [2, null] });const b = await launchOwnedBrowser(f.type, {}, { ...f.options, platform: 'linux' });
  await assert.rejects(b.close(), /exit|signal|code/i);assert.ok(!f.events.some(e => e.status === 'recovered'));
});

test('stalled native request preserves bounded owned recovery and concurrent sharing', async () => {
  const f = nativeFixture({ stall: true });const b = await launchOwnedBrowser(f.type, {}, f.options);
  await Promise.all([b.close(), b.close()]);
  assert.equal(f.events.filter(e => e === 'native:SIGTERM').length, 1);
  assert.equal(f.events.filter(e => e === 'sdk:kill').length, 1);
  assert.equal(f.events.at(-1).status, 'recovered');
});

test('already ended owned handles are not signalled again', async () => {
  const f = nativeFixture();f.child.exitCode = 0;
  const b = await launchOwnedBrowser(f.type, {}, f.options);await b.close();
  assert.ok(!f.events.includes('native:SIGTERM'));assert.ok(f.events.includes('sdk:close'));
});

test('invalid native PID metadata cannot select a process signal path', async () => {
  const f = nativeFixture();f.child.pid = 0;const b = await launchOwnedBrowser(f.type, {}, f.options);await b.close();
  assert.ok(!f.events.includes('native:SIGTERM'));
});

test('native signal errors clean up only that owner and remain failures', async () => {
  const f = nativeFixture();f.child.kill = () => { throw new Error('signal denied'); };
  const b = await launchOwnedBrowser(f.type, {}, f.options);
  await assert.rejects(b.close(), /signal denied/);
  assert.ok(f.events.includes('sdk:kill'));assert.ok(!f.events.some(e => e.status === 'recovered'));
});

test('a request racing an already closing process accepts only its observed normal exit', async () => {
  const f = nativeFixture();const close = f.server.close;
  f.child.kill = () => { queueMicrotask(() => close());return false; };
  const b = await launchOwnedBrowser(f.type, {}, f.options);await b.close();
  assert.ok(!f.events.includes('sdk:kill'));assert.ok(!f.events.some(e => e.status === 'recovered'));
});

test('native startup connection failure retains its error after normal owner cleanup', async () => {
  const f = nativeFixture();f.type.connect = async () => { throw new Error('native connect failed'); };
  await assert.rejects(launchOwnedBrowser(f.type, {}, f.options), /native connect failed/);
  assert.equal(f.events.filter(e => e === 'native:SIGTERM').length, 1);
  assert.ok(!f.events.includes('sdk:kill'));assert.ok(!f.events.some(e => e.status === 'recovered'));
});

test('browser workers accept tested LTS versions and reject Node 26', () => {
  for (const version of ['v22.23.4', 'v24.13.0']) assert.ok(supportedBrowserNode(version));
  for (const version of ['v26.8.1', 'v20.0.0', '22', '']) assert.ok(!supportedBrowserNode(version));
});

const never = () => new Promise(() => {});
function fixture(overrides = {}) {
  const events = [];
  const server = {
    wsEndpoint: () => 'ws://owned',
    close: async () => { events.push('close'); },
    kill: async () => { events.push('kill'); },
    ...overrides,
  };
  const type = {
    launchServer: async options => { assert.equal(options.handleSIGTERM, false); return server; },
    connect: async endpoint => { assert.equal(endpoint, 'ws://owned'); return { newContext() {} }; },
  };
  return { type, events, options: { graceMs: 15, killMs: 15, report: e => events.push(e) } };
}
test('normal and concurrent close await the same owned server exit', async () => {
  const f = fixture();
  const browser = await launchOwnedBrowser(f.type, {}, f.options);
  await Promise.all([browser.close(), browser.close()]);
  assert.equal(f.events.filter(e => e === 'close').length, 1);
  assert.ok(!f.events.includes('kill'));
  assert.equal(f.events.at(-1).status, 'completed');
});
test('stalled graceful shutdown recovers only after owned process kill completes', async () => {
  let killed = false;
  const f = fixture({ close: never, kill: async () => { killed = true; } });
  const browser = await launchOwnedBrowser(f.type, {}, f.options);
  await browser.close();
  assert.ok(killed);
  assert.equal(f.events.at(-1).status, 'recovered');
});
test('a failed or stalled kill fails the run instead of claiming cleanup', async () => {
  for (const kill of [never, async () => { throw new Error('kill failed'); }]) {
    const f = fixture({ close: never, kill });
    const browser = await launchOwnedBrowser(f.type, {}, f.options);
    await assert.rejects(browser.close(), /kill/);
    assert.ok(!f.events.some(e => e.status === 'recovered'));
  }
});
test('graceful errors still kill the owned browser and remain failures', async () => {
  const f = fixture({ close: async () => { throw new Error('close failed'); } });
  const browser = await launchOwnedBrowser(f.type, {}, f.options);
  await assert.rejects(browser.close(), /close failed/);
  assert.ok(f.events.includes('kill'));
});
test('connection failure cleans up the launched process and signal handlers', async () => {
  const before = process.listenerCount('SIGTERM');
  const f = fixture();
  f.type.connect = async () => { throw new Error('connect failed'); };
  await assert.rejects(launchOwnedBrowser(f.type, {}, f.options), /connect failed/);
  assert.ok(f.events.includes('close'));
  assert.equal(process.listenerCount('SIGTERM'), before);
});

test('launch failure removes signal handlers', async () => {
  const before = process.listenerCount('SIGTERM');
  const f = fixture();
  f.type.launchServer = async () => { throw new Error('launch failed'); };
  await assert.rejects(launchOwnedBrowser(f.type, {}, f.options), /launch failed/);
  assert.equal(process.listenerCount('SIGTERM'), before);
});

test('SIGTERM during launch awaits and closes that owner with interruption status', () => {
  const source = `
    import { launchOwnedBrowser } from ${JSON.stringify(new URL('./browser-runner.mjs', import.meta.url).href)};
    setTimeout(() => process.kill(process.pid, 'SIGTERM'), 10);
    await launchOwnedBrowser({
      launchServer: async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { close: async () => console.log('OWNER_CLOSED'), wsEndpoint: () => 'fake' };
      }, connect: async () => ({}),
    }, {}, { report: () => {} });
    await new Promise(() => {});
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', timeout: 2000 });
  assert.equal(result.status, 143, result.stderr);
  assert.match(result.stdout, /OWNER_CLOSED/);
});

test('native connected-client cleanup precedes server close and is shared', async () => {
  const f = fixture();
  const connect = f.type.connect;
  f.type.connect = async (...args) => ({ ...await connect(...args), close: async () => f.events.push('disconnect') });
  const browser = await launchOwnedBrowser(f.type, {}, f.options);
  await Promise.all([browser.close(), browser.close()]);
  assert.equal(f.events.filter(e => e === 'disconnect').length, 1);
  assert.ok(f.events.indexOf('disconnect') < f.events.indexOf('close'));
  assert.ok(!f.events.includes('kill'));
});

test('stalled client disconnect recovers through the same owned kill boundary', async () => {
  const f = fixture();
  f.type.connect = async () => ({ close: never });
  const browser = await launchOwnedBrowser(f.type, {}, f.options);
  await browser.close();
  assert.ok(f.events.includes('kill'));
  assert.ok(f.events.some(e => e.phase === 'client.close' && e.status === 'failed'));
  assert.equal(f.events.at(-1).status, 'recovered');
});

test('client disconnect errors kill the owner and remain failures', async () => {
  const f = fixture();
  f.type.connect = async () => ({ close: async () => { throw new Error('disconnect failed'); } });
  const browser = await launchOwnedBrowser(f.type, {}, f.options);
  await assert.rejects(browser.close(), /disconnect failed/);
  assert.ok(f.events.includes('kill'));
});

function chromiumFixture({ send, detach } = {}) {
  const f = fixture();
  f.type.connect = async () => ({
    browserType: () => ({ name: () => 'chromium' }),
    close: async () => f.events.push('disconnect'),
    newBrowserCDPSession: async () => ({
      send: send || (async (method, args) => {
        assert.equal(method, 'Target.createTarget');
        assert.deepEqual(args, { url: 'about:blank' });
        f.events.push('target');
        return { targetId: 'owned-target' };
      }),
      detach: detach || (async () => f.events.push('detach')),
    }),
  });
  return f;
}

test('Chromium retains one default target before use and detaches its CDP session', async () => {
  const f = chromiumFixture();
  const browser = await launchOwnedBrowser(f.type, {}, f.options);
  assert.deepEqual(f.events.filter(e => typeof e === 'string'), ['target', 'detach']);
  await Promise.all([browser.close(), browser.close()]);
  assert.deepEqual(f.events.filter(e => typeof e === 'string'), ['target', 'detach', 'disconnect', 'close']);
});

test('other browsers do not prepare a Chromium target', async () => {
  const f = fixture();
  f.type.connect = async () => ({
    browserType: () => ({ name: () => 'firefox' }),
    newBrowserCDPSession: () => { throw new Error('unexpected CDP'); },
  });
  await (await launchOwnedBrowser(f.type, {}, f.options)).close();
  assert.ok(!f.events.includes('kill'));
});

test('target errors, invalid identity and stalled preparation fail startup and clean ownership', async () => {
  for (const send of [
    async () => { throw new Error('target failed'); },
    async () => ({}), async () => ({ targetId: '' }), never,
  ]) {
    const before = process.listenerCount('SIGTERM');
    const f = chromiumFixture({ send });
    await assert.rejects(launchOwnedBrowser(f.type, {}, f.options), /target|shutdown.target/);
    assert.ok(f.events.indexOf('disconnect') < f.events.indexOf('close'));
    assert.ok(!f.events.some(e => e.phase === 'shutdown' && e.status === 'recovered'));
    assert.equal(process.listenerCount('SIGTERM'), before);
  }
});

test('CDP session creation or detach failures fail startup and close the owner', async () => {
  for (const failCreation of [true, false]) {
    const f = chromiumFixture({ detach: async () => { throw new Error('session failed'); } });
    if (failCreation) {
      const connect = f.type.connect;
      f.type.connect = async () => ({ ...await connect(), newBrowserCDPSession: async () => { throw new Error('session failed'); } });
    }
    await assert.rejects(launchOwnedBrowser(f.type, {}, f.options), /session failed/);
    assert.ok(f.events.includes('disconnect'));
    assert.ok(f.events.includes('close'));
  }
});
