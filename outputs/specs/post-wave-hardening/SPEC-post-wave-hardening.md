# SPEC — post-wave hardening: the ADR-0218–0221 deferred review findings, triaged for execution

**Status: TRIAGE SPEC — no operator forks open.** Every item below was found by the
adversarial review passes over the 2026-07-02 build wave (PRs #66–#69), judged
non-blocking there, filed to Linear (CAISSON-5…CAISSON-19), and grouped here into
execution buckets. Shapes are reviewer-prescribed; nothing needs a fork round except
CAISSON-19, which is explicitly OUT of this spec (it gets its own SPEC + forks).

- **Relates:** ADR-0218 (paddle per-line refund) · ADR-0219 (CF edge) · ADR-0220 (admin
  mutations) · ADR-0221 (live seams) · the per-PR review chains recorded in PRs #66–#69.
- **Tracking:** Linear owns the WORK items (ids below); this spec owns the grouping,
  ordering, and verify commands. Decisions stay in git.

## Goal (WHAT + WHY)

Close the tail the reviewers left: five money-adjacent defensive gaps, four hygiene
drifts, one credential-pass advisory, and the four DEPLOY acts that gate the merged wave
actually going live. None is a live bug today; all are cheapest to fix while the wave's
context is fresh.

## Bucket A — money-path hardening (one execution slice, after PRs #66 + #69 merge)

Same files as the wave branches — do NOT start until both merge, then one bounded slice
(sonnet lane, <300 LOC, fable verdict on the diff since it touches billing/credits).

| Linear           | Item                                                           | Anchor                                                  | Verify                                                                                                                                  |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| CAISSON-5 (High) | Bound whole-txn full-refund claw to granted-minus-line-claws   | `services/license/src/apply-billing-event.ts`           | New test: per-line partial claws then whole-txn `type: full` adjustment → total clawed ≤ granted; spill onto other purchases impossible |
| CAISSON-9 (High) | Account-existence check on admin comp grants + credit adjust   | `services/license/src/admin-mutations.ts`               | Grant to a nonexistent id → 4xx, zero rows committed (no ghost entitlement/credit rows)                                                 |
| CAISSON-8 (Low)  | Set-size uniqueness check on non-empty per-line join ids       | `packages/billing/src/paddle-events.ts` `readLineItems` | Duplicate non-empty itemIds on 2+ lines → ValidationError (fail-closed like the "" sentinel fix)                                        |
| CAISSON-6 (Med)  | Keyed join for items[] ↔ details.line_items[]                  | `packages/billing/src/paddle-events.ts`                 | Existing suite green + a shuffled-order fixture correlating correctly by key                                                            |
| CAISSON-7 (Low)  | Warning signal when readAdjustmentItems skips a malformed item | `packages/billing/src/paddle-events.ts`                 | Skipped-item path emits the signal; behavior (skip) unchanged                                                                           |

Bucket verify: `bun test packages/billing/src packages/credits/src services/license/src`
green; changeset naming billing (+ credits if touched); no base `SCHEMA_SQL` change.

## Bucket B — test/proof hygiene (mechanical, sonnet/haiku lane, anytime)

| Linear           | Item                                                               | Anchor                                        | Verify                                                                            |
| ---------------- | ------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------- |
| CAISSON-12 (Low) | Scope test globs so stale `dist/` compiled tests never shadow src  | CI workflow + package scripts                 | Unscoped repro documented dead: `bun run test` per package discovers only `./src` |
| CAISSON-11 (Low) | Wire migrations 0008/0009 into the admin PGlite bootstrap          | `apps/admin/src/lib/admin-db.ts`              | Bootstrap chain == deploy-migrate chain (columns-contract-style parity assertion) |
| CAISSON-13 (Low) | Schedule CMK-A deletion defensively in the KMS live proof          | `packages/field-crypto/live/kms.live.test.ts` | afterAll schedules BOTH CMKs; skip-clean run unaffected                           |
| CAISSON-10 (Low) | Distinguish undefined-table from other errors in /business degrade | `apps/admin/src/app/business/page.tsx`        | Transient DB error no longer renders the provisioning hint                        |

## Bucket C — pre-launch credential pass rider

| Linear           | Item                                                                                                | Anchor                   |
| ---------------- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| CAISSON-14 (Med) | Fix `kms:CreateAlias` ResourceTag condition in the printed prover policy (aliases cannot be tagged) | `infra/kms/provision.ts` |

Executes WITH the planned pre-launch credential sweep (scoped-key regen + vault parity),
not before — the policy is print-only until the dedicated prover principal is minted.

## Bucket D — DEPLOY block (operator-gated acts, ordered; never autonomous)

Order is load-bearing:

1. **CAISSON-16** — migrations 0008/0009 on the live Railway PG **BEFORE** the license
   service redeploys from merged main (purchase webhooks 500 in the gap; Paddle is
   sandbox, so the gap is cosmetic today but the ordering habit matters for prod).
2. **CAISSON-17** — admin provisioning: `admin_write` role, provision SQL (idempotent),
   `admin_action_log` DDL, audit-chain migration, role memberships; `ADMIN_ISSUE_TOKEN`
   (license + admin) and `CAISSON_LICENSE_ISSUE_URL` (admin).
3. **CAISSON-18** — WORM store swap LocalArtifactStore → S3 Object-Lock (env-gated).
4. **CAISSON-15** — CF edge terraform: import existing docs-api record (+ possibly the
   auto-deployed Free Managed Ruleset), fill the two docs_api vars, `plan` (zero diff on
   the license resource), `apply`, 429 gate-probe without `-L`.

These belong in `docs/state/launch-runbook.md`'s deploy section when the wave merges —
the runbook edit rides whichever doc sweep follows the merges.

## Out of scope

- **CAISSON-19** — operator revoke of REAL purchase entitlements (admin surface v2).
  Needs its own SPEC + fork round (refund interaction, clawback semantics, ADR-0113/0218
  refcount effects). Do not fold into Bucket A.

## Verify (goal-backward)

After Buckets A+B land: re-run every review-named repro (over-claw sequence, ghost-grant,
duplicate join ids, shuffled correlation, stale-dist discovery, transient-DB hint) and
confirm each is dead; suites green; no new forks were silently decided. After Bucket D:
the launch-runbook gate-probes pass against the live fleet.

## Effort: Bucket A = M (one slice) · B = S (mechanical) · C = XS (rides the cred pass) · D = operator session. Value: HIGH on A (money-path defense-in-depth while context is fresh), MED on B–D (drift prevention + the wave actually going live).
