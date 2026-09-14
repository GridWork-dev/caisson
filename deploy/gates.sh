#!/usr/bin/env bash
set -euo pipefail

# Match the required CI job's CPU-relative cap. The default ten-way Turbo fan-out
# exhausted memory on the 8 GiB publisher runner (S8/R324 branch reproduction).
# Export it for the unchanged root scripts below; keep every gate and failure exit.
export TURBO_CONCURRENCY=50%

bun run tooling/standards-gate/src/cli.ts
bun run lint:repo
bun run lint:canary
bun tooling/standards-gate/src/dependency-graph-guard.ts
bun test registry/schema registry/scripts registry/worker
bun registry/scripts/build-index.ts
git diff --exit-code registry/index.json
bun run lint
bun run typecheck
bun run test
