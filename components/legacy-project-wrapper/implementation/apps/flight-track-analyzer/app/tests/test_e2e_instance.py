"""The native worker cleans EOF; its independent service manager owns hard crashes."""
from pathlib import Path
from textwrap import dedent
import os
import json
import sqlite3
import time
import uuid
import subprocess
import sys

import pytest


HELPER = Path(__file__).resolve().parents[2] / 'deploy' / 'e2e_instance.py'
RUN_ID = 'e2e_' + 'c' * 32
REVISION = 'a' * 40


def run_helper(tmp_path: Path, revision: str, *, lifetime_ms=900000, private=True) -> subprocess.CompletedProcess:
    runtime = tmp_path / 'runtime'
    (runtime / 'venv' / 'bin').mkdir(parents=True)
    (runtime / 'app').mkdir()
    (runtime / 'venv' / 'bin' / 'python').symlink_to(sys.executable)
    (runtime / 'app' / 'run.py').write_text('import time\ntime.sleep(60)\n')
    (runtime / 'revision').write_text(REVISION)
    code = '''
import importlib.util
import sys
import os
from pathlib import Path
spec = importlib.util.spec_from_file_location('e2e_instance', sys.argv[1])
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.RUNTIME = Path(sys.argv[2])
helper.TEST_ROOT = Path(sys.argv[3])
run_dir = helper.TEST_ROOT / helper.unit_name(sys.argv[4])
if sys.argv[7] == 'True':
    run_dir.mkdir(parents=True, mode=0o700)
    os.environ['RUNTIME_DIRECTORY'] = str(run_dir)
sys.argv = ['e2e_instance', '--worker', '--run-id', sys.argv[4], '--revision', sys.argv[5], '--port', '29999', '--lifetime-ms', sys.argv[6]]
raise SystemExit(helper.main())
'''
    return subprocess.run(
        [sys.executable, '-c', code, str(HELPER), str(runtime), str(tmp_path / 'test-root'),
         RUN_ID, revision, str(lifetime_ms), str(private)], input='test-secret-at-least-thirty-two-characters\n',
        capture_output=True, text=True, timeout=12,
    )


def test_native_runner_cleans_run_on_stdin_close(tmp_path: Path):
    result = run_helper(tmp_path, REVISION)
    assert result.returncode == 0, result.stderr
    assert not (tmp_path / 'test-root' / f'aviation-e2e-kmlab-{RUN_ID}').exists()


def test_native_runner_rejects_wrong_revision_before_creating_data(tmp_path: Path):
    result = run_helper(tmp_path, 'b' * 40, private=False)
    assert result.returncode != 0
    assert 'differs' in result.stderr
    assert not (tmp_path / 'test-root').exists()


@pytest.mark.parametrize('lifetime', [0, -1, 900001])
def test_native_worker_rejects_unbounded_lifetimes(tmp_path: Path, lifetime):
    result = run_helper(tmp_path, REVISION, lifetime_ms=lifetime, private=False)
    assert result.returncode != 0
    assert 'invalid E2E lifetime' in result.stderr
    assert not (tmp_path / 'test-root').exists()


def test_native_worker_requires_manager_owned_private_directory(tmp_path: Path):
    result = run_helper(tmp_path, REVISION, private=False)
    assert result.returncode != 0
    assert 'not private and manager-owned' in result.stderr
    assert not (tmp_path / 'test-root').exists()


