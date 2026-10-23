#!/usr/bin/env sh
set -eu

ENV_JS="/usr/share/nginx/html/env.js"

owm_key="${VITE_OPENWEATHERMAP_API_KEY:-${OPENWEATHERMAP_API_KEY:-${OPENWEATHER_API_KEY:-}}}"

cat >"${ENV_JS}" <<EOF
window.__ENV__ = {
  VITE_OPENWEATHERMAP_API_KEY: "${owm_key}",
  VITE_REPO_URL: "${VITE_REPO_URL:-${REPO_URL:-}}",
  VITE_GIT_SHA: "${VITE_GIT_SHA:-${GIT_SHA:-}}",
}
EOF
