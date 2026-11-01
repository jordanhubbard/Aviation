"""Post-deployment verification must cover every manifest app and exact revision."""
from __future__ import annotations

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


if __name__ == '__main__':
    unittest.main()
