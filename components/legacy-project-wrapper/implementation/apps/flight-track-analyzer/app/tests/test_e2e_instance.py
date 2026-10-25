"""The deployed native test runner must destroy its store on stdin EOF."""
from pathlib import Path
import subprocess
import sys


HELPER = Path(__file__).resolve().parents[2] / 'deploy' / 'e2e_instance.py'
RUN_ID = 'e2e_' + 'c' * 32
REVISION = 'a' * 40


def run_helper(tmp_path: Path, revision: str) -> subprocess.CompletedProcess:
    runtime = tmp_path / 'runtime'
    (runtime / 'venv' / 'bin').mkdir(parents=True)
    (runtime / 'app').mkdir()
    (runtime / 'venv' / 'bin' / 'python').symlink_to(sys.executable)
    (runtime / 'app' / 'run.py').write_text('import time\ntime.sleep(60)\n')
    (runtime / 'revision').write_text(REVISION)
    code = '''
import importlib.util
import sys
from pathlib import Path
spec = importlib.util.spec_from_file_location('e2e_instance', sys.argv[1])
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
helper.RUNTIME = Path(sys.argv[2])
helper.TEST_ROOT = Path(sys.argv[3])
sys.argv = ['e2e_instance', '--run-id', sys.argv[4], '--revision', sys.argv[5], '--port', '29999']
raise SystemExit(helper.main())
'''
    return subprocess.run(
        [sys.executable, '-c', code, str(HELPER), str(runtime), str(tmp_path / 'test-root'),
         RUN_ID, revision], input='test-secret-at-least-thirty-two-characters\n',
        capture_output=True, text=True, timeout=12,
    )


def test_native_runner_cleans_run_on_stdin_close(tmp_path: Path):
    result = run_helper(tmp_path, REVISION)
    assert result.returncode == 0, result.stderr
    assert not (tmp_path / 'test-root' / RUN_ID).exists()


def test_native_runner_rejects_wrong_revision_before_creating_data(tmp_path: Path):
    result = run_helper(tmp_path, 'b' * 40)
    assert result.returncode != 0
    assert 'differs' in result.stderr
    assert not (tmp_path / 'test-root').exists()
