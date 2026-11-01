"""Exercise real saved-plan and recording writes in an isolated planner process."""
import os
import shutil
import subprocess
import sys
from pathlib import Path


def test_signed_run_uses_only_tagged_test_storage():
    run = 'e2e_' + 'b' * 32
    root = Path('/tmp/aviation-e2e') / run
    secret = 'planner-test-secret-at-least-thirty-two-characters'
    source = Path(__file__).resolve().parents[4] / 'packages' / 'shared-sdk' / 'python'
    env = {**os.environ, 'AVIATION_E2E_RUN_ID': run, 'AVIATION_E2E_SECRET': secret,
           'AVIATION_E2E_DATA_DIR': str(root), 'PYTHONPATH': str(source)}
    code = '''
import hashlib, hmac, json, subprocess, sys, time
from fastapi.testclient import TestClient
from app import create_app
from app.config import settings
run = 'e2e_' + 'b' * 32
secret = 'planner-test-secret-at-least-thirty-two-characters'
expiry = str(int(time.time() * 1000) + 60000)
signature = hmac.new(secret.encode(), f'flight-planner\\n{run}\\n{expiry}'.encode(), hashlib.sha256).hexdigest()
headers = {'x-aviation-test-run': run, 'x-aviation-test-expires': expiry, 'x-aviation-test-signature': signature}
client = TestClient(create_app(settings))
assert client.get('/__e2e/status').status_code == 403
assert client.get('/__e2e/status', headers=headers).json()['saved_plan_count'] == 0
created = client.post('/flight-plans/', json={'name': 'E2E Bay flight'}, headers=headers)
assert created.status_code == 201, created.text
plan_id = created.json()['metadata']['id']
assert client.get(f'/flight-plans/{plan_id}', headers=headers).status_code == 200
assert client.get('/__e2e/status', headers=headers).json()['saved_plan_count'] == 1
assert client.delete(f'/flight-plans/{plan_id}', headers=headers).status_code == 204
imported_ids = []
for fmt, content in [('gpx', '<gpx><trk><name>Tagged import</name></trk></gpx>'),
                     ('fpl', '(FPL-Tagged import-IS\\n-KOAKKSFO\\n)')]:
    imported = client.post('/flight-plans/import', headers=headers,
                           json={'format': fmt, 'content': content, 'name': f'E2E {fmt}'})
    assert imported.status_code == 201, imported.text
    imported_ids.append(imported.json()['metadata']['id'])
    # Check before update can repair an untagged imported row.
    assert client.get('/__e2e/status', headers=headers).json()['saved_plan_count'] == len(imported_ids)
    assert client.put(f'/flight-plans/{imported_ids[-1]}', headers=headers,
                      json={'notes': 'Updated isolated import'}).status_code == 200
    exported = client.post(f'/flight-plans/{imported_ids[-1]}/export?fmt={fmt}', headers=headers)
    assert exported.status_code == 200, exported.text
    assert exported.json()['format'] == fmt
assert client.get('/__e2e/status', headers=headers).json()['saved_plan_count'] == 2
# A fresh interpreter reopens the actual JSON file, not the current in-memory map.
# Loading fails closed if either import or update lost its immutable SDK tags.
reopened = subprocess.run([sys.executable, '-c', """
from app.routers.flight_plan import _plans
from app.e2e import RUN_ID
assert len(_plans) == 2
assert all(p['is_test_data'] is True and p['test_run_id'] == RUN_ID for p in _plans.values())
assert all(p['notes'] == 'Updated isolated import' for p in _plans.values())
"""], capture_output=True, text=True, timeout=60)
assert reopened.returncode == 0, reopened.stdout + reopened.stderr
for imported_id in imported_ids:
    assert client.delete(f'/flight-plans/{imported_id}', headers=headers).status_code == 204
assert client.get('/__e2e/status', headers=headers).json()['saved_plan_count'] == 0
recording = client.post('/flight-recordings/', json={'metadata': {}, 'telemetry': {}, 'events': []}, headers=headers)
assert recording.status_code == 200, recording.text
recording_id = recording.json()['metadata']['id']
assert client.get('/__e2e/status', headers=headers).json()['recording_count'] == 1
assert client.delete(f'/flight-recordings/{recording_id}', headers=headers).status_code == 200
assert client.get('/__e2e/status', headers=headers).json()['recording_count'] == 0
'''
    try:
        result = subprocess.run([sys.executable, '-c', code], cwd=Path(__file__).resolve().parents[1],
                                env=env, capture_output=True, text=True, timeout=90)
        assert result.returncode == 0, result.stdout + result.stderr
        assert root.joinpath('e2e_runs.json').is_file()
        assert '"test_run_id": "' + run + '"' in root.joinpath('e2e_runs.json').read_text()
        assert root.joinpath('saved_flight_plans.json').read_text().strip() == '[]'
        assert root.joinpath('flight_recordings.json').read_text().strip() == '[]'
    finally:
        shutil.rmtree(root, ignore_errors=True)
    assert not root.exists()

    production_env = {key: value for key, value in env.items()
                      if key not in {'AVIATION_E2E_RUN_ID', 'AVIATION_E2E_DATA_DIR'}}
    production_probe = '''
from fastapi.testclient import TestClient
from app import create_app
from app.config import settings
client = TestClient(create_app(settings))
assert client.get('/api/health').status_code == 200
assert client.get('/api/health', headers={'x-aviation-test-run': 'e2e_' + 'b' * 32}).status_code == 403
'''
    result = subprocess.run([sys.executable, '-c', production_probe],
                            cwd=Path(__file__).resolve().parents[1], env=production_env,
                            capture_output=True, text=True, timeout=90)
    assert result.returncode == 0, result.stdout + result.stderr
