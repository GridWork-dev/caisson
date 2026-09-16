---
phase: release-train-2026-09-r359
reviewed: 2026-09-16T03:48:24Z
depth: deep
base: 895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c
head: c6156d8ce916ced54fba3309b6999c9a7a73167a
repair_commits: 6
files_reviewed: 46
files_reviewed_list:
  - .changeset/s8-bound-tool-approvals.md
  - .changeset/s8-resolved-embedding-egress.md
  - .github/workflows/deploy-staging.yml
  - .github/workflows/release-train.yml
  - .github/workflows/security-scan.yml
  - CLAUDE.md
  - apps/demos/components/poke/tool-exec-poke.test.ts
  - apps/site/app/api/cart/checkout/route.ts
  - apps/site/app/api/cart/owned/route.test.ts
  - apps/site/app/api/cart/owned/route.ts
  - apps/site/app/dashboard/cart/page.tsx
  - apps/site/components/cart-checkout-panel.tsx
  - apps/site/components/schematic-sheets-guard.tsx
  - apps/site/lib/auth-account.test.ts
  - apps/site/lib/auth-server.ts
  - apps/site/lib/auth.ts
  - apps/site/lib/cart-routes.test.ts
  - apps/site/lib/cart-routes.ts
  - apps/site/lib/catalog.ts
  - apps/site/lib/db.ts
  - apps/site/lib/module-pages.ts
  - apps/site/lib/owned-cart-items.ts
  - apps/site/lib/paddle-cart-transaction.test.ts
  - apps/site/lib/paddle-cart-transaction.ts
  - apps/site/lib/paddle-checkout.test.ts
  - apps/site/lib/paddle-checkout.ts
  - apps/site/lib/session-hint-cookie.ts
  - deploy/README.md
  - deploy/smoke.test.ts
  - deploy/smoke.ts
  - deploy/staging-origins.test.ts
  - deploy/staging-origins.ts
  - docs/releases/TEMPLATE-checklist.md
  - knowledge/decisions/ADR-0423-bind-tool-approvals-to-private-records.md
  - knowledge/decisions/ADR-0424-recheck-cart-entitlements-before-checkout.md
  - packages/kernel/src/ssrf.ts
  - packages/local-store/src/egress-guard.test.ts
  - packages/local-store/src/embed-scrub-guard.ts
  - packages/tool-exec/README.md
  - packages/tool-exec/src/approval.ts
  - packages/tool-exec/src/index.ts
  - packages/tool-exec/src/propose.ts
  - packages/tool-exec/src/tool-exec.test.ts
  - packages/tool-exec/src/tool-exec.ts
  - scripts/release-readiness.test.ts
  - scripts/release-readiness.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
verdict: FAIL
release_readiness: BLOCKED
---

# R359 Renewed Repair Code Review

**Reviewed:** 2026-09-16T03:48:24Z  
**Depth:** deep  
**Candidate:** `c6156d8ce916ced54fba3309b6999c9a7a73167a`  
**Verdict:** **BLOCKED**

## Narrative Findings (AI reviewer)

## Summary

Four original blockers are closed at the reviewed implementation seams:

- CR-01 now rejects forged or modified approval envelopes, revalidates saved input against current policy, derives environment from the current spec, and consumes approvals once.
- CR-02 now resolves the embedding hostname immediately before every request and retains `redirect: "error"`.
- CR-04 now exercises authenticated staging success, anonymous Cloudflare Access denial, and raw-origin denial through strictly validated resolved Cloud Run URLs.
- CR-05 now exposes a stable `runtime-images-gate` and requires it in release readiness.

Two blockers remain:

- CR-06’s replacement gate is operationally impossible to satisfy because it requires an audit committed in a Git tree to contain that same commit’s SHA.
- CR-03’s checkout uses an account resolver that intentionally converts membership-read failures into the personal account, allowing the transaction to be checked and stamped against the wrong tenant.

The approval repair also introduces an availability defect: the default store has no rejection/cancellation path, so ordinary denied or abandoned approvals permanently consume its bounded capacity.

This is a repair review, not a new exhaustive review of `v2026.08.18..895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c`. The original review’s 430-path coverage limitations remain.

## Critical Issues

### CR-07: The exact-SHA audit contract is self-referential and cannot produce a green release

**Classification:** BLOCKER

**Files:**

- `scripts/release-readiness.ts:345-349`
- `.github/workflows/release-train.yml:54-64`
- `docs/releases/TEMPLATE-checklist.md:14-18`
- `docs/releases/TEMPLATE-checklist.md:36-43`
- `scripts/release-readiness.test.ts:65-66`

**Relevant code:**

```ts
return (
  audit.base === binding.base &&
  audit.tag === binding.tag &&
  audit.sha === binding.sha
);
```

The workflow supplies the tagged commit itself:

```yaml
RELEASE_SHA: ${{ github.sha }}
...
--sha "$RELEASE_SHA"
```

**Issue:** The tag’s tree must contain `outputs/audit/release-audit-<tag>.md`, and that file must name the tag commit’s exact SHA. Adding or changing that file changes the tree hash and therefore changes the commit SHA. An audit written with the parent SHA fails the comparison; an audit cannot be written with the successor SHA before that successor exists.

