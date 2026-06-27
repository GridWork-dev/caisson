# ADR-0013 — Testing strategy + golden-file harness

Status: proposed · 2026-06-27 (foundations track; resolves the open P0 testing fork)

The test runner is **Bun's built-in `bun test`** (Bun-first doctrine — no Vitest layer to
own). Turbo orchestrates it: each package ships a `test` script (`bun test`); CI runs
`turbo run test`. The shared harness is `@stack/testing` (tooling layer), extended by every
package alongside `@stack/tsconfig` + `@stack/eslint-config` (ADR-0002).

**Unit ↔ integration boundary.** _Unit_ tests are in-process, pure, no I/O — the default,
file `*.test.ts`. _Integration_ tests touch a database and are named `*.integration.test.ts`;
they run against **PGlite** (embedded Postgres-in-WASM, real RLS + `SET LOCAL` + `SET ROLE`
semantics) so they are deterministic and need no Docker locally, in CI, or on a buyer's
machine. The same Drizzle migrations apply to PGlite (tests), Neon (prod), and node-postgres
(local) — ADR-0014. A non-superuser `app` role is `SET ROLE`'d inside the test session so
FORCE-RLS policies actually apply (a superuser would BYPASSRLS and mask a fail-closed bug).

**Golden file.** A serialized expected output (JSON / text / signed-pack manifest) stored at
`__golden__/<name>.<ext>` next to the test. `matchGolden(name, actual)` (from `@stack/testing`)
diffs actual vs the committed fixture and fails on drift; **`BLESS=1 bun test` rewrites** the
fixtures (the only sanctioned update path — a blessed change shows up as a reviewable diff).
CI runs with `BLESS` unset, so an unblessed change to a golden output fails the build. This is
the **P0 exit-gate harness** and the **P2 compliance guard** ("golden-file regression before
any evidence-pack logic", ADR-0006) — the same mechanism, wired from P0 so it exists before
compliance code does.

Rejected: Vitest/Jest (extra runtime + config to own; `bun test` is the Bun-native standard).
Testcontainers as the default DB harness (needs a Docker daemon — fails on CI runners + buyer
machines without one; kept as an opt-in escape hatch via `TEST_DATABASE_URL`). Snapshot
libraries with implicit auto-update (silent fixture drift; `BLESS=1` makes updates explicit).

Binding: every package extends `@stack/testing`; DB-touching tests use PGlite + `SET ROLE app`;
golden fixtures update only via `BLESS=1` and land as a reviewed diff; CI fails on golden drift.
