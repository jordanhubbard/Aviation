import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { e2eNamespaceDeadlineCommand, e2eHostDeadlineCommand } from '../index.js';
import { describe, expect, it } from 'vitest';
import { assertTestDataForRun, createE2ERunId, isolatedSqlitePath, parseE2ERunId, seedRemoteFixture,
  signE2EHeaders, standardE2EFixtures, tagTestData, verifyE2EHeaders, withE2ERun,
  installE2EApiHeaders, installE2ENetworkMocks, standardE2EMocks, runE2EScreens } from '../index.js';

const secret = 'test-only-secret-with-at-least-32-characters';

describe('remote E2E isolation contract', () => {
  it('leaves clock headroom below the server credential lifetime ceiling', async () => {
    await withE2ERun(secret, async run => {
      const serverNow = Date.now() - 1000;
      const headers = run.headersFor('flight-tracker');
      expect(verifyE2EHeaders('flight-tracker', headers, secret, serverNow)).toBe(run.id);
    });
  });

  it('requires an explicit run tag and never accepts a production or foreign record', () => {
    const runId = createE2ERunId();
    const tagged = tagTestData(runId, { title: 'fixture' });
    expect(tagged).toMatchObject({ is_test_data: true, test_run_id: runId });
    expect(() => assertTestDataForRun(tagged, runId)).not.toThrow();
    expect(() => assertTestDataForRun({ title: 'production' }, runId)).toThrow();
    expect(() => assertTestDataForRun(tagged, createE2ERunId())).toThrow();
    expect(() => tagTestData(runId, tagged)).toThrow();
    expect(() => parseE2ERunId('production')).toThrow();
    expect(Object.values(standardE2EFixtures(runId)).every(record =>
      record.is_test_data && record.test_run_id === runId)).toBe(true);
    expect(isolatedSqlitePath('/tmp/aviation-e2e', runId)).toBe(`/tmp/aviation-e2e/${runId}.db`);
    expect(() => isolatedSqlitePath('/tmp/aviation-e2e', '../production' as typeof runId)).toThrow();
  });

  it('binds short-lived credentials to the intended app and run', () => {
    const runId = createE2ERunId();
    const now = 1_800_000_000_000;
    const headers = signE2EHeaders('aviation-missions-app', runId, secret, now);
    expect(verifyE2EHeaders('aviation-missions-app', headers, secret, now)).toBe(runId);
    expect(() => verifyE2EHeaders('flightschool', headers, secret, now)).toThrow();
    expect(() => verifyE2EHeaders('aviation-missions-app', headers, secret, now + 900_001)).toThrow();
    expect(() => verifyE2EHeaders('aviation-missions-app', { 'x-aviation-test-run': runId }, secret, now)).toThrow();
    expect(() => verifyE2EHeaders('aviation-missions-app', { 'x-aviation-test-run': '' }, secret, now)).toThrow();
    expect(verifyE2EHeaders('aviation-missions-app', {}, secret, now)).toBeNull();
  });

  it('deletes tagged database fixtures and verifies zero residual rows even after a test failure', async () => {
    const rows = new Map<string, object[]>();
    const requests: string[] = [];
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const path = new URL(String(url)).pathname;
      const method = init?.method ?? 'GET';
      requests.push(`${method} ${path}`);
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { record: object };
        const runId = (body.record as { test_run_id: string }).test_run_id;
        rows.set(runId, [body.record]);
        return Response.json({ id: 1 }, { status: 201 });
      }
      const runId = path.split('/').at(-1)!;
      if (method === 'DELETE') rows.delete(runId);
      return Response.json({ count: rows.get(runId)?.length ?? 0 });
    };
    await expect(withE2ERun(secret, async run => {
      await seedRemoteFixture(run, { appId: 'aviation-missions-app',
        baseUrl: 'https://missions.example.test', fetch: mockFetch as typeof fetch },
      'mission', run.tag({ title: 'fixture' }));
      throw new Error('browser assertion failed');
    })).rejects.toThrow('E2E run or cleanup failed');
    expect(rows.size).toBe(0);
    expect(requests.map(request => request.split(' ')[0])).toEqual(['POST', 'DELETE', 'GET']);
  });

  it('rejects incomplete screen inventories and keeps credentials on the app API origin', async () => {
    await expect(runE2EScreens(['list', 'detail'], [{ id: 'list', dataMode: 'sdk-mock',
      visit: async () => {}, verify: async () => {} }])).rejects.toThrow('inventory mismatch');
    const handlers: Array<(route: any) => Promise<void>> = [];
    await withE2ERun(secret, async run => {
      await installE2EApiHeaders({ route: async (_url, handler) => { handlers.push(handler); } },
        'https://tracker.example.test/', 'aviation-accident-tracker', run);
      const supplied: Record<string, string>[] = [];
      await handlers[0]({ request: () => ({ url: () => 'https://tracker.example.test/api/events',
        headers: () => ({ accept: 'application/json' }) }),
      continue: async ({ headers }: { headers: Record<string, string> }) => { supplied.push(headers); } });
      expect(supplied[0]['x-aviation-test-run']).toBe(run.id);
      expect(supplied[0].accept).toBe('application/json');
      await expect(handlers[0]({ request: () => ({ url: () => 'https://other.example.test/api/events',
        headers: () => ({}) }), continue: async () => {} })).rejects.toThrow('escaped app origin');
    });
  });

  it('serves tagged standard mocks without contacting an external service', async () => {
    const routes: Array<{ url: string; handler: (route: any) => Promise<void> }> = [];
    await withE2ERun(secret, async run => {
      const weather = standardE2EMocks(run.id).weather;
      await installE2ENetworkMocks({ route: async (url, handler) => { routes.push({ url, handler }); } },
        'https://weather.example.test/', run, [{ path: '/api/weather/KOAK', response: weather }]);
      expect(routes[0].url).toBe('https://weather.example.test/api/weather/KOAK');
      let body = '';
      await routes[0].handler({ fulfill: async (options: { body: string }) => { body = options.body; } });
      expect(JSON.parse(body)).toMatchObject({ is_test_data: true, test_run_id: run.id, station: 'KOAK' });
      await expect(installE2ENetworkMocks({ route: async () => {} }, 'https://weather.example.test/', run,
        [{ path: '/briefing', response: weather, textBody: 'untagged text' }])).rejects.toThrow('contain its run ID');
      await expect(installE2ENetworkMocks({ route: async () => {} }, 'https://weather.example.test/', run,
        [{ path: '//other.example.test/steal', response: weather }])).rejects.toThrow('same-origin');
    });
  });
});