# Linux-manager qualification is selected explicitly; it is not a portable test.
if os.environ.get('AVIATION_E2E_NATIVE_MANAGER_TESTS') == '1':
    @pytest.mark.parametrize('mode', ['eof', 'helper-sigkill', 'controller-sigkill'])
    def test_independent_manager_removes_children_and_tagged_sqlite(tmp_path: Path, mode):
        run_id = 'e2e_' + uuid.uuid4().hex
        unit = 'aviation-e2e-kmlab-' + run_id
        runtime = tmp_path / 'runtime'
        (runtime / 'venv/bin').mkdir(parents=True)
        (runtime / 'venv/bin/python').symlink_to(sys.executable)
        (runtime / 'revision').write_text(REVISION)
        (runtime / 'app').mkdir()
        # An actual child process with actual tagged SQLite state, stubborn on TERM.
        (runtime / 'app/run.py').write_text(dedent("""
    import json,signal,sqlite3,sys,time
    from pathlib import Path
    root=Path(sys.argv[sys.argv.index('--data-dir')+1])
    run=root.name.split('kmlab-',1)[1]
    with sqlite3.connect(root/'fixture.sqlite3') as db:
        db.execute('CREATE TABLE flights (is_test_data INTEGER, test_run_id TEXT)')
        db.execute('INSERT INTO flights VALUES (1, ?)', (run,))
    (root/'child.json').write_text(json.dumps({'pid':__import__('os').getpid()}))
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    while True: time.sleep(.1)
    """))
        wrapper = tmp_path / 'helper.py'
        wrapper.write_text(dedent(f"""
    import importlib.util,signal,sys
    from pathlib import Path
    spec=importlib.util.spec_from_file_location('helper', {str(HELPER)!r})
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    helper.RUNTIME=Path({str(runtime)!r})
    helper.__file__=__file__
    signal.signal(signal.SIGTERM,lambda *_:sys.exit(143))
    raise SystemExit(helper.main())
    """))
        root = Path('/run/user') / str(os.getuid()) / unit
        proc = subprocess.Popen([sys.executable, str(wrapper), '--run-id', run_id,
            '--revision', REVISION, '--port', '29999', '--lifetime-ms', '8000'],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        def systemctl(*args, check=True):
            return subprocess.run(['systemctl', '--user', *args], text=True,
                capture_output=True, check=check, timeout=5)
        def process_exists(pid):
            try: os.kill(pid, 0); return True
            except ProcessLookupError: return False
        try:
            proc.stdin.write('test-secret-at-least-thirty-two-characters\n'); proc.stdin.flush()
            for _ in range(60):
                if (root/'child.json').exists(): break
                if proc.poll() is not None: pytest.fail(proc.stderr.read())
                time.sleep(.05)
            else: pytest.fail('test child did not start')
            pid = json.loads((root/'child.json').read_text())['pid']
            if mode == 'controller-sigkill':
                original = systemctl('show', unit+'.service', '-p', 'MainPID').stdout
                collision = subprocess.run([sys.executable, str(wrapper), '--run-id', run_id,
                    '--revision', REVISION, '--port', '29999', '--lifetime-ms', '8000'],
                    input='different-secret-at-least-thirty-two-characters\n',
                    text=True, capture_output=True, timeout=5)
                assert collision.returncode != 0
                assert systemctl('show', unit+'.service', '-p', 'MainPID').stdout == original
                assert root.exists()
            with sqlite3.connect(root/'fixture.sqlite3') as db:
                assert db.execute('SELECT * FROM flights').fetchall() == [(1, run_id)]
            properties = systemctl('show', unit+'.service', '-p', 'Transient', '-p', 'KillMode',
                                   '-p', 'RuntimeDirectoryPreserve').stdout
            assert 'Transient=yes' in properties
            assert 'KillMode=control-group' in properties
            assert 'RuntimeDirectoryPreserve=no' in properties
            if mode == 'eof': proc.stdin.close(); proc.stdin = None
            elif mode == 'helper-sigkill':
                systemctl('kill', '--kill-whom=main', '--signal=KILL', unit+'.service')
            else:
                proc.kill(); proc.wait(timeout=5)
                assert root.exists()
                assert systemctl('is-active', '--quiet', unit+'.service', check=False).returncode == 0
            for _ in range(240):
                if not root.exists() and not process_exists(pid): break
                time.sleep(.05)
            else: pytest.fail('manager leaked native data or child process')
            if proc.poll() is None: proc.wait(timeout=5)
        finally:
            systemctl('stop', unit+'.service', check=False)
            if proc.stdin: proc.stdin.close()
            if proc.poll() is None: proc.terminate(); proc.wait(timeout=5)
