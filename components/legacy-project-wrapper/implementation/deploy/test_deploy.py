"""Post-deployment verification must cover every manifest app and exact revision."""
from __future__ import annotations

import json
import os
import queue
import secrets
import threading
import time
import urllib.request
import uuid
import importlib.util
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location('aviation_deploy', Path(__file__).with_name('deploy.py'))
assert spec and spec.loader
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


class HealthyResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class VerifyTests(unittest.TestCase):
    def test_missing_registry_image_builds_and_ships_committed_source(self):
        config, apps = deployment.load_manifest()
        app = next(item for item in apps if item['name'] == 'meta-app')
        revision = 'a' * 40
        failed_pull = subprocess.CalledProcessError(1, 'docker pull')
        with (patch.object(deployment, 'run', side_effect=failed_pull),
              patch.object(deployment, 'fetch_image', side_effect=failed_pull),
              patch.object(deployment, 'build', return_value=deployment.image_name(app, revision)) as build,
              patch.object(deployment, 'ship_image') as ship,
              patch.object(deployment, 'output', return_value=revision)):
            deployment.prepare_remote_image(config, app, revision, 'pilot@example-host')
        build.assert_called_once_with(app, revision)
        ship.assert_called_once_with('pilot@example-host', deployment.image_name(app, revision))

    def test_every_app_runs_its_remote_adapter_after_revision_check(self):
        config, apps = deployment.load_manifest()
        revision = 'a' * 40
        calls = []
        with (patch.object(deployment, 'committed_revision', return_value=revision),
              patch.object(deployment.socket, 'getaddrinfo', return_value=[
                  (None, None, None, None, (config['host'], 443))]),
              patch.object(deployment.urllib.request, 'urlopen', return_value=HealthyResponse()),
              patch.object(deployment, 'output', return_value=revision),
              patch.object(deployment, 'run', side_effect=lambda *args, **kwargs: calls.append((args, kwargs)))):
            deployment.verify(config, apps, 'pilot@example-host')

        browser = [args for args, _ in calls if args[:2] == ('node', str(deployment.HERE / 'browser-smoke.mjs'))]
        self.assertEqual(len(browser), 1)
        adapters = [(args[1], args[2], kwargs.get('env')) for args, kwargs in calls
                    if args and args[0] == 'node' and args not in browser]
        self.assertEqual({name for _, name, _ in adapters}, {app['name'] for app in apps})
        self.assertEqual(len(adapters), len(apps))
        for script, name, env in adapters:
            if name == 'flight-track-analyzer':
                self.assertTrue(script.endswith('/isolated-native-e2e.mjs'))
                self.assertEqual(env['AVIATION_E2E_REVISION'], revision)
            elif name in {'aviation-accident-tracker', 'aviation-chat', 'aviation-missions-app', 'flight-planner', 'flightschool', 'flight-tracker'}:
                self.assertTrue(script.endswith('/isolated-e2e.mjs'))
                self.assertEqual(env['AVIATION_E2E_REVISION'], revision)
            else:
                self.assertTrue(script.endswith('/remote-e2e.mjs'))

    def test_wrong_running_revision_stops_before_browser_traffic(self):
        config, apps = deployment.load_manifest()
        calls = []
        with (patch.object(deployment, 'committed_revision', return_value='a' * 40),
              patch.object(deployment.socket, 'getaddrinfo', return_value=[
                  (None, None, None, None, (config['host'], 443))]),
              patch.object(deployment.urllib.request, 'urlopen', return_value=HealthyResponse()),
              patch.object(deployment, 'output', return_value='b' * 40),
              patch.object(deployment, 'run', side_effect=lambda *args, **kwargs: calls.append(args))):
            with self.assertRaisesRegex(RuntimeError, 'expected'):
                deployment.verify(config, [apps[0]], 'pilot@example-host')
        self.assertFalse(any(args and args[0] == 'node' for args in calls))


