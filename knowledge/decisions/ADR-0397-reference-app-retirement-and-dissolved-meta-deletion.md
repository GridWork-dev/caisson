# ADR-0397 — Reference-app retirement and dissolved-meta package deletion

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the 2026-08-09 ponytail-audit remediation picker)
- **Parent:** ADR-0257/0258 (editions dissolved into six bundles) · ADR-0270 (edition
  package/code traces purged; entitlement aliases dropped — "zero real buyers hold them") ·
  ADR-0328 (wave convention)
- **Supersedes:** nothing; completes ADR-0270's purge for the two meta packages it left in-tree

## Context

A repo-wide adversarially-verified audit (2026-08-09, 12 lanes + 4 refuters, 0 findings refuted
outright) found five reference apps — `apps/base`, `apps/ai-kit`, `apps/agent-dev`,
`apps/local-ai`, `apps/compliance` — that build/lint/typecheck/test on every CI push yet deploy
nowhere: zero references in `deploy-railway.yml`, `turbo.json`, `infra/`, or any script; no
Dockerfile or railway.toml in any of them; `apps/local-ai` and `apps/compliance` both bind
`-p 3040` and nobody ever noticed. The buyer-facing demo surface for the same packages is
`apps/site/components/poke/` (deployed), and buyer repos are generated from
`packages/cli/templates/*` — a separate tree the generator reads; it never reads `apps/*`.

`packages/agent-dev` and `packages/local-ai` are the dissolved edition metas: delisted from the
registry 2026-07-07, absent from every live bundle manifest (`local-first` and `agentic-dev`
list member packages directly), and dropped from `LEGACY_ENTITLEMENT_ALIASES` by ADR-0270. Their
only importers are the reference apps above. `packages/ai-kit` — the third dissolved meta — is
NOT in this set: `apps/site/lib/byok.ts` and `lib/site-migrations.ts` import it for real.

One coupling is live: `apps/base` hosts four integration tests, including
`generate.integration.test.ts`, which proves the buyer-MCP generate path end-to-end
(debit-before-spend ADR-0007, idempotent dedup ADR-0024, audit row) over PGlite.

## Decision

1. **Delete the five reference apps and both meta packages** —
   `apps/{base,ai-kit,agent-dev,local-ai,compliance}` + `packages/{agent-dev,local-ai}`
   (~7,400 LOC, seven workspaces out of every CI run).
2. **Relocate before deleting:** `apps/base`'s integration tests move into the packages whose
   seams they prove (the MCP-generate money test to `packages/mcp-server`/`packages/cli`; the
   app/rate-limit/server-validation tests likewise follow their subjects). Zero coverage is
   lost — the tests move, they do not die.
3. **The registry ledger stays append-only.** `ledger.jsonl`/`tarballs.json` history rows for
   the dissolved metas are untouched; this is source deletion only, completing a delist that
   already happened (ADR-0270 / CAISSON-86).
4. `tooling/standards-gate/src/checks.ts` drops `apps/base` from the prose-scan target list,
   and any gate enumeration touching the deleted workspaces updates in the same change.

## Consequences

- CI stops paying build+lint+typecheck+test for seven workspaces on every push.
- The composition-root prose reference in `packages/cli/src/meter.ts` re-points at the
  generator templates (the tree buyers actually receive).
- Recoverable from git history if a standalone reference app is ever wanted again.

## Rejected

- Keeping `apps/base` as a test host — it is a full Next app paying app-scale CI cost for what
  is four test files; the tests belong with the seams they prove.
- Deleting `packages/ai-kit` alongside its dissolved siblings — it has live site importers.
