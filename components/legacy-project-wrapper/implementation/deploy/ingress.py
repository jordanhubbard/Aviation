"""Atomically move installed app sites to Meta App, preserving service processes."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import urllib.request


def configure(config, *, root=Path('/etc/caddy'), run=subprocess.run, open_url=urllib.request.urlopen):
    gateway_port = config['gateway_port']
    changes = {}
    for app in config['apps']:
        host = app['host']
        # Prove the new gateway serves the correct native host before any cutover.
        request = urllib.request.Request(f"http://127.0.0.1:{gateway_port}{app['health']}", headers={'Host': host})
        with open_url(request, timeout=10) as response:
            if response.status != 200 or response.headers.get('x-aviation-namespace') != app['namespace']:
                raise RuntimeError(f"Meta App native ingress is not ready for {host}")
        site = root / 'aviation-sites' / (app['name'] + '.caddy')
        if not site.exists() and app.get('native'):
            site = root / 'Caddyfile'  # Older native analyzer installations own an inline block.
        if not site.is_file() or site.is_symlink():
            raise RuntimeError(f"Missing or unsafe installed site for {host}")
        original = changes.get(site, (site.read_text(), None))[0]
        current = changes.get(site, (None, original))[1]
        pattern = rf'(?ms)^{re.escape(host)}[ \t]*\{{.*?^\}}'
        blocks = list(re.finditer(pattern, current))
        if len(blocks) != 1:
            raise RuntimeError(f"Expected exactly one installed host block for {host}")
        block = blocks[0]
        proxy = rf'(?m)^(\s*reverse_proxy\s+)127\.0\.0\.1:(?:{app["port"]}|{gateway_port})(\s*)$'
        replaced, count = re.subn(proxy, rf'\g<1>127.0.0.1:{gateway_port}\g<2>', block.group())
        if count != 1:
            raise RuntimeError(f"Unrecognized ingress configuration for {host}")
        updated = current[:block.start()] + replaced + current[block.end():]
        changes[site] = (original, updated)
    changed = {path: pair for path, pair in changes.items() if pair[0] != pair[1]}
    if not changed:
        print('All selected applications already use Meta App ingress')
        return
    backup = Path(tempfile.mkdtemp(prefix='aviation-ingress-', dir=root))

    def write(path, content):
        temporary = path.with_name(path.name + '.ingress-new')
        # Never follow a pre-existing staging path.
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, path.stat().st_mode & 0o777)
        try:
            with os.fdopen(fd, 'w') as stream:
                stream.write(content)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)

    for path in changed:
        shutil.copy2(path, backup / path.name)
    applied = []
    try:
        for path, (_, updated) in changed.items():
            write(path, updated)
            applied.append(path)
        run(['caddy', 'validate', '--config', str(root / 'Caddyfile')], check=True)
        run(['systemctl', 'reload', 'caddy'], check=True)
    except BaseException:
        for path in reversed(applied):
            write(path, changed[path][0])
        run(['caddy', 'validate', '--config', str(root / 'Caddyfile')], check=True)
        run(['systemctl', 'reload', 'caddy'], check=True)
        raise
    print(json.dumps({'updated_sites': len(changed), 'backup': str(backup), 'gateway_port': gateway_port}))


if __name__ == '__main__':
    configure(CONFIG)  # Injected as data by deploy.py; this helper is streamed over SSH.
