#!/usr/bin/env bash
# Install one already-loaded OCI image under systemd and Caddy on do-host1.
set -euo pipefail

name=${1:?app name required}
port=${2:?loopback port required}
health=${3:?health path required}
stage=${4:?stage path required}
unit="aviation-${name}.service"
unit_path="/etc/systemd/system/${unit}"
site_path="/etc/caddy/aviation-sites/${name}.caddy"
import_line='import /etc/caddy/aviation-sites/*.caddy'

[[ "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]
[[ "$port" =~ ^[0-9]+$ ]]
[[ "$health" == /* && "$health" != *$'\n'* ]]
[[ "$stage" == /tmp/aviation-"$name"-* ]]

sudo install -d -m 755 /etc/caddy/aviation-sites /etc/aviation
sudo install -d -m 750 "/var/lib/aviation/$name"
while IFS= read -r volume; do
  [[ -z "$volume" ]] && continue
  [[ "$volume" =~ ^[a-z0-9-]+$ ]]
  sudo install -d -m 750 "/var/lib/aviation/$name/$volume"
done < "$stage/volumes.txt"
if ! sudo test -e "/etc/aviation/$name.env"; then
  sudo install -m 600 /dev/null "/etc/aviation/$name.env"
fi
ensure_secret() {
  local key=$1
  if ! sudo grep -Eq "^${key}=[^[:space:]]+" "/etc/aviation/$name.env"; then
    if sudo grep -q "^${key}=" "/etc/aviation/$name.env"; then
      echo "${name} has an empty ${key}; configure it before deployment" >&2
      return 1
    fi
    printf '%s=%s\n' "$key" "$(openssl rand -hex 32)" | sudo tee -a "/etc/aviation/$name.env" >/dev/null
  fi
}
case "$name" in
  flightschool)
    ensure_secret SECRET_KEY
    ensure_secret WTF_CSRF_SECRET_KEY
    ;;
  foreflight-dashboard)
    ensure_secret SECRET_KEY
    ;;
esac

sudo cp -p /etc/caddy/Caddyfile "$stage/Caddyfile.old"
had_unit=false
had_site=false
if sudo test -e "$unit_path"; then sudo cp -p "$unit_path" "$stage/unit.old"; had_unit=true; fi
if sudo test -e "$site_path"; then sudo cp -p "$site_path" "$stage/site.old"; had_site=true; fi

rollback() {
  echo "Rolling back configuration for $name" >&2
  sudo systemctl stop "$unit" >/dev/null 2>&1 || true
  sudo cp -p "$stage/Caddyfile.old" /etc/caddy/Caddyfile
  if "$had_unit"; then sudo cp -p "$stage/unit.old" "$unit_path"; else sudo rm -f "$unit_path"; fi
  if "$had_site"; then sudo cp -p "$stage/site.old" "$site_path"; else sudo rm -f "$site_path"; fi
  sudo systemctl daemon-reload
  if "$had_unit"; then sudo systemctl restart "$unit" || true; else sudo systemctl disable "$unit" >/dev/null 2>&1 || true; fi
  sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null && sudo systemctl reload caddy || true
}
trap rollback ERR

sudo install -m 644 "$stage/service.unit" "$unit_path"
sudo install -m 644 "$stage/site.caddy" "$site_path"
if ! sudo grep -Fxq "$import_line" /etc/caddy/Caddyfile; then
  printf '\n%s\n' "$import_line" | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi
sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable "$unit" >/dev/null
sudo systemctl restart "$unit"

ready=false
for _ in $(seq 1 20); do
  if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${port}${health}" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 3
done
if ! "$ready"; then
  echo "${name} did not become healthy on port ${port}" >&2
  false
fi
sudo systemctl reload caddy
trap - ERR
rm -rf "$stage"
echo "${name} active and healthy on 127.0.0.1:${port}"
