# KICKOFF — P6 Code track (commerce completion + publish-readiness + hygiene)

> Run this as the **first message** of a fresh Claude session in the worktree
> `~/lab/caisson-code` (branch `feature/p6-commerce`, off `main`). This session is **workflow-driven**
> — you are explicitly authorized to use the **Workflow** tool (multi-agent orchestration) for every
> phase below. Disjoint tree from the operator track: this session owns `services/*` +
> `packages/{migrate,cli,billing,credits,pricebook,registry-schema,kernel,mcp-server,…}` + `tooling/` +
> `registry/`. **Do NOT touch `apps/site` / `apps/studio` / `packages/ui`** (design tree) — the W4
> Enterprise-tier SKU + the `apps/site` Apache-2 licensing copy are deferred to a design-track session.

---

## Mission

Land the remaining **P6 commerce spine + publish-readiness + code hygiene** as a sequence of
**atomic, individually-verified, green PRs** — each through a fixed 6-phase pipeline. Every item is
ADR-locked at the strategy level; the only NEW forks are the **implementation-design** forks surfaced
in Phase 2 (resolve them in one operator picker before any execution).

## Read first (the doc surface is freshly reconciled — 2026-06-29, post-PR#24)

- `docs/build-state.md` — what's built vs partial vs pending (the SOT)
- `docs/state/readiness-and-backlog.md` — §3 backlog + §1 live-test matrix + §2 secrets + Greptile table (§3)
- `docs/state/decisions-and-forks.md` — locked ADRs (0089–0105) + the parked/deferred board
- `knowledge/decisions/` — `ADR-0010` (offline license) · `ADR-0089`/`0098` (billing/credit-denom) ·
  `ADR-0071`/`0076` (entitlement) · `ADR-0047` (worker filter) · `ADR-0069`/`0092` (publish/npx bin) · `ADR-0009` (support shape)
- `outputs/kickoffs/code-wiring-track.md` — the prior code-track kickoff (Buckets A+B+C are now DONE; this picks up the B-remainder + D)

## The work-list (6 items — operator-selected scope, 2026-06-29)

| #      | Item                                                                                                                                                                                                                                                                                | Owns                                                  | ADR            | Tags                                   | Depends on                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------- | -------------------------------------- | ------------------------------------------------- |
| **I1** | **License issuer** — Ed25519 offline-license **issuer** (signing keypair + canonical claim set + HTTP issue endpoint). Only the _verify_ side exists today (`@caisson/license-verify`).                                                                                             | `services/license` (+ a `license-issue` primitive)    | 0010           | `security` `secrets` `external-system` | — (anchor)                                        |
| **I2** | **Revoke-on-cancel + one-time-purchase entitlement** — `customer.subscription.deleted`/refund → revoke; Stripe line-item enrichment → sub→entitlement provenance; one-time (non-cycle) purchase grants a permanent entitlement.                                                     | `services/license` + `@caisson/pricebook`             | 0089 0071      | `billing` `security` `external-system` | I1 (issuer claim set)                             |
| **I3** | **Buyer dashboard + seller cockpit** — buyer: entitlements · credit balance · license key · `.npmrc` token; seller: sales/grants/registry state.                                                                                                                                    | a new `apps/dashboard` (own tree; NOT `apps/site`)    | 0009           | `auth` `frontend`                      | I1+I2 + **operator pricing lock (cross-session)** |
| **I4** | **Publish-readiness** — 24-pkg private→public flip + correct per-pkg SPDX (Apache-2 base / commercial editions) + `@caisson/registry` coherence + changeset/T3 gate; `create-caisson` → `dist/cli.js` + `#!/usr/bin/env node` npx bin; registry index backfill (7→24 modules live). | `tooling/` `registry/` `packages/cli` + all manifests | 0069 0092 0094 | `security` `infra` `external-system`   | —                                                 |
| **I5** | **MCP per-account rate-limit (T21b)** — PG token-bucket alongside the entitlement store; `debit-before-spend` stays the primary control.                                                                                                                                            | `packages/mcp-server` (+ entitlement store)           | board(P6)      | `security`                             | I2 entitlement store                              |
| **I6** | **Greptile test-hygiene fixes** — the 2 real bugs (`packages/cli/src/meter.integration.test.ts:389-398` real-bundle `rmSync` hazard → temp-dir isolation) + defensive entitlement-schema in `services/license/src/webhook.integration.test.ts:14-17` + the 3 nits.                  | `packages/cli` `services/license` `.githooks`         | readiness §3   | (none — cheap)                         | —                                                 |

> **Cross-session gate:** I3 (dashboards) renders prices. The **final pricing numbers + grandfathering**
> are being locked in the parallel **operator session** (`~/lab/caisson-ops`, ADR-0106). Build I3 against
> the **`@caisson/pricebook` config** (already integer-unit + append-only); wire the real numbers once the
> operator ADR lands. Do NOT block I3 on it — pricebook indirection is the seam.

