#!/usr/bin/env python3
"""Run the deployed KMLab build with disposable data for one signed E2E session.

The caller sends the secret on stdin, keeps stdin open during the browser run,
then closes it. EOF or a termination signal stops the child and removes data.
"""
from __future__ import annotations

import argparse
import os
import re
import select
import shutil
import signal
import subprocess
import sys
from pathlib import Path


RUNTIME = Path('/opt/kmlab')
TEST_ROOT = Path('/tmp/aviation-e2e')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--port', required=True, type=int)
    args = parser.parse_args()
    if not re.fullmatch(r'e2e_[0-9a-f]{32}', args.run_id):
        parser.error('invalid E2E run ID')
    if not re.fullmatch(r'[0-9a-f]{40}', args.revision):
        parser.error('invalid revision')
    if not 1024 <= args.port <= 65535:
        parser.error('invalid port')
    if (RUNTIME / 'revision').read_text().strip() != args.revision:
        parser.error('deployed KMLab revision differs from the tested revision')
    secret = sys.stdin.readline().rstrip('\n')
    if len(secret) < 32:
        parser.error('missing E2E secret')

    TEST_ROOT.mkdir(mode=0o700, exist_ok=True)
    if TEST_ROOT.stat().st_uid != os.getuid() or TEST_ROOT.stat().st_mode & 0o077:
        parser.error('test root is not private to this user')
    run_dir = TEST_ROOT / args.run_id
    run_dir.mkdir(mode=0o700)
    marker = run_dir / '.aviation-e2e-run'
    child = None
    try:
        marker.write_text(args.run_id)
        env = {**os.environ, 'AVIATION_E2E_SECRET': secret,
               'PYTHONPATH': str(RUNTIME / 'sdk-python')}
        child = subprocess.Popen([
            str(RUNTIME / 'venv/bin/python'), str(RUNTIME / 'app/run.py'),
            '--host', '127.0.0.1', '--port', str(args.port),
            '--data-dir', str(run_dir),
        ], cwd=RUNTIME / 'app', env=env, stdin=subprocess.DEVNULL)
        secret = ''
        sys.stdout.write('KMLab isolated instance started\n')
        sys.stdout.flush()
        while True:
            if child.poll() is not None:
                raise RuntimeError(f'KMLab isolated server exited {child.returncode}')
            if select.select([sys.stdin], [], [], 0.5)[0] and not sys.stdin.read(1):
                break
        return 0
    finally:
        if child is not None and child.poll() is None:
            child.terminate()
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=10)
        if not run_dir.is_symlink():
            if marker.is_file() and marker.read_text() == args.run_id:
                shutil.rmtree(run_dir)
            elif run_dir.is_dir() and not any(run_dir.iterdir()):
                run_dir.rmdir()


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda _signal, _frame: sys.exit(143))
    raise SystemExit(main())