The unit test uses an arbitrary `"a".repeat(40)` fixture and therefore proves only parser behavior, not that the Git lifecycle can construct a satisfying artifact.

**Failure path:**

1. Review the version candidate at SHA A.
2. Write an audit containing `sha: A`.
3. Commit the audit/checklist, producing final tag candidate SHA B.
4. Release workflow passes B as `--sha`.
5. The committed audit still names A, so readiness fails.
6. Amending it to name B produces another SHA C, repeating the mismatch.

**Required remedy:** Stop before security review or PR. This needs an operator/architecture lock because two valid designs have materially different trust models:

- Recommended, high confidence: bind the audit to a `reviewed_sha` such as the candidate’s parent, then have readiness independently prove that `reviewed_sha..tag_sha` contains only an explicitly allowed attestation-only path set.
- Alternative: keep exact tag-SHA binding but store the audit as an external signed attestation/workflow artifact rather than inside the Git tree whose hash it names.

Illustrative shape for the first option:

```ts
const reviewedSha = run("git", ["rev-parse", `${tagSha}^`]);
assertOnlyAttestationChanges(reviewedSha, tagSha);

const binding = {
  base: previousRelease,
  tag,
  sha: reviewedSha,
};
```

The final tagged SHA must still receive CI; the audit must not permit unreviewed product bytes in the attestation successor.

### CR-08: Checkout silently falls back from the selected organization to the personal account

**Classification:** BLOCKER

**Files:**

- `apps/site/app/api/cart/checkout/route.ts:6-9`
- `apps/site/lib/auth.ts:47-63`
- `apps/site/lib/auth.ts:87-100`
- `apps/site/lib/cart-routes.ts:52-79`
- `knowledge/decisions/ADR-0424-recheck-cart-entitlements-before-checkout.md:16-22`

**Relevant code:**

```ts
async function resolveActiveAccount(...) {
  const personal = { accountId: userId, role: "owner" as Role };
  try {
    const memberships = await listMyAccounts(userId);
    const active = selectActiveAccount(memberships, requestedAccountId);
    return active
      ? { accountId: active.accountId, role: active.role }
      : personal;
  } catch {
    return personal;
  }
}
```

The checkout route injects this resolver unchanged:

```ts
export const POST = cartCheckoutHandler({
  session: getSession,
  owned: getOwnedCartItemIdsForAccount,
  createTransaction: createPaddleCartTransaction,
});
```

**Issue:** `getSession()` is designed for dashboard availability and deliberately treats an account-membership read failure as the user’s personal account. That behavior is unsafe when reused as the authoritative money-path identity.

This conflicts with ADR-0424’s requirements that entitlement reads fail closed and that the transaction use the verified account’s tenant scope.

**Failure path:**

1. A signed-in buyer selects an organization through `cs_active_account`.
2. `resolveUserAccounts()` fails transiently or because the membership surface is unavailable.
3. `resolveActiveAccount()` catches the error and returns `{ accountId: userId, role: "owner" }`.
4. The entitlement read for the personal account succeeds or recovers.
5. Organization-owned SKUs appear unowned.
6. Paddle receives a transaction stamped with the personal account ID, risking a duplicate charge and granting the purchase to the wrong tenant.

The new route tests inject a pre-resolved fixed session and do not exercise the production resolver’s fallback.

**Required remedy:** Add a commerce-specific session/account resolver that propagates membership-resolution failures instead of converting them to a personal account. Preserve the existing dashboard fallback separately if that availability behavior remains required. Include session resolution inside the checkout handler’s fail-closed error boundary.

```ts
async function resolveCheckoutAccount(
  userId: string,
  requestedAccountId?: string,
): Promise<{ accountId: string; role: Role }> {
  const memberships = await listMyAccounts(userId); // no catch-to-personal
  const active = selectActiveAccount(memberships, requestedAccountId);
  if (!active) throw new Error("Checkout account could not be resolved");
  return { accountId: active.accountId, role: active.role };
}
```

Add a production-binding regression where an organization is selected, membership resolution throws, and neither the entitlement reader nor Paddle transaction creator is called. Because this changes an intentionally fail-safe auth behavior and currently conflicts with ADR-0424, route the exact resolver split through the operator/architect lock.

## Warnings

### WR-01: Denied or abandoned approvals permanently exhaust the default approval store

**Classification:** WARNING

**Files:**

- `packages/tool-exec/src/approval.ts:35-50`
- `packages/tool-exec/src/tool-exec.ts:110-124`
- `knowledge/decisions/ADR-0423-bind-tool-approvals-to-private-records.md:24-36`

**Relevant code:**

```ts
if (records.has(id) || records.size >= 1000) {
  throw new Error("Approval store refused duplicate or excess pending record");
}
records.set(id, structuredClone(record));
```

Records are deleted only through `consume()`, which is reached by `execute()`.

