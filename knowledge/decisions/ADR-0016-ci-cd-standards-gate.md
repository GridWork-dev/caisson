# ADR-0016 — CI/CD pipeline + the standards gate

Status: proposed · 2026-06-27 (foundations track; resolves the open CI fork)

CI is **GitHub Actions** (the repo already carries `.github/workflows/ci.yml`). One required
workflow on every PR + push to `main`, Bun-based (`oven-sh/setup-bun`, frozen lockfile).

**Required jobs (a PR merges only when all are green):**

1. **build** — `turbo run build` (typecheck + emit; `tsc` strict, no `any`).
2. **lint** — `turbo run lint` (`@stack/eslint-config`: no-any, no-console, the boundary rules).
3. **test (unit)** — `turbo run test`, in-process, no DB.
4. **test (integration)** — the `*.integration.test.ts` set against **PGlite** (ADR-0013) —
   no external service, so it runs hermetically on a stock runner; this is where the
   **fail-closed-RLS proof** (ADR-0005) and the **atomic+idempotent credit debit** (ADR-0007)
   live. A Neon branch DB is the opt-in escape hatch via `TEST_DATABASE_URL`, not the default.
5. **standards-gate** — `bun run gate` (`@stack/kernel`'s gate, below).
6. **golden-file** — runs the suite with `BLESS` unset; **fails on any golden drift** (ADR-0013).

**The standards gate (`bun run gate`).** A workspace scanner (`@stack/kernel`) that asserts the
ADR-0002 "one standard" invariant for every package: it extends `@stack/tsconfig` +
`@stack/eslint-config` + `@stack/testing`, declares the required `build`/`lint`/`test` scripts,
has no banned dep, and (the **ADR-0004 enforcement**) **no `registry/` module entry exists
without a passing golden fixture + a gate stamp** — i.e. the registry-publish path _is_ this
gate, the one ingress. For P0 the registry is empty, so the gate asserts the mechanism + every
package's conformance; from P5 it blocks any registry write that bypasses it. The gate is a
hard CI job (non-zero exit fails the build) and the local pre-commit hook runs a fast slice of it.

Rejected: per-job ad-hoc shell with no shared gate (drifts; the whole library sells "one enforced
standard"). Letting registry writes land outside the gate (breaks ADR-0004's single-ingress
invariant). A Docker-Postgres CI matrix as the default (slower, flakier than PGlite for the
hermetic correctness proofs — kept opt-in only).

Binding: all six jobs are required; the standards gate is the sole registry-publish ingress;
golden drift fails CI; CI is Bun + Turbo, frozen lockfile.
