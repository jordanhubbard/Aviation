import hashlib
import hmac
from pathlib import Path

import pytest

from aviation.e2e import isolated_run_directory, isolated_sqlite_path, verify_e2e_headers


def test_app_bound_short_lived_credential_and_fail_closed():
    run = 'e2e_' + 'a' * 32
    secret = 'test-e2e-secret-32-chars-minimum-value'
    now = 1760000000000
    expiry = str(now + 60000)
    signature = hmac.new(secret.encode(), f'flightschool\n{run}\n{expiry}'.encode(), hashlib.sha256).hexdigest()
    headers = {'x-aviation-test-run': run, 'x-aviation-test-expires': expiry,
               'x-aviation-test-signature': signature}
    assert verify_e2e_headers('flightschool', {}, secret, now) is None
    assert verify_e2e_headers('flightschool', headers, secret, now) == run
    assert isolated_sqlite_path('/tmp/aviation-e2e', run) == Path('/tmp/aviation-e2e').resolve() / f'{run}.db'
    assert isolated_run_directory('/tmp/aviation-e2e', run).name == run
    with pytest.raises(ValueError):
        isolated_sqlite_path('/tmp/aviation-e2e', '../production')
    for app, data, instant in [
        ('flight-planner', headers, now),
        ('flightschool', {**headers, 'x-aviation-test-signature': '0' * 64}, now),
        ('flightschool', {'x-aviation-test-run': run}, now),
        ('flightschool', headers, now + 61000),
    ]:
        with pytest.raises(ValueError):
            verify_e2e_headers(app, data, secret, instant)
