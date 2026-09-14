#!/usr/bin/env bash
# S8: reclaim unused SDKs on the disposable Linux CI VM before building images.
# Local builds remain a no-op. Never remove the tool cache or Docker data here.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_OS:-}" != "Linux" ]]; then
  exit 0
fi
: "${RUNNER_TEMP:?GitHub runner temp is required}" "${GITHUB_ENV:?GitHub environment file is required}"
df -B1 / "$RUNNER_TEMP"
sudo rm -rf -- /usr/local/lib/android /usr/local/.ghcup /usr/local/swift /usr/share/dotnet
df -B1 / "$RUNNER_TEMP"
# The shared publisher scans a resolved registry digest. Read it remotely instead
# of asking Docker to materialize another full-image export on this same disk.
printf '%s\n' 'TRIVY_IMAGE_SRC=remote' >> "$GITHUB_ENV"