describe.skipIf(process.platform === 'win32')('POSIX independent foreground-command deadline', () => {
  it('preserves literal argv and normal exit without a live timer', () => {
    const args = ['spaces and quotes " here', '$(literal-not-a-command)', '$HOME'];
    const command = e2eNamespaceDeadlineCommand([process.execPath, '-e', "console.log(JSON.stringify({args:process.argv.slice(1),input:require('node:fs').readFileSync(0,'utf8')}))", ...args], 10000);
    const result = spawnSync(command[0], command.slice(1), { encoding: 'utf8', input: 'private test input\n', timeout: 3000 });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ args, input: 'private test input\n' });
  });
  it('does not start a command whose absolute resource lease has already expired', () => {
    const command = e2eNamespaceDeadlineCommand([process.execPath, '-e', "console.log('must-not-start')"], 10000, 1000, Date.now() - 1000);
    const result = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 2000 });
    expect(result.status).toBe(124);
    expect(result.stdout).toBe('');
  });
  it('kills a foreground process that ignores the first termination signal', () => {
    const command = e2eNamespaceDeadlineCommand([process.execPath, '-e', "process.on('SIGTERM',()=>console.log('termination-ignored'));setInterval(()=>{},10000)"], 1000, 1000);
    const result = spawnSync(command[0], command.slice(1), { encoding: 'utf8', timeout: 4500 });
    expect(result.stdout).toContain('termination-ignored');
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
  });
  it('retains the deadline timer after the controller shell is killed', async () => {
    const command = e2eNamespaceDeadlineCommand([process.execPath, '-e', 'console.log(process.pid);setInterval(()=>{},10000)'], 1000, 1000);
    const shell = spawn(command[0], command.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    const [chunk] = await once(shell.stdout!, 'data');
    const pid = Number(chunk.toString().trim());
    expect(Number.isInteger(pid)).toBe(true);
    shell.kill('SIGKILL');
    await once(shell, 'close'); // Pipes close only after the independent timer and command exit.
    const state = spawnSync('ps', ['-p', String(pid), '-o', 'stat='], { encoding: 'utf8' });
    expect(state.status !== 0 || state.stdout.trim().startsWith('Z')).toBe(true);
  }, 6000);
});


describe.skipIf(process.platform === 'win32')('owned host command supervisor', () => {
  it('preserves arguments and stdin and cancels the deadline when the child exits', () => {
    const args = ['literal $HOME', 'quotes " and spaces'];
    const cmd = e2eHostDeadlineCommand([process.execPath, '-e', "console.log(JSON.stringify({args:process.argv.slice(1),input:require('node:fs').readFileSync(0,'utf8')}))", ...args], 10000);
    const result = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', input: 'private input', timeout: 3000 });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({args, input: 'private input'});
  });
  it('escalates termination through the owned handle and reports expiry', () => {
    const cmd = e2eHostDeadlineCommand([process.execPath, '-e', "process.on('SIGTERM',()=>console.log('ignored'));setInterval(()=>{},10000)"], 1000, 1000);
    const result = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', timeout: 4500 });
    expect(result.stdout).toContain('ignored');
    expect(result.status).toBe(124);
  });
  it('survives loss of the allocating controller and stops its own foreground child', async () => {
    const command = e2eHostDeadlineCommand([process.execPath, '-e', 'console.log(process.pid);setInterval(()=>{},10000)'], 1000, 1000);
    const controller = spawn(process.execPath, ['-e', "const {spawn}=require('node:child_process');const c=JSON.parse(process.argv[1]);spawn(c[0],c.slice(1),{stdio:['ignore','inherit','inherit']});", JSON.stringify(command)], {stdio:['ignore','pipe','pipe']});
    const [data] = await once(controller.stdout!, 'data');
    const pid = Number(data.toString().trim());
    expect(Number.isInteger(pid)).toBe(true);
    controller.kill('SIGKILL');
    await once(controller, 'close'); // The supervisor/child still own these pipes until they finish.
    const state = spawnSync('ps', ['-p',String(pid),'-o','stat='], {encoding:'utf8'});
    expect(state.status !== 0 || state.stdout.trim().startsWith('Z')).toBe(true);
  }, 6000);
});