@unittest.skipUnless(os.environ.get('AVIATION_E2E_LEASE_TEST_IMAGE'), 'requires the isolated Flight Tracker image')
class LeaseIntegrationTests(unittest.TestCase):
    """Real Docker recovery; every fixture is test-owned and removed by immutable ID."""
    def setUp(self):
        self.image = os.environ['AVIATION_E2E_LEASE_TEST_IMAGE']
        self.fixture_owner = uuid.uuid4().hex
        self.created = {}
        self.controller = None

    def docker(self, *args, check=True):
        return subprocess.run(['docker', *args], text=True, capture_output=True, check=check, timeout=20)

    def exists(self, cid):
        return self.docker('inspect', cid, check=False).returncode == 0

    def sdk(self, payload):
        code = """const sdk=require(process.env.AVIATION_QUALIFICATION_SDK);
let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>{
const p=JSON.parse(data);let result;
if(p.operation==='lease')result=sdk.createE2ELease(p.app,p.run,p.now,p.ttl);
else result={headers:sdk.signE2EHeaders('flight-tracker',p.run,p.secret,Date.now(),300000),
 record:sdk.tagTestData(p.run,sdk.standardE2EMocks(p.run).tracker.flights[0])};
console.log(JSON.stringify(result));});"""
        env = {**os.environ, 'AVIATION_QUALIFICATION_SDK': str(deployment.IMPLEMENTATION / 'packages/shared-sdk/dist/e2e/index.js')}
        result = subprocess.run(['node', '-e', code], input=json.dumps(payload), text=True,
                                capture_output=True, env=env, check=True, timeout=10)
        return json.loads(result.stdout)

    def run_controller(self, **overrides):
        env = {**os.environ, 'AVIATION_E2E_IMAGE': self.image}
        for key in ['AVIATION_E2E_RUN_ID', 'AVIATION_E2E_SECRET', 'AVIATION_E2E_HOLD_AFTER_READY',
                    'AVIATION_E2E_LIFETIME_MS', 'AVIATION_E2E_SSH_HOST', 'AVIATION_E2E_REVISION',
                    'AVIATION_E2E_SWEEP_ONLY', 'AVIATION_E2E_FAIL_AFTER_SCREEN']:
            env.pop(key, None)
        env.update(overrides)
        return env

    def inspect(self, cid):
        result = self.docker('inspect', cid, '--format',
                             '{"id":{{json .Id}},"labels":{{json .Config.Labels}},"mounts":{{json .Mounts}}}')
        return json.loads(result.stdout)

    def tearDown(self):
        if self.controller and self.controller.poll() is None:
            self.controller.kill()
            self.controller.wait(timeout=5)
        if self.controller and self.controller.stdout:
            self.controller.stdout.close()
        for cid, run in self.created.items():
            if not self.exists(cid):
                continue
            info = self.inspect(cid)
            # Recovery cleanup never resolves a guessed name or touches another run.
            self.assertEqual(info['id'], cid)
            self.assertEqual(info['labels']['aviation.e2e.run'], run)
            self.docker('rm', '-f', '-v', cid)

    def test_killed_controller_leaves_real_data_until_independent_lease_expiry(self):
        run, secret = 'e2e_' + uuid.uuid4().hex, secrets.token_hex(32)
        env = self.run_controller(AVIATION_E2E_RUN_ID=run, AVIATION_E2E_SECRET=secret,
                                  AVIATION_E2E_HOLD_AFTER_READY='1', AVIATION_E2E_LIFETIME_MS='8000')
        runner = str(deployment.HERE / 'isolated-e2e.mjs')
        self.controller = subprocess.Popen(['node', runner, 'flight-tracker'], env=env,
                                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                           text=True, bufsize=1)
        lines = queue.Queue()
        def read_lines():
            for line in self.controller.stdout:
                lines.put(line)
        reader = threading.Thread(target=read_lines, daemon=True)
        reader.start()
        ready, observed = None, []
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            try:
                line = lines.get(timeout=.2)
            except queue.Empty:
                if self.controller.poll() is not None:
                    break
                continue
            observed.append(line)
            if line.startswith('{'):
                event = json.loads(line)
                if event.get('schema') == 'aviation/e2e-instance-ready@1':
                    ready = event
                    break
        self.assertIsNotNone(ready, ''.join(observed))
        self.assertTrue(ready['base_url'].startswith('http://127.0.0.1:'))
        name = f'aviation-e2e-flight-tracker-{run[-12:]}'
        cid = self.docker('ps', '-a', '--no-trunc', '--filter', f'name=^/{name}$', '--format', '{{.ID}}').stdout.strip()
        self.assertRegex(cid, r'^[a-f0-9]{64}$')
        self.created[cid] = run
        self.assertFalse(any(m['Type'] == 'bind' for m in self.inspect(cid)['mounts']))
        fixture = self.sdk(dict(operation='credentials', run=run, secret=secret))
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        def call(path, method='GET', data=None):
            request = urllib.request.Request(ready['base_url'] + path, method=method,
                headers={**fixture['headers'], 'content-type': 'application/json'},
                data=None if data is None else json.dumps(data).encode())
            with opener.open(request, timeout=3) as response:
                return response.status, json.load(response)
        self.assertEqual(call('/__e2e/fixtures', 'POST', dict(fixture_type='flight', record=fixture['record']))[0], 201)
        self.assertEqual(call('/api/tracked', 'POST', dict(icao24='e2e123'))[0], 200)
        self.assertEqual(call('/__e2e/status')[1]['count'], 4)
        # The janitor must preserve an active real instance and its actual data.
        active = subprocess.run(['node', runner, 'flight-tracker'],
            env=self.run_controller(AVIATION_E2E_SWEEP_ONLY='1'), capture_output=True, text=True, timeout=15)
        self.assertEqual(active.returncode, 0, active.stderr)
        self.assertEqual(call('/__e2e/status')[1]['count'], 4)
        self.controller.kill()
        self.assertLess(self.controller.wait(timeout=3), 0)
        reader.join(timeout=2)
        self.assertTrue(self.exists(cid), 'must observe the live resource after SIGKILL')
        until = time.monotonic() + 12
        while self.exists(cid) and time.monotonic() < until:
            time.sleep(.2)
        self.assertFalse(self.exists(cid), 'independent expiry must discard the private container and data')
        print('Lease recovery: controller SIGKILL after four real records; active sweep preserved them; independent expiry removed the instance')

    def test_sweep_preserves_foreign_unowned_active_and_colliding_resources(self):
        now = int(time.time() * 1000)
        protected, expired = [], None
        active_run = None
        for kind in ['expired', 'active', 'foreign', 'legacy', 'malformed', 'wrong-name', 'wrong-run']:
            run = 'e2e_' + uuid.uuid4().hex
            lease = self.sdk(dict(operation='lease', app='flight-tracker', run=run,
                                 now=now if kind == 'active' else now - 10000,
                                 ttl=900000 if kind == 'active' else 1000))
            name = f'aviation-e2e-flight-tracker-{run[-12:]}'
            if kind == 'foreign':
                lease['app_id'] = 'flight-planner'
            if kind == 'wrong-run':
                lease['test_run_id'] = 'e2e_' + uuid.uuid4().hex
            if kind == 'wrong-name':
                name = 'aviation-e2e-qualification-' + uuid.uuid4().hex
            labels = ['--label', f'aviation.e2e.run={run}', '--label', 'aviation.e2e.app=flight-tracker',
                      '--label', f'aviation.e2e.owner={self.fixture_owner}']
            if kind != 'legacy':
                labels += ['--label', 'aviation.e2e.lease=' + ('invalid-json' if kind == 'malformed' else json.dumps(lease))]
            cid = self.docker('create', '--name', name, *labels, '--entrypoint', 'sh', self.image, '-c', ('printf '+self.fixture_owner+'; sleep 60') if kind == 'active' else 'exit 0').stdout.strip()
            self.created[cid] = run
            if kind == 'expired':
                expired = cid
            else:
                protected.append(cid)
            if kind == 'active':
                active_run = run
                self.docker('start', cid)
        runner = str(deployment.HERE / 'isolated-e2e.mjs')
        unknown = subprocess.run(['node', runner, 'constructor'], env=self.run_controller(AVIATION_E2E_SWEEP_ONLY='1'),
                                 capture_output=True, text=True, timeout=10)
        self.assertNotEqual(unknown.returncode, 0)
        self.assertIn('No isolated E2E runtime', unknown.stderr)
        swept = subprocess.run(['node', runner, 'flight-tracker'], env=self.run_controller(AVIATION_E2E_SWEEP_ONLY='1'),
                               capture_output=True, text=True, timeout=20)
        self.assertEqual(swept.returncode, 0, swept.stderr)
        self.assertFalse(self.exists(expired))
        for cid in protected:
            self.assertTrue(self.exists(cid))
        # Reusing a run ID cannot authorize finally cleanup of another controller's resource.
        collision = subprocess.run(['node', runner, 'flight-tracker'],
            env=self.run_controller(AVIATION_E2E_RUN_ID=active_run, AVIATION_E2E_SECRET=secrets.token_hex(32)),
            capture_output=True, text=True, timeout=20)
        self.assertNotEqual(collision.returncode, 0)
        self.assertIn('another controller owner', collision.stderr)
        self.assertNotIn(self.fixture_owner, collision.stderr, 'must not collect another controller\'s logs')
        for cid in protected:
            self.assertTrue(self.exists(cid))
        print('Lease sweep: expired resource removed; six active/foreign/unowned/malformed/mismatched resources preserved, including a caller run-ID collision')


if __name__ == '__main__':
    unittest.main()
