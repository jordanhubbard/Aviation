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
cd "$REPO"
[ -z "$(git status --porcelain --untracked-files=all -- "$APP/app" "$APP/deploy" "$AIRPORTS" "$SDK")" ] || {
  echo "uncommitted changes in flight-track-analyzer or airport data: commit first" >&2; exit 1;
}
git archive HEAD "$APP/app" "$APP/deploy" "$AIRPORTS" "$SDK" | ssh "$HOST" 'set -eu
  rm -rf /tmp/kmlab-stage && mkdir /tmp/kmlab-stage && tar -x --strip-components=5 -C /tmp/kmlab-stage
  id kmlab >/dev/null 2>&1 || sudo useradd --system --home /var/lib/kmlab --shell /usr/sbin/nologin kmlab
  sudo install -d -o kmlab -g kmlab /var/lib/kmlab
  sudo install -d -o jkh -g jkh /opt/kmlab
  rm -rf /opt/kmlab/app && cp -r /tmp/kmlab-stage/app /opt/kmlab/app
  rm -rf /opt/kmlab/sdk-python && cp -r /tmp/kmlab-stage/python /opt/kmlab/sdk-python
  install -m 755 /tmp/kmlab-stage/deploy/e2e_instance.py /opt/kmlab/e2e_instance.py
  install -d /opt/kmlab/data
  install -m 644 /tmp/kmlab-stage/data/airports_cache.json /opt/kmlab/data/airports_cache.json
  [ -x /opt/kmlab/venv/bin/python ] || python3 -m venv /opt/kmlab/venv
  /opt/kmlab/venv/bin/pip install -q -r /opt/kmlab/app/requirements.txt
  /opt/kmlab/venv/bin/pip install -q -e /opt/kmlab/sdk-python
  sudo install -m 644 /tmp/kmlab-stage/deploy/kmlab.service /etc/systemd/system/kmlab.service
  sudo systemctl daemon-reload && sudo systemctl enable kmlab >/dev/null 2>&1 && sudo systemctl restart kmlab
  if ! sudo grep -q "^kmlab.jordanhubbard.net" /etc/caddy/Caddyfile; then
    sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.kmlab
    { echo; cat /tmp/kmlab-stage/deploy/Caddyfile.snippet; } | sudo tee -a /etc/caddy/Caddyfile >/dev/null
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
