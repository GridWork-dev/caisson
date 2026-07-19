# R4 release audit — v2026.07.18.1

Window: `v2026.07.17.5..737365d2` (PRs #274-#284). Fresh cumulative pass per the release
checklist convention — every substantive PR in the window also passed its own in-session
SHIP audit at merge; this pass hunts cross-PR seams the per-PR audits could not see.

Lanes: gw-code-reviewer (opus) + gw-security-auditor (fable), run 2026-07-18/19 against
origin/main at the release SHA.

## Verdicts

- **Code-review lane: PASS** — no P0/P1/P2. Two P3 doc-only nits (below).
- **Security lane: PASS** — no majors; "release window is clean to tag."

## What was verified (highlights)

### Cross-PR seams

- **Run exposure (#275) x entitlement/pricing (#280/#283):** `run_start`/`run_status`
  gate on the dedicated `@caisson/agent-trajectory` entitlement slug (ADR-0362) through
  the constant-time 404 registerTool seam; both acquisition paths (a-la-carte
  PURCHASE_BOOK row and bundle fold via the members maps) updated in lockstep.
- **Re-versions (#282/#284) x pins:** ledger/tarballs pure append (0 deletions); bundle
  member maps pin agent-trajectory@0.3.0 (the encRef-bearing minor) and the 0.3.0 tarball
  row is present — every pin resolves; index members agree with source manifests.
- **OSCAL spine (#278):** vendored NIST catalog byte-matches its committed SHA-256 pin;
  loader is pure JSON.parse + structural walk, no dynamic execution.

### Security floor

- Approval CAS cannot be bypassed: single-UPDATE CAS transitions, claimResume
  double-execution guard, allowlist re-check on resume, tool-exec re-verifies
  name-to-command at execute().
- Parked run state AEAD-sealed with AAD bound to column context + run_id; nulled on every
  terminal transition across all three store impls; never SELECTed by any status surface.
- Digest-ref discipline (AR-4) holds at every trajectory append site.
- New Paddle rows grant only the purchased module id; resolveRenewal stays fail-closed;
  token-signing code untouched this window.
- No new raw fetch; no .strict() on provider webhook envelopes; integer money throughout;
  FORCE RLS on both new tables per the ADR-0005 pattern.

## Non-blocking findings

Queued for the next ride — comment-only edits to shipped package sources would re-stale
recorded tarball bytes, the sibling-churn class.

1. **P3** `packages/registry-schema/src/entitlements.ts:83` — JSDoc says "Currently
   reserved: agent-usage" but the set is empty (agent-usage graduated). Fix the JSDoc.
2. **P3** `packages/agent-trajectory/manifest.ts` — PUBLISH comment claims "no standalone
   SKU (bundle-only)", stale since #283 priced it a-la-carte. Fix the comment.
3. **P3 (security lane, informational)** `packages/ai-kit/src/agent-loop.ts:572` budget
   pre-check uses the `x > bound` form (NaN-fail-open class) — inputs are
   server-configured integers and reserve() remains the enforcing gate; normalize to
   `!(x <= bound)` when the file is next touched.

## Sibling-churn incidents during the tail (context, resolved)

Three consume rides tripped the ADR-0358 guard on rows whose dist inlines external-dep
types (kernel/zod, platform-reads) after non-frozen installs re-resolved deps. Resolved
per the guard's prescription (own-version repack changesets: 4c6d3f72, 63e9fae8,
7de6fa41, fc0bb999). Structural fix filed as CAISSON-127 (frozen-install-at-consume
recommended).
