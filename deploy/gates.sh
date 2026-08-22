#!/usr/bin/env bash
set -euo pipefail

bun run lint
bun run typecheck
bun run test
