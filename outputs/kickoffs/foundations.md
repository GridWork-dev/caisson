# KICKOFF — Track 1: Foundations + Base (P0/P1)

Paste this as the first message of a fresh Claude session in the `track/foundations` worktree.

---

You are starting the **Foundations + Base** build track for the `stack` monorepo (working name).
**Read first (in this repo):** `CLAUDE.md`, `specs/00-product-spec.md`, `specs/01-architecture.md`,
`plan.md` (phases P0–P1), `knowledge/decisions/ADR-0001..0012`, `docs/state/decisions-and-forks.md`.
Context/provenance: `outputs/research/` (decisions-log, market-research, capability-corpus).

**Locked (do not relitigate):** monorepo Option C · Bun+Turborepo+changesets · composable
packages, editions=compositions · fail-closed RLS · integer credits / append-only ledger · the
gridwork-core security floor. **Rebuild-clean** from the seed repos — never port. Pro-private
`media-pipeline` = patterns only.

## Goal
Resolve the open foundational ADRs, then build **P0 (foundations)** + **P1 (base substrate)** per
`plan.md`, leaving every package green through the `tooling/` standards gate. **No edition feature
code** — base packages only.

## Step 0 — close the open ADRs FIRST (the docs-review found these missing; they block P0/P1)
Author these as `knowledge/decisions/ADR-NNNN-*.md` (append-only, Wardfile format), resolving each
fork on the decisions board (never auto-decide — recommend + confirm where it's a real product fork):
- **ADR-0013 Testing strategy + golden-file harness** — test runner (recommend Bun's built-in or Vitest), what a golden file is (format/location/update/BLESS procedure), unit↔integration boundary. (This IS the P0 exit gate and the P2 compliance guard.)
- **ADR-0014 Database + ORM** — make Drizzle explicit (already implied), PG provider for reference/seller platform (recommend Neon), migration strategy (numbered, idempotent, schema_version ledger ← health-service/Wardfile pattern).
- **ADR-0015 Auth** — library + session/JWT shape + how `account_id`/`workspace_id` resolves and injects into `SET LOCAL` for RLS (the auth→RLS seam) + webhook/MCP Bearer.
- **ADR-0016 CI/CD** — GitHub Actions; required jobs (build/lint/test/standards-gate/golden-file); how the standards gate enforces ADR-0004's "registry write only through the gate" invariant.
- **ADR-0017 Billing / Merchant-of-Record** — **name the MoR** (Paddle vs Lemon Squeezy vs Stripe — recommend one; incompatible webhook schemas make this gate P1+P6); HMAC webhook verification; P1-vs-P6 event split.
- **ADR-0018 Jobs + email** — job queue (Postgres-backed vs Inngest/Trigger.dev) + email provider (recommend Resend); the dispatch interface from billing/credit events.
- **Error model** (extend ADR-0002 or new ADR) — typed error hierarchy, the 402 credit-gate response shape, propagation across the package graph.
- **Amend ADR-0007** — specify the credit idempotency partial-unique-index columns per event_type (e.g. `UNIQUE(source_event_id, event_type)`), the implementation-blocking gap the review flagged.

## Step 1 — build P0 → P1 (per plan.md)
P0: `tooling/` (eslint/tsconfig/testing + standards lint-gate) → `kernel` → CI → golden-file skeleton.
P1: `auth` → `tenancy-rls` (FORCE + a test proving a missing filter fails closed) → `billing` →
`credits` (integer wallet, append-only ledger, debit-before-spend, 402, idempotent) → `ai-config`
(provider-agnostic, no provider hardcoded) → `mcp-server` (auth-gated; **read-mostly + the one
generation write surface validates module names vs the registry allowlist**, ADR-0008) → `ui`
(vanilla-extract token floor) → `jobs` + `email`. Framework-agnostic core (apps deferred).

## Flagged for the (separate) Compliance session — do NOT build here, but know:
- **ADR-0006 needs amending before P2:** field-crypto base tier must use **per-tenant key derivation**
  (HKDF(master_env_key, tenant_id)) — a single shared env key is a cross-tenant breach. The review
  rated this HIGH. Note it on the decisions board for the compliance session.

## Rules
Never auto-decide a fork (board it). Spec/ADR before code. Atomic conventional commits
(`feat(credits): …`). Goal-backward verify against each phase's exit gate. Stop at the **P1 exit
gate** (base reference wiring green) and report — do not start editions.
