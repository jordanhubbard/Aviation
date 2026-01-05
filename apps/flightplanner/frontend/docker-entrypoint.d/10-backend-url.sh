#!/usr/bin/env sh
set -eu

# nginx template uses BACKEND_URL. Preserve backwards-compat with BACKEND_HOST/BACKEND_PORT.
if [ -z "${BACKEND_URL:-}" ]; then
  host="${BACKEND_HOST:-backend}"
  port="${BACKEND_PORT:-8000}"
  export BACKEND_URL="http://${host}:${port}"
fi
