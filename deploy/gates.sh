#!/usr/bin/env bash
set -euo pipefail

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
