#!/bin/sh
# Deploy the committed analyzer from the Aviation tree. Usage: deploy/deploy.sh do-host1
# Idempotent: creates the service user, venv, systemd unit; adds the Caddy vhost only if missing.
set -eu
HOST=${1:?usage: deploy.sh HOST}
REPO=$(git rev-parse --show-toplevel)
APP=components/legacy-project-wrapper/implementation/apps/flight-track-analyzer
cd "$REPO"
[ -z "$(git status --porcelain --untracked-files=all -- "$APP/app" "$APP/deploy")" ] || {
  echo "uncommitted changes in flight-track-analyzer app/ or deploy/: commit first" >&2; exit 1;
}
git archive HEAD "$APP/app" "$APP/deploy" | ssh "$HOST" 'set -eu
  rm -rf /tmp/kmlab-stage && mkdir /tmp/kmlab-stage && tar -x --strip-components=5 -C /tmp/kmlab-stage
  id kmlab >/dev/null 2>&1 || sudo useradd --system --home /var/lib/kmlab --shell /usr/sbin/nologin kmlab
  sudo install -d -o kmlab -g kmlab /var/lib/kmlab
  sudo install -d -o jkh -g jkh /opt/kmlab
  rm -rf /opt/kmlab/app && cp -r /tmp/kmlab-stage/app /opt/kmlab/app
  [ -x /opt/kmlab/venv/bin/python ] || python3 -m venv /opt/kmlab/venv
  /opt/kmlab/venv/bin/pip install -q -r /opt/kmlab/app/requirements.txt
  sudo install -m 644 /tmp/kmlab-stage/deploy/kmlab.service /etc/systemd/system/kmlab.service
  sudo systemctl daemon-reload && sudo systemctl enable kmlab >/dev/null 2>&1 && sudo systemctl restart kmlab
  if ! sudo grep -q "^kmlab.jordanhubbard.net" /etc/caddy/Caddyfile; then
    sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.kmlab
    { echo; cat /tmp/kmlab-stage/deploy/Caddyfile.snippet; } | sudo tee -a /etc/caddy/Caddyfile >/dev/null
    sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null && sudo systemctl reload caddy
  fi
  rm -rf /tmp/kmlab-stage'
