# ADR-0001 — Monorepo tooling: Bun workspaces + Turborepo + changesets

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

The library is a **single monorepo** (Phase-3 lock). Package/runtime manager is **Bun**
(gridwork-core standard — never npm/yarn). Task orchestration + caching is **Turborepo**.
Per-package versioning + publishing is **changesets** — because each base package and edition
is **independently sellable** (à-la-carte commerce, ADR-0003), each must version + publish on
its own cadence with a changelog buyers can read.

Rejected: a single-version monorepo (Nx/Lerna fixed-version) — forecloses per-module pricing
and forces lockstep releases. A polyrepo — rejected at Gate 3 (kills shared standards + atomic
cross-edition changes). pnpm/npm — off-standard for this stack.

Binding: one `tooling/` package holds the shared eslint/tsconfig/test config; every package
extends it (ADR-0002). `support-bot` is the one Python service and lives outside the JS
workspace graph (ADR-0009).
