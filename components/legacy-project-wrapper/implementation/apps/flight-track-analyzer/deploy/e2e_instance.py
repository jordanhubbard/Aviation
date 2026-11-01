#!/usr/bin/env python3
"""Run the deployed KMLab build with disposable data for one signed E2E session.

The caller sends the secret on stdin, keeps stdin open during the browser run,
then closes it. A transient user service owns the process group, private runtime
directory and deadline independently of this controller or its SSH connection.
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
import time
from pathlib import Path


RUNTIME = Path('/opt/kmlab')
TEST_ROOT = Path('/run/user') / str(os.getuid())


def unit_name(run_id: str) -> str:
    return f'aviation-e2e-kmlab-{run_id}'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--port', required=True, type=int)
    parser.add_argument('--lifetime-ms', type=int, default=900000)
    parser.add_argument('--expires-at-ms', type=int)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not re.fullmatch(r'e2e_[0-9a-f]{32}', args.run_id):
        parser.error('invalid E2E run ID')
    if not re.fullmatch(r'[0-9a-f]{40}', args.revision):
        parser.error('invalid revision')
    if not 1024 <= args.port <= 65535:
        parser.error('invalid port')
    if not 1 <= args.lifetime_ms <= 900000:
        parser.error('invalid E2E lifetime')
    remaining_ms = args.lifetime_ms
    if args.expires_at_ms is not None:
        remaining_ms = min(remaining_ms, args.expires_at_ms - time.time_ns() // 1000000)
    if remaining_ms <= 0:
        parser.error('E2E lease has expired')
    if (RUNTIME / 'revision').read_text().strip() != args.revision:
        parser.error('deployed KMLab revision differs from the tested revision')
    name = unit_name(args.run_id)
    if not args.worker:
        # The manager owns cleanup even if systemd-run, SSH, or this helper is killed.
        command = ['systemd-run', '--user', '--quiet', '--pipe', '--wait', '--collect',
                   f'--unit={name}', '--service-type=exec',
                   f'--property=RuntimeMaxSec={remaining_ms / 1000:.3f}s',
                   '--property=TimeoutStopSec=2s', '--property=KillMode=control-group',
                   f'--property=RuntimeDirectory={name}',
                   '--property=RuntimeDirectoryMode=0700',
                   '--property=RuntimeDirectoryPreserve=no',
                   '--property=UMask=0077', '--property=NoNewPrivileges=yes',
                   str(RUNTIME / 'venv/bin/python'), str(Path(__file__).resolve()),
                   '--worker', '--run-id', args.run_id, '--revision', args.revision,
                   '--port', str(args.port), '--lifetime-ms', str(args.lifetime_ms)]
        if args.expires_at_ms is not None:
            command.extend(['--expires-at-ms', str(args.expires_at_ms)])
        os.execvp(command[0], command)
        raise AssertionError('exec returned')
    run_dir = TEST_ROOT / name
    if (os.environ.get('RUNTIME_DIRECTORY') != str(run_dir)
            or run_dir.is_symlink() or not run_dir.is_dir()
            or run_dir.stat().st_uid != os.getuid() or run_dir.stat().st_mode & 0o077):
        parser.error('test runtime directory is not private and manager-owned')
    secret = sys.stdin.readline().rstrip('\n')
    if len(secret) < 32:
        parser.error('missing E2E secret')

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
                child.wait(timeout=1)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=1)
        if not run_dir.is_symlink():
            if marker.is_file() and marker.read_text() == args.run_id:
                shutil.rmtree(run_dir)
            elif run_dir.is_dir() and not any(run_dir.iterdir()):
                run_dir.rmdir()


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda _signal, _frame: sys.exit(143))
    raise SystemExit(main())