**Issue:** The documented approval flow calls `execute()` only after approval. A denied or abandoned proposal therefore remains in the internal default store forever. The default store is not exposed through `ToolExec`, so callers cannot reclaim those records without injecting and managing a custom store.

After 1,000 ordinary denials or abandoned approvals, every subsequent `propose()` fails until the process restarts.

**Fix:** Extend the locked approval design with an explicit atomic rejection/revocation path that deletes without spawning, or add a defined expiry policy. For example:

```ts
interface ToolApprovalStore {
  put(record: StoredToolApproval): Promise<void>;
  consume(approvalId: string): Promise<StoredToolApproval | undefined>;
  reject(approvalId: string): Promise<boolean>;
}

interface ToolExec {
  propose(...): Promise<ToolApproval>;
  execute(approval: unknown): Promise<ExecResult>;
  reject(approval: unknown): Promise<void>;
}
```

Test that 1,000 explicitly rejected approvals can be reclaimed, rejection cannot execute, and rejected IDs cannot later be replayed. ADR-0423 currently locks a no-expiry design, so the precise rejection/expiry mechanism requires an ADR extension rather than an undocumented behavior change.

## Original Blocker Closure Matrix

| Original                        | Assessment                                    | Evidence                                                                                                                                     |
| ------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-01 approval mutation         | Closed for the reported mutation/forgery path | Private stored record, canonical digest, current-policy fingerprint, current-schema revalidation, spec-owned environment, atomic consumption |
| CR-02 embedding DNS             | Closed with disclosed residual                | Resolved guard runs at every request; redirect following remains disabled. Kernel’s documented resolve/fetch TOCTOU remains                  |
| CR-03 duplicate checkout        | **Not fully closed**                          | Hint-absence defect is fixed, but CR-08 permits wrong-tenant entitlement checking and transaction stamping on membership-read failure        |
| CR-04 staging denial legs       | Closed for local/structural proof             | Three distinct legs and strict URL-map resolution exist. No live probe or middleware attribution is claimed                                  |
| CR-05 runtime image gate        | Closed                                        | Stable aggregate requires selector and matrix success and is present in the seven-check readiness set                                        |
| CR-06 audit artifact validation | **Not closed**                                | Content validation is stricter, but CR-07 makes the final tag-bound contract unsatisfiable                                                   |

## Verification and Review Limits

No tests, package commands, live probes, network calls, credentials, or external systems were used in this review.

Supplied evidence—not independently rerun—states:

- six guard mutations went red and were restored byte-identically;
- combined targeted result: 125 pass, 0 fail, 457 assertions, with the accepted pre-existing exit 99;
- ai-kit retry: 170 pass, 0 fail, 602 assertions;
- bounded full equivalent check: exit 0, 199/199 tasks, 191 cached;
- captured suite totals including cached replay: 7,019 pass, 0 fail, 28,115 assertions;
- deploy tests: 64 pass, 0 fail, 329 assertions;
- standards gate: 67 checked, 5 scaffold-skipped.

Those results do not exercise CR-07’s Git lifecycle or CR-08’s production account-resolution failure path.

Additional evidence read included:

- `outputs/audit/s8-r356-retry3-REVIEW.md`
- `outputs/audit/release-train-2026-09-RUN-NOTES.md`
- `outputs/audit/s8-r359-baseline-exit99.json`
- the three supplied R359 repomix packs

The live-branch graph MCP was unavailable under this governed tool surface. Cross-module analysis therefore used named source reads, Git history, and scoped literal call-chain inspection. Uncommitted worktree evidence was excluded from the committed candidate.

## Disclosures and Uncovered Areas

- This review reassessed the six repairs and their direct dependencies. It does not claim exhaustive coverage of the original 89-commit, 430-path release range.
- The original review’s unreviewed marketing, docs-service, intel-service, template, admin, broader deployment, retired-package, lockfile, and dependency-residual surfaces remain uncovered.
- The embedding guard still has the kernel’s documented DNS resolve/transport TOCTOU window.
- Checkout still filters only active exact-SKU entitlements at transaction creation. Bundle expansion, already-created transactions, concurrent purchases, and later payment settlement remain outside its guarantee.
- Staging denial signatures prove refusal, not attribution to a particular middleware.
- No live staging, Paddle, DNS, or release-readiness probe was run.
- R344’s OS-only image enforcement and known application CVE residuals remain unchanged.
- Final version/attestation SHA, actual 52-package packing, drained changesets, final SOT, live-hybrid evidence, and the final tag-bound R4 artifact are future release acts. There are still 37 pending changesets and 60 effective bumps.
- The separate security audit has not run. Per the authorized sequence, this BLOCKED code-review verdict stops before that dispatch.

## Disposition

**FAIL / BLOCKED.**

Do not proceed to the security audit or green release PR until CR-07 and CR-08 are resolved and independently re-reviewed. WR-01 should also be repaired before shipping the new default approval-store behavior.

No merge, version dispatch, tag, publish, deployment, live probe, migration, or branch deletion is authorized or implied.

---

_Reviewed: 2026-09-16T03:48:24Z_  
_Reviewer: Codex (gw-code-reviewer)_  
_Depth: deep_
