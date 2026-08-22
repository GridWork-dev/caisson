#!/usr/bin/env sh
set -eu

# Railway's private mesh is IPv6-only; Cloud Run requires the ordinary IPv4 all-interface bind.
if [ -n "${RAILWAY_ENVIRONMENT_ID:-}" ] && [ -z "${K_SERVICE:-}" ]; then
  HOSTNAME='::'
else
  HOSTNAME='0.0.0.0'
fi
export HOSTNAME

exec bun apps/demos/server.js
