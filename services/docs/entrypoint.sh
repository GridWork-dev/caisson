#!/bin/sh
# Railway attaches persistent volumes ROOT-owned, but the app runs as the non-root `bun` user
# (uid 1000) — without this, every embed-cache write under the mount fails EACCES and the cache
# never persists. Runs as root exactly long enough to hand the mount to `bun`, then drops
# privileges for the real process. No volume attached (CI / local) -> straight pass-through.
set -e
if [ -n "${RAILWAY_VOLUME_MOUNT_PATH:-}" ] && [ -d "${RAILWAY_VOLUME_MOUNT_PATH}" ]; then
  chown -R bun:bun "${RAILWAY_VOLUME_MOUNT_PATH}" || true
fi
exec setpriv --reuid=bun --regid=bun --init-groups "$@"
