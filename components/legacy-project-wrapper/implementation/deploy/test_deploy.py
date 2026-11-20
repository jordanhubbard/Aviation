"""Post-deployment verification must cover every manifest app and exact revision."""
from __future__ import annotations

import json
import os
import queue
import secrets
import stat
import threading
import time
import urllib.request
import uuid
import importlib.util
import subprocess
import shlex
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location('aviation_deploy', Path(__file__).with_name('deploy.py'))
assert spec and spec.loader
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


ingress_spec = importlib.util.spec_from_file_location('aviation_ingress', Path(__file__).with_name('ingress.py'))
ingress = importlib.util.module_from_spec(ingress_spec)
ingress_spec.loader.exec_module(ingress)


class HealthyResponse:
    status = 200

    def read(self):
        return json.dumps({'revision': 'a' * 40}).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class VerifyTests(unittest.TestCase):
    def test_planner_mounts_worker_cache_read_only_without_worker_credentials(self):
        _, apps = deployment.load_manifest()
        planner = next(app for app in apps if app['name'] == 'flight-planner')
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            deployment.render(planner, 'a' * 40, target)
            unit = (target / 'service.unit').read_text()
            self.assertIn('src=/var/lib/aviation/flight-planner/nms,dst=/app/nms,readonly', unit)
            self.assertIn('src=/var/lib/aviation/flight-planner/data,dst=/app/data', unit)
            self.assertNotIn('FAA_NMS_CLIENT_', unit)
            self.assertNotIn('nms-production.env', unit)
            self.assertEqual((target / 'volumes.txt').read_text().splitlines(), ['data', 'nms'])

    def test_nms_worker_uses_one_private_environment_cache_and_same_revision_image(self):
        for environment in ['production', 'staging', 'fit']:
            unit = deployment.render_nms_worker(environment, 'a' * 40)
            command = next(line.removeprefix('ExecStart=') for line in unit.splitlines()
                           if line.startswith('ExecStart='))
            args = shlex.split(command)
            self.assertIn('aviation/flight-planner:' + 'a' * 12, args)
            self.assertEqual(args[-2:], ['-m', 'app.services.nms_worker'])
            self.assertEqual(args[args.index('--entrypoint') + 1], '/opt/venv/bin/python')
            self.assertIn(f'/etc/aviation/nms-{environment}.env', args)
            self.assertIn(f'FAA_NMS_ENVIRONMENT={environment}', args)
            self.assertIn(f'type=bind,src=/var/lib/aviation/flight-planner/nms/{environment},dst=/app/nms', args)
            self.assertEqual(args.count('--mount'), 1)
            self.assertIn('--read-only', args)
            self.assertIn('--tmpfs', args)
            self.assertIn('SQLITE_TMPDIR=/app/nms', args)
            self.assertIn('/tmp:rw,noexec,nosuid,size=32m', args)
            self.assertNotIn('-p', args)
            self.assertNotIn('--network', args)
            self.assertNotIn('FAA_NMS_CLIENT_ID=', unit)
            self.assertNotIn('FAA_NMS_CLIENT_SECRET=', unit)
            self.assertIn(f'ExecStop=/usr/bin/docker stop -t 15 aviation-nms-worker-{environment}', unit)
        for environment in ['', '../production', 'prod']:
            with self.assertRaises(ValueError):
                deployment.render_nms_worker(environment, 'a' * 40)
        with self.assertRaises(ValueError):
            deployment.render_nms_worker('production', 'main')

    def execute_nms_host_script(self, root, action, runner):
        script = deployment.nms_host_script(action, 'staging', 'new unit\n')
        for absolute in ['/etc/systemd/system', '/etc/aviation', '/var/lib/aviation/flight-planner/nms']:
            script = script.replace(repr(absolute), repr(str(root / absolute.lstrip('/'))))
        with patch('subprocess.run', side_effect=runner):
            exec(compile(script, '<nms-host-acceptance>', 'exec'), {})

    def test_nms_install_preserves_cache_and_does_not_start_or_enable_worker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            units = root / 'etc/systemd/system'
            units.mkdir(parents=True)
            cache = root / 'var/lib/aviation/flight-planner/nms/staging'
            cache.mkdir(parents=True)
            (cache / 'notams.sqlite3').write_bytes(b'reserved request and original receipts')
            calls = []
            def runner(args, **kwargs):
                calls.append(list(args))
                return subprocess.CompletedProcess(args, 3 if 'is-active' in args else 0, stdout='inactive\n')
            self.execute_nms_host_script(root, 'install', runner)
            self.assertEqual((units / 'aviation-nms-worker-staging.service').read_text(), 'new unit\n')
            self.assertEqual((cache / 'notams.sqlite3').read_bytes(), b'reserved request and original receipts')
            self.assertEqual(stat.S_IMODE(cache.stat().st_mode), 0o700)
            self.assertEqual(calls, [['systemctl', 'is-active', 'aviation-nms-worker-staging'], ['systemctl', 'daemon-reload']])
            self.assertFalse((root / 'etc/aviation/nms-staging.env').exists())

    def test_nms_unit_reload_failure_restores_prior_unit_and_cache(self):
        for previous in [None, 'old unit\n']:
            with self.subTest(previous=previous), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                units = root / 'etc/systemd/system'
                units.mkdir(parents=True)
                target = units / 'aviation-nms-worker-staging.service'
                if previous is not None:
                    target.write_text(previous)
                    target.chmod(0o600)
                reloads = []
                def runner(args, **kwargs):
                    if 'is-active' in args:
                        return subprocess.CompletedProcess(args, 3, stdout='inactive\n')
                    reloads.append(args)
                    if len(reloads) == 1:
                        raise subprocess.CalledProcessError(1, args)
                    return subprocess.CompletedProcess(args, 0)
                with self.assertRaises(subprocess.CalledProcessError):
                    self.execute_nms_host_script(root, 'install', runner)
                self.assertEqual(target.read_text() if target.exists() else None, previous)
                if previous is not None:
                    self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
                self.assertEqual(len(reloads), 2)
                self.assertTrue((root / 'var/lib/aviation/flight-planner/nms/staging').is_dir())

    def test_nms_install_refuses_active_or_transitioning_unit_before_changes(self):
        for state in ['active', 'activating', 'deactivating', 'reloading', '']:
            with self.subTest(state=state), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                with self.assertRaisesRegex(RuntimeError, 'Stop the owned worker'):
                    self.execute_nms_host_script(root, 'install', lambda *args, **kwargs:
                        subprocess.CompletedProcess(args, 0, stdout=state + '\n'))
                self.assertEqual(list(root.iterdir()), [])

    def test_nms_start_requires_private_complete_credential_file_without_echoing_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'etc/aviation/nms-staging.env'
            path.parent.mkdir(parents=True)
            cases = [
                ('FAA_NMS_CLIENT_ID=private-value\n', 0o600),
                ('FAA_NMS_CLIENT_ID=private-value\nFAA_NMS_CLIENT_SECRET=private-secret\nEXTRA=bad\n', 0o600),
                ('FAA_NMS_CLIENT_ID=private-value\nFAA_NMS_CLIENT_SECRET=private-secret\n', 0o644),
                ('FAA_NMS_CLIENT_ID=private-value\nFAA_NMS_CLIENT_SECRET="private-secret"\n', 0o600),
                ('FAA_NMS_CLIENT_ID=private-value\nFAA_NMS_CLIENT_ID=other\nFAA_NMS_CLIENT_SECRET=private-secret\n', 0o600),
            ]
            original_lstat = type(path).lstat
            def root_owned(p, *args, **kwargs):
                info = original_lstat(p, *args, **kwargs)
                if p == path:
                    values = list(info); values[4] = 0
                    return os.stat_result(values)
                return info
            for contents, mode in cases:
                path.write_text(contents); path.chmod(mode)
                runner = unittest.mock.Mock()
                with patch.object(type(path), 'lstat', root_owned):
                    with self.assertRaises(RuntimeError) as caught:
                        self.execute_nms_host_script(root, 'start', runner)
                self.assertNotIn('private-value', str(caught.exception))
                self.assertNotIn('private-secret', str(caught.exception))
                runner.assert_not_called()
            path.write_text('FAA_NMS_CLIENT_ID=private-value\nFAA_NMS_CLIENT_SECRET=private-secret\n')
            path.chmod(0o600)
            calls = []
            with patch.object(type(path), 'lstat', root_owned):
                self.execute_nms_host_script(root, 'start', lambda args, **kwargs: calls.append(list(args)))
            self.assertEqual(calls, [['systemctl', 'enable', '--now', 'aviation-nms-worker-staging'],
                                     ['systemctl', 'is-active', 'aviation-nms-worker-staging']])

    def test_explanation_callback_origin_matches_the_rendered_public_site(self):
        _, apps = deployment.load_manifest()
        for app in apps:
            with self.subTest(app=app['name']), tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                deployment.render(app, 'a' * 40, target)
                site = (target / 'site.caddy').read_text().split(' {', 1)[0]
                command = next(line.removeprefix('ExecStart=') for line in
                               (target / 'service.unit').read_text().splitlines() if line.startswith('ExecStart='))
                argv = shlex.split(command)
                environment = dict(argv[index + 1].split('=', 1) for index, value in enumerate(argv)
                                   if value == '--env')
                self.assertEqual(environment['AVIATION_APP_ID'], app['name'])
                self.assertEqual(environment['AVIATION_EXPLAIN_PUBLIC_URL'], 'https://' + site)

    def test_all_public_sites_use_gateway_and_private_bindings_cover_every_service(self):
        config, apps = deployment.load_manifest()
        gateway = next(app for app in apps if app['name'] == 'meta-app')
        for app in apps:
            with self.subTest(app=app['name']), tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                deployment.render(app, 'a' * 40, target)
                self.assertIn(f"reverse_proxy 127.0.0.1:{gateway['port']}", (target / 'site.caddy').read_text())
                self.assertIn('header Alt-Svc clear', (target / 'site.caddy').read_text())
                command = next(line.removeprefix('ExecStart=') for line in (target / 'service.unit').read_text().splitlines() if line.startswith('ExecStart='))
                argv = shlex.split(command)
                if app['name'] == 'meta-app':
                    self.assertNotIn('-p', argv)
                    self.assertEqual(argv[argv.index('--network') + 1], 'host')
                    env = dict(argv[i + 1].split('=', 1) for i, value in enumerate(argv) if value == '--env')
                    self.assertEqual(env['LISTEN_HOST'], '127.0.0.1')
                    self.assertEqual(env['PORT'], str(gateway['port']))
                    self.assertEqual(env['AVIATION_GATEWAY_APP_HOSTS'], '1')
                    bindings = json.loads(env['AVIATION_GATEWAY_BINDINGS'])
                    self.assertEqual(bindings['tracking']['websocketOrigin'], 'http://127.0.0.1:18777')
                    self.assertEqual({binding['origin'] for binding in bindings.values()},
                                     {f"http://127.0.0.1:{item['port']}" for item in apps if item['name'] != 'meta-app'})
                else:
                    self.assertIn(f"127.0.0.1:{app['port']}:{app['container_port']}", argv)
                    if 'websocket_port' in app:
                        self.assertIn(f"127.0.0.1:{app['websocket_port']}:{app['container_websocket_port']}", argv)

    def test_ingress_cutover_preflights_all_hosts_and_rolls_back_failed_caddy_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'aviation-sites').mkdir()
            caddy = root / 'Caddyfile'
            caddy.write_text('import aviation-sites/*.caddy\nkmlab.example.test {\n    reverse_proxy 127.0.0.1:18765\n}\n')
            site = root / 'aviation-sites/planner.caddy'
            site.write_text('planner.example.test {\n    reverse_proxy 127.0.0.1:18769\n}\n')
            config = {'gateway_port': 18774, 'apps': [
                {'name': 'planner', 'host': 'planner.example.test', 'namespace': 'planning', 'health': '/api/health', 'port': 18769},
                {'name': 'analyzer', 'host': 'kmlab.example.test', 'namespace': 'analysis', 'health': '/api/health', 'port': 18765, 'native': True},
            ]}
            originals = {path: path.read_text() for path in [caddy, site]}
            calls = []
            class Response(HealthyResponse):
                def __init__(self, namespace):
                    self.headers = {'x-aviation-namespace': namespace}
            def open_url(request, timeout):
                self.assertEqual(timeout, 10)
                self.assertTrue(request.full_url.startswith('http://127.0.0.1:18774/'))
                self.assertEqual({path: path.read_text() for path in originals}, originals)
                calls.append(request.get_header('Host'))
                return Response('planning' if calls[-1].startswith('planner') else 'analysis')
            for actions in ([subprocess.CalledProcessError(1, 'caddy'), None, None],
                            [None, subprocess.CalledProcessError(1, 'reload'), None, None]):
                calls.clear()
                runner = unittest.mock.Mock(side_effect=actions)
                with self.assertRaises(subprocess.CalledProcessError):
                    ingress.configure(config, root=root, run=runner, open_url=open_url)
                self.assertEqual(calls, ['planner.example.test', 'kmlab.example.test'])
                self.assertEqual({path: path.read_text() for path in originals}, originals)
            runner = unittest.mock.Mock()
            ingress.configure(config, root=root, run=runner, open_url=open_url)
            self.assertEqual(runner.call_count, 2)
            self.assertIn('reverse_proxy 127.0.0.1:18774', site.read_text())
            self.assertIn('reverse_proxy 127.0.0.1:18774', caddy.read_text())
            self.assertEqual(site.read_text().count('header Alt-Svc clear'), 1)
            self.assertEqual(caddy.read_text().count('header Alt-Svc clear'), 1)
            runner.reset_mock()
            def already_ready(request, timeout):
                return Response('planning' if request.get_header('Host').startswith('planner') else 'analysis')
            ingress.configure(config, root=root, run=runner, open_url=already_ready)
            runner.assert_not_called()
            # A wrong namespace fails before touching either installed file.
            updated = {path: path.read_text() for path in originals}
            with self.assertRaisesRegex(RuntimeError, 'not ready'):
                ingress.configure(config, root=root, run=runner, open_url=lambda *_args, **_kwargs: Response('wrong'))
            self.assertEqual({path: path.read_text() for path in originals}, updated)
            runner.assert_not_called()

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
            else:
                self.assertTrue(script.endswith('/isolated-e2e.mjs'))
                self.assertEqual(env['AVIATION_E2E_REVISION'], revision)

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


    def test_missing_application_revision_stops_even_when_the_image_label_matches(self):
        config, apps = deployment.load_manifest()
        app = next(item for item in apps if item['name'] == 'flight-planner')
        class MissingMetadata(HealthyResponse):
            def read(self):
                return b'{"revision":null,"repo_url":null}'
        calls = []
        with (patch.object(deployment, 'committed_revision', return_value='a' * 40),
              patch.object(deployment.socket, 'getaddrinfo', return_value=[
                  (None, None, None, None, (config['host'], 443))]),
              patch.object(deployment.urllib.request, 'urlopen', return_value=MissingMetadata()),
              patch.object(deployment, 'output', return_value='a' * 40),
              patch.object(deployment, 'run', side_effect=lambda *args, **kw: calls.append(args))):
            with self.assertRaisesRegex(RuntimeError, 'application metadata revision'):
                deployment.verify(config, [app], 'pilot@example-host')
        self.assertFalse(any(args and args[0] == 'node' for args in calls))

    def test_local_planner_build_supplies_runtime_revision_metadata(self):
        _, apps = deployment.load_manifest()
        app = next(item for item in apps if item['name'] == 'flight-planner')
        with patch.object(deployment, 'run') as runner:
            deployment.build(app, 'b' * 40)
        argv = runner.call_args.args
        self.assertIn('GIT_SHA=' + 'b' * 40, argv)
        self.assertIn('REPO_URL=https://github.com/jordanhubbard/Aviation', argv)


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
