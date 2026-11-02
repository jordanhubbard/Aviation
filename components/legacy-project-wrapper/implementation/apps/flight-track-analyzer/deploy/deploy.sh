#!/bin/sh
# Deploy the committed analyzer from the Aviation tree. Usage: deploy/deploy.sh do-host1
# Idempotent: creates the service user, venv, systemd unit; adds the Caddy vhost only if missing.
set -eu
HOST=${1:?usage: deploy.sh HOST}
REPO=$(git rev-parse --show-toplevel)
REVISION=$(git rev-parse HEAD)
APP=components/legacy-project-wrapper/implementation/apps/flight-track-analyzer
AIRPORTS=components/legacy-project-wrapper/implementation/packages/shared-sdk/data/airports_cache.json
SDK=components/legacy-project-wrapper/implementation/packages/shared-sdk/python
DYNAMICS=components/legacy-project-wrapper/implementation/packages/flight-dynamics
IMPLEMENTATION=components/legacy-project-wrapper/implementation
cd "$REPO"
[ -z "$(git status --porcelain --untracked-files=all -- "$APP/app" "$APP/deploy" "$IMPLEMENTATION/packages" "$IMPLEMENTATION/pnpm-lock.yaml" "$IMPLEMENTATION/package.json" "$IMPLEMENTATION/deploy/apps.json")" ] || {
  echo "uncommitted changes in flight-track-analyzer or airport data: commit first" >&2; exit 1;
}
# Build the same closed, pure-JavaScript SDK closure used by container applications.
mkdir -p "$REPO/_build"
SDK_STAGE=$(mktemp -d "$REPO/_build/kmlab-explanation.XXXXXX")
trap 'rm -rf "$SDK_STAGE"' EXIT
trap 'exit 1' HUP INT TERM
if command -v pnpm >/dev/null 2>&1; then
  run_pnpm() { pnpm "$@"; }
else
  run_pnpm() { corepack pnpm "$@"; }
fi
(
  cd "$IMPLEMENTATION"
  run_pnpm install --frozen-lockfile --filter @aviation/ai-explainer...
  run_pnpm --filter @aviation/ai-explainer... run build
  run_pnpm --config.node-linker=hoisted --filter @aviation/ai-explainer deploy --legacy --prod "$SDK_STAGE/runtime"
)
python3 - "$SDK_STAGE/runtime" "$REVISION" "$IMPLEMENTATION/deploy/apps.json" <<'PY'
from pathlib import Path
import json, os, sys
runtime = Path(sys.argv[1]).resolve()
for directory, dirs, files in os.walk(runtime):
    for name in dirs + files:
        path = Path(directory) / name
        if path.is_symlink() and not path.resolve().is_relative_to(runtime):
            raise SystemExit('SDK runtime symlink escapes artifact')
        if path.suffix == '.node':
            raise SystemExit('Native addons require target-specific SDK packaging')
config = json.loads(Path(sys.argv[3]).read_text())
app = next(item for item in config['apps'] if item['name'] == 'flight-track-analyzer')
(runtime / 'public.env').write_text('AVIATION_EXPLAIN_PUBLIC_URL=https://' + app.get('hostname', app['name']) + '.' + config['domain'] + '\n')
(runtime / 'source-revision').write_text(sys.argv[2] + '\n')
PY
tar -czf - -C "$SDK_STAGE/runtime" . | ssh "$HOST" 'set -eu
  node_binary=""
  for candidate in /usr/local/bin/node /usr/bin/node; do
    if [ -x "$candidate" ] && "$candidate" -e "process.exit(parseInt(process.versions.node, 10) >= 20 ? 0 : 1)"; then
      node_binary=$candidate; break
    fi
  done
  [ -n "$node_binary" ] || { echo "KMLab requires a system Node.js runtime version 20 or newer" >&2; exit 1; }
  stage=$(mktemp -d /tmp/kmlab-explanation.XXXXXX)
  trap '\''rm -rf "$stage"'\'' EXIT
  trap '\''exit 1'\'' HUP INT TERM
  tar -xz -C "$stage"
  sudo install -d -o jkh -g jkh /opt/kmlab
  rm -rf /opt/kmlab/explanation
  cp -R "$stage" /opt/kmlab/explanation
  ln -sfn "$node_binary" /opt/kmlab/node'
git archive HEAD "$APP/app" "$APP/deploy" "$AIRPORTS" "$SDK" "$DYNAMICS" | ssh "$HOST" 'set -eu
  rm -rf /tmp/kmlab-stage && mkdir /tmp/kmlab-stage && tar -x --strip-components=3 -C /tmp/kmlab-stage
  app_stage=/tmp/kmlab-stage/apps/flight-track-analyzer
  package_stage=/tmp/kmlab-stage/packages
  id kmlab >/dev/null 2>&1 || sudo useradd --system --home /var/lib/kmlab --shell /usr/sbin/nologin kmlab
  sudo install -d -o kmlab -g kmlab /var/lib/kmlab
  sudo install -d -o jkh -g jkh /opt/kmlab
  rm -rf /opt/kmlab/app && cp -r "$app_stage/app" /opt/kmlab/app
  rm -rf /opt/kmlab/sdk-python && cp -r "$package_stage/shared-sdk/python" /opt/kmlab/sdk-python
  rm -rf /opt/kmlab/flight-dynamics && cp -r "$package_stage/flight-dynamics" /opt/kmlab/flight-dynamics
  install -m 755 "$app_stage/deploy/e2e_instance.py" /opt/kmlab/e2e_instance.py
  install -d /opt/kmlab/data
  install -m 644 "$package_stage/shared-sdk/data/airports_cache.json" /opt/kmlab/data/airports_cache.json
  [ -x /opt/kmlab/venv/bin/python ] || python3 -m venv /opt/kmlab/venv
  /opt/kmlab/venv/bin/pip install -q -r /opt/kmlab/app/requirements.txt
  /opt/kmlab/venv/bin/pip install -q -e /opt/kmlab/sdk-python -e /opt/kmlab/flight-dynamics
  sudo install -m 644 "$app_stage/deploy/kmlab.service" /etc/systemd/system/kmlab.service
  sudo systemctl daemon-reload && sudo systemctl enable kmlab >/dev/null 2>&1 && sudo systemctl restart kmlab
  if ! sudo grep -q "^kmlab.jordanhubbard.net" /etc/caddy/Caddyfile; then
    sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.kmlab
    { echo; cat "$app_stage/deploy/Caddyfile.snippet"; } | sudo tee -a /etc/caddy/Caddyfile >/dev/null
    sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null && sudo systemctl reload caddy
  fi
  rm -rf /tmp/kmlab-stage'
ssh "$HOST" 'set -eu
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -m 5 http://127.0.0.1:18765/api/health >/dev/null; then exit 0; fi
    sleep 2
  done
  echo "KMLab did not become healthy" >&2
  exit 1'
ssh "$HOST" "printf '%s\\n' '$REVISION' > /opt/kmlab/revision.new && mv /opt/kmlab/revision.new /opt/kmlab/revision"