## The pipeline — 6 phases (run each as a Workflow)

Drive the work-list through these phases **in order**. Phases 1, 3, 4, 6 fan out one lane per item
(parallel); Phase 2 is a single operator gate; Phase 5 loops.

### Phase 1 — RESEARCH / investigate (parallel workflow, one lane per item)

For each of I1–I6: a read-only research lane (Explore/`gw-phase-researcher`) maps the current code,
the exact seam to extend, the prior-art in-repo (e.g. `@caisson/license-verify` for I1, `pricebook`
plan-book for I2), the test surface, and **enumerates every implementation-design fork** (≥2 options +
a confidence-tagged recommendation + file:line evidence). Output per lane: a structured
`{item, currentState, seam, forks[], recommendation}`. **No code yet.**

### Phase 2 — FORK PICKER (single operator gate — DO NOT auto-decide)

Consolidate **all** forks surfaced in Phase 1 into **one** `AskUserQuestion` round (group by item;
recommendation first, confidence + evidence on each). The operator locks them. Record each lock as an
**append-only ADR starting at ADR-0108** (operator session reserves 0106–0107). This honors the repo's
one-operator rule: _never auto-decide a fork._ Update `docs/state/decisions-and-forks.md` Locked table.

### Phase 3 — EXECUTE (parallel workflow, **worktree-isolated** writers)

One execution lane per item, each in its own `isolation: "worktree"` (parallel writers MUST isolate —
doctrine). Implement against the Phase-2 locks. Enforce the engineering invariants every line:
TS-strict · Zod `.strict()` boundaries · integer credits · `fetchWithTimeout` on every outbound fetch ·
`crypto.timingSafeEqual` for every secret/token/**license** compare · no `any`/`console.log` ·
fail-closed. (I6 needs no worktree — it's a bounded test-hygiene patch; can run inline.)

### Phase 4 — GATE: verify → sweep → ship (local, per item)

Per item, locally (no PR yet): **(a) goal-backward VERIFY** — re-ask the item's Phase-0 goal against
the diff + tests (pass/partial/fail). **(b) SWEEP** — downstream impact + stale-doc check (update
`docs/build-state.md` + readiness as the item lands). **(c) local SHIP review** — `gw-code-reviewer`
(opus) + the **conditional audits per the item's tags** (`gw-security-auditor` for security/secrets/
auth/external-system; billing/infra checks) in parallel, plus `bun run check` (`turbo build·lint·test` +
standards-gate; `--concurrency=50%` per the PGlite fan-out gotcha) GREEN.

### Phase 5 — REMEDIATION (loop)

Any VERIFY=fail / audit-blocker / red `bun run check` → fix in-lane and re-run Phase 4 for that item.
VERIFY=partial → enumerate gaps + either close or queue a tracked follow-up. Loop until the item is
VERIFY=pass + all audits clear + gate green. **Do not advance a red item to PR.**

### Phase 6 — PR till green + Greptile clean (per item)

Open one **atomic PR per item** off `main` (conventional-commit scope from CLAUDE.md: `license` `billing`
`credits` `mcp` `cli` `tooling` `registry`…). Drive CI green on the **self-hosted fleet** (the required
checks `check`/`standards-gate`/`registry-index`). The **Greptile GitHub app auto-reviews** each opened
PR — **address every P2+ finding** (fix or justify-in-thread), and run the local `/greptile` pass
**before** opening any PR >100 files (Greptile silently skips >100-file PRs — readiness §3 process
follow-up). Item is DONE only at: CI green + Greptile review clean + operator merge-approve.

## Sequencing (dependency-aware)

`I6` + `I4` can sprint immediately (no fork, no dep). `I1 → I2 → I5` chain on the license/entitlement
seam. `I3` runs last (needs I1+I2 + the operator pricing ADR; build against pricebook config meanwhile).
Recommended fan: **Phase 1 over all 6 at once** → one picker → **Phase 3 fan {I6,I4} now, {I1,I2,I5}
on the chain, I3 trailing.**

## Locked — no strategy forks here

Strategy is ADR-locked (0089–0105 + founding). The ONLY new decisions are the Phase-2 implementation
forks. The pricing **numbers** + CF Access go-live + creds/deploys are the **operator session's** job
(`~/lab/caisson-ops`) — do not relitigate or block on them; pricebook config is the seam.

## Exit criteria

**Per item:** atomic PR · green `bun run check` + the tagged audits · goal-backward VERIFY=pass · Greptile
clean · merged. **Track:** a real purchase issues a signed Ed25519 license (I1) + grants/revokes
entitlements with sub & one-time provenance (I2); the buyer/seller dashboards render live state (I3); all
24 pkgs are publish-ready with correct SPDX + the registry index is fully backfilled + `npx create-caisson`
works (I4); the MCP enforces a per-account rate-limit (I5); the Greptile P2 backlog is zero (I6).
