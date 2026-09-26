# CLAUDE.md / AGENTS.md — working in the Caisson repo

Guide for coding agents and contributors. `AGENTS.md` is a symlink to this file. The human
contribution workflow is in [CONTRIBUTING.md](CONTRIBUTING.md).

**What this repo is:** a Bun + Turborepo monorepo of Apache-2.0 TypeScript packages published as
`@caisson-sh/*`, plus the `create-caisson` generator (`packages/cli`), the static site
(`apps/site`) and the interactive demos (`apps/demos`).

## Commands

```sh
bun install
bun run check                                  # build, lint, typecheck, test, standards gate
bun run --filter @caisson-sh/<package> test    # one package
bun run format                                 # oxfmt; CI runs format:check
bunx changeset                                 # record a change to a published package
```

CI (`.github/workflows/ci.yml`) runs the same checks plus the OSCAL conformance job, the site
end-to-end suite and a pack of every published package. Its final `ci` job is the required check.

## Engineering invariants

Apply to all package code; the standards gate and review enforce them.

- TypeScript strict. No `any`, no `console.log` in package code. Bun only, never npm or yarn.
- Validate every external boundary with Zod `.strict()` schemas.
- Every outbound `fetch` goes through `fetchWithTimeout` (`@caisson-sh/kernel`).
- Compare secrets, tokens and signatures with `crypto.timingSafeEqual`; hash variable-length
  values with SHA-256 first. IDs come from `crypto.randomUUID()`.
- Money and credits are integer units, never floats.
- Row-level security fails closed: no tenant context means no rows.
- Dependencies point down: a package never depends on an app or on a package above it.

## Rules that are easy to miss

- **Changesets.** Any change under `packages/` needs a changeset (`bunx changeset`); CI fails
  without one. Changeset text is user-facing: describe the change, not the process.
- **Released SQL migrations are immutable.** The migration ledger checksums them, so even a
  comment edit breaks every database that already applied them. Add a new migration instead.
- **Generated files are rebuilt, not edited.** `packages/ui/styles/tokens.css` comes from the TS
  tokens (`bun run packages/ui/scripts/gen-tokens-css.ts`); the component manifest from
  `bun run --filter @caisson-sh/ui gen:manifest`. CI fails on drift.
- **Golden files** are compared byte for byte. Re-record one deliberately with `BLESS=1` on the
  owning test, and review the diff.
- **ADRs** in `knowledge/decisions/` are append-only: never edit a decided record, supersede it
  with a new `ADR-NNNN-slug.md`.
- **Commits** use Conventional Commits with the package as scope, e.g. `fix(auth): ...`.

## Layout

```
packages/            published packages (+ brand, private)
apps/site            caisson.sh (Next static export, Fumadocs docs)
apps/demos           demos served at caisson.sh/demos
tooling/             standards-gate, lint-policy, tsconfig, testing, demo-registry, audit-harness
tooling/scripts/     release and CI helper scripts
tools/security/      the security scan driver (semgrep, trivy, osv-scanner, trufflehog)
specs/               founding concept specs
knowledge/decisions/ ADRs
docs/                contributor design notes
```
