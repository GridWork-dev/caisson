---
phase: release-train-2026-09-r4
reviewed: 2026-09-16T02:13:00Z
depth: deep
base: v2026.08.18
head: 895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c
commits_in_scope: 89
paths_in_scope: 430
files_reviewed: 69
files_reviewed_list:
  - CLAUDE.md
  - .github/workflows/deploy-production.yml
  - .github/workflows/deploy-railway.yml
  - .github/workflows/deploy-staging.yml
  - .github/workflows/mirror-sync.yml
  - .github/workflows/publish-image.yml
  - .github/workflows/publish.yml
  - .github/workflows/release-train.yml
  - .github/workflows/security-scan.yml
  - .github/workflows/version-pr.yml
  - apps/admin/src/lib/cloudflare-access.ts
  - apps/admin/src/proxy.ts
  - apps/site/app/api/cart/owned/route.test.ts
  - apps/site/app/api/cart/owned/route.ts
  - apps/site/app/demos/[[...path]]/route.ts
  - apps/site/components/cart-checkout-panel.tsx
  - apps/site/lib/ask-ai/handler.ts
  - apps/site/lib/auth-server.ts
  - apps/site/lib/demos-proxy.ts
  - apps/site/lib/session-hint-cookie.ts
  - apps/site/proxy.ts
  - docs/deploy/receipts/caisson-license.json
  - docs/deploy/receipts/caisson-site.json
  - knowledge/decisions/ADR-0419-pin-the-image-publish-scan-posture-with-a-local-guard.md
  - knowledge/decisions/ADR-0420-schedule-the-subprocess-environment-default-flip.md
  - packages/agent-kernel/src/hooks.ts
  - packages/agent-runner/src/engine-env.ts
  - packages/ai-kit/src/agent-loop.ts
  - packages/audit-worm/src/anchor-transparency.ts
  - packages/jobs/src/queue.ts
  - packages/kernel/src/origin-gate.ts
  - packages/kernel/src/ssrf.ts
  - packages/local-store/src/embed-scrub-guard.ts
  - packages/local-store/src/egress-guard.test.ts
  - packages/local-store/src/store.ts
  - packages/observability/src/scrub.ts
  - packages/rate-limit/src/token-bucket.ts
  - packages/tenancy-rls/src/pool.ts
  - packages/tenancy-rls/src/supabase.ts
  - packages/tool-exec/src/propose.ts
  - packages/tool-exec/src/tool-exec.test.ts
  - packages/tool-exec/src/tool-exec.ts
  - registry/scripts/ci-publish-step.ts
  - deploy/observe.ts
  - deploy/smoke.ts
  - deploy/validate-rollback.ts
  - outputs/audit/2026-08-21-t28-app-pipeline-correction-SECURITY.md
  - outputs/audit/release-train-2026-09-receipt.md
  - outputs/audit/release-train-2026-09-RUN-NOTES.md
  - outputs/audit/s8-direct-key-prediction.md
  - outputs/audit/s8-release-review-preparation.md
  - outputs/audit/s8-release-version-plan.md
  - outputs/audit/s8-removal-verification.md
  - outputs/reviews/2026-08-21-t28-app-pipeline-correction.md
  - scripts/release-readiness.ts
  - services/betterstack-adapter/handler.ts
  - services/support-bot/src/caisson_support_bot/__main__.py
  - services/support-bot/src/caisson_support_bot/billing_grant.py
  - services/support-bot/src/caisson_support_bot/lifecycle.py
  - services/license/src/abandoned-checkout-job.ts
  - services/license/src/abandoned-checkout-scheduler.ts
  - services/license/src/anchor-checkpoint-job.ts
  - services/license/src/app.ts
  - services/license/src/deploy.ts
  - services/license/src/finite-job.ts
  - services/license/src/license-expiry-job.ts
  - tools/security/image_scan_policy.py
  - tools/security/rescan_base_images.py
  - tools/security/rescan_runtime_images.py
findings:
  critical: 6
  warning: 0
  info: 0
  total: 6
status: issues_found
verdict: FAIL
release_readiness: BLOCKED
---

# R4 Cumulative Release Code Review

**Reviewed:** 2026-09-16T02:13:00Z

**Depth:** deep

**Range:** `v2026.08.18..895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c`

**Scope:** 89 commits, 430 paths

**Verdict:** **FAIL — six blocking correctness, security, money-path, and release-integrity defects remain.**

## Narrative Findings (AI reviewer)

## Summary

The cumulative release is not ready for a green release PR in its current form. The most consequential defects are:

- Externally parked tool approvals can be altered before execution.
- The cloud embedder sends a bearer credential after only literal-host SSRF validation.
- Absence of an optional session hint can expose already-owned products to another checkout.
- The staging “origin + Access bypass suite” performs neither advertised negative check.
- Runtime-image enforcement is not consumed by the release-readiness gate.
- R4 readiness accepts any file with the expected audit filename, regardless of verdict or reviewed SHA.

The Python image policy itself correctly preserves R344’s OS-only enforcement: fixable HIGH/CRITICAL `os-pkgs` rows block, while application findings remain reported residuals. The known native-TypeScript and support-bot application findings are therefore disclosures, not new CVE findings in this review.

Security-sensitive findings CR-01 through CR-04 should also be routed through the separately authorized `gw-security-auditor` lane.

## Critical Issues

### CR-01: Externally parked tool approvals are not bound to the arguments or environment eventually executed

**Classification:** BLOCKER

**Files:**

- `packages/tool-exec/src/propose.ts:30-42`
- `packages/tool-exec/src/tool-exec.ts:182-190`
- `packages/tool-exec/src/tool-exec.test.ts:226-235`

**Relevant code:**

```ts
const spec = gate.lookup(proposed.name);
if (spec === undefined || spec.command !== proposed.command) {
  throw new NotFoundError(...);
}
return spawn(spec.command, proposed.args, proposed.reason, proposed.env);
```

**Issue:** `ProposedToolCall` is deliberately serializable for storage in an external approval system, but `execute()` verifies only `name` and `command`. It trusts the externally returned `args`, `reason`, and newly added `env` without either revalidation or an integrity binding to what the operator approved.

A caller can construct or alter a proposal after approval while preserving the same allowed command. This can change the command’s operation through different arguments and can inject an environment such as a hostile `PATH`, `LD_PRELOAD`, or credentials that the current allowlist no longer supplies. The regression test explicitly enshrines execution of a hand-built proposal.

**Failure path:**

1. A benign call is proposed and shown to an approver.
2. The serialized record is modified before `execute()`.
3. `name` and `command` still match the allowlist.
4. Modified arguments and environment are spawned without proving they were approved.

**Fix:** Make approval records server-issued and immutable. Persist a canonical digest or opaque proposal ID covering at least `name`, `command`, validated arguments, reason, and policy version. At execution, atomically consume the stored approved record, re-run current schema validation, verify its digest, and derive `env` from the current `CommandSpec`, never from the returned proposal.

```ts
const approved = await approvalStore.consume(proposed.approvalId);
const current = gate.propose(approved.name, approved.args, approved.reason);

assertApprovalDigest(approved.digest, canonicalDigest(current));
return spawn(current.command, current.args, current.reason, current.env);
```

Add negative tests for mutated arguments, a forged proposal, altered environment, and allowlist environment rotation.

### CR-02: Cloud embedding credentials can still be sent to a hostname resolving to a private or metadata address

**Classification:** BLOCKER

**Files:**

- `packages/local-store/src/embed-scrub-guard.ts:102-134`
- `packages/kernel/src/ssrf.ts:12-20`
- `packages/kernel/src/ssrf.ts:132-173`

**Relevant code:**

```ts
assertSafePublicUrl(config.endpoint);

const res = await fetchImpl(config.endpoint, {
  headers: {
    authorization: `Bearer ${config.apiKey}`,
  },
  redirect: "error",
  ...
});
```

**Issue:** `assertSafePublicUrl()` rejects literal private addresses but deliberately performs no DNS resolution. The kernel contract explicitly requires `assertSafePublicUrlResolved()` at an outbound-fetch seam.

A public-looking hostname whose A/AAAA record resolves to loopback, RFC1918, link-local, or cloud metadata passes construction and receives the buyer’s bearer credential plus embedded content. Blocking redirects does not close the original-host DNS path.

**Failure path:**

1. Configure `https://embed.attacker.example/v1`.
2. The hostname resolves to `127.0.0.1`, `10.0.0.0/8`, or `169.254.169.254`.
3. The literal-host check passes.
4. The credential-bearing POST reaches the private destination.

**Fix:** Apply the resolved guard immediately before every request, or use the kernel’s guarded fetch wrapper.

```ts
embed: async (text) => {
  await assertSafePublicUrlResolved(config.endpoint);
  const res = await fetchImpl(config.endpoint, request, timeout);
  ...
}
```

Keep `redirect: "error"`. If split-horizon/private endpoints are a supported product requirement, that requires an explicit allowlist and operator decision rather than weakening the global SSRF invariant. Add a resolver-seam test proving that a public hostname resolving to private space is rejected before `fetchImpl` receives the request.

### CR-03: Missing optional session hint can cause an authenticated buyer to purchase an already-owned SKU

**Classification:** BLOCKER

**Files:**

- `apps/site/app/api/cart/owned/route.ts:14-30`
- `apps/site/lib/auth-server.ts:51-80`
- `apps/site/components/cart-checkout-panel.tsx:49-74`

**Relevant code:**

```ts
if (jar.get(SESSION_HINT_COOKIE_NAME) === undefined) {
  return NextResponse.json({ owned: [] }, ...);
}
const owned = await getOwnedCartItemIds();
```

The checkout later submits every client-side cart item directly:

```ts
await openCartCheckout(
  items.map((item) => ({ priceId: item.priceId })),
  accountId,
  promoCode,
);
```

**Issue:** Absence of the hint cookie is treated as proof that no session exists, but the hint is not the durable session credential. Valid sessions created before ADR-0418, clients that discard the hint independently, and refresh failures can retain the real session without the hint.

The route then returns a false empty ownership set. No server-side entitlement check filters the cart before Paddle receives its lines, so the buyer can be charged again for a binary entitlement already owned. The test at `route.test.ts:33-42` currently pins this false-negative behavior.

**Fix:** Do not derive session absence from the optional hint. The safest immediate fix is to resolve the real session on this endpoint. If the optimization is retained, short-circuit only after checking the actual Better Auth session-cookie variants through its supported cookie parser. Independently move checkout creation behind a server endpoint that rechecks active entitlements and rejects or removes already-owned lines before contacting Paddle.

Add regression coverage for:

- valid durable session with no hint;
- independently expired/evicted hint;
- an already-owned line reaching checkout;
- forged hint with no session remaining harmless.

### CR-04: The staging “origin + Access bypass suite” performs only authenticated happy-path requests

**Classification:** BLOCKER

**Files:**

- `.github/workflows/deploy-staging.yml:263-281`
- `deploy/smoke.ts:313-320`
- `deploy/smoke.ts:353-376`
- `deploy/smoke.ts:450-486`

**Relevant code:**

```ts
if (targets.some((target) => target.accessProtected) &&
    (!parsed.accessClientId || !parsed.accessClientSecret)) {
  throw new Error("Cloudflare Access service credentials are required");
}

...

} else if (target.accessProtected) {
  headers.set("CF-Access-Client-Id", config.accessClientId!);
  headers.set("CF-Access-Client-Secret", config.accessClientSecret!);
}
```

**Issue:** Every staging target is marked `accessProtected`, configuration refuses to run without Access credentials, and every request uses the public `gwstg.dev` hostname with those credentials. No request:

- reaches the raw `run.app` origin without the origin secret; or
- reaches an Access-protected hostname without the Access token.

The workflow can therefore remain green if either denial boundary is removed. This exact blocker was reported in the in-range T28 review and remains present at the reviewed head.

**Fix:** Make the staging suite exercise three distinct legs:

1. Authenticated public-host request succeeds.
2. Public-host request without Access credentials receives the expected Access denial/redirect.
3. Strictly validated raw `run.app` request without the origin header receives 401/403.

Resolve raw service URLs through a governed `gcloud` argv call, validate the entire URL against the expected Cloud Run hostname shape before sending anything, and add mutation tests proving removal of either boundary makes the suite fail.

### CR-05: Runtime-image vulnerability failures are not required by release readiness

**Classification:** BLOCKER

**Files:**

- `.github/workflows/security-scan.yml:223-301`
- `scripts/release-readiness.ts:41-54`
- `scripts/release-readiness.ts:148-195`

**Relevant code:**

```yaml
runtime-images:
  name: runtime image (${{ matrix.name }})
  ...
  - name: enforce runtime OS vulnerabilities and report application residual
    run: python3 -B tools/security/rescan_runtime_images.py ...
```

The readiness list contains only:

```ts
[
  "check",
  "standards-gate",
  "registry-index",
  "oscal-conformance",
  "deterministic",
  "support-bot",
];
```

**Issue:** Runtime-image scans are separate matrix check runs, while `release-readiness.ts` requires only the `deterministic` source-scan job from the same workflow. A release SHA can therefore have a green `deterministic` check and a red runtime image caused by a fixable HIGH/CRITICAL OS vulnerability, yet still pass readiness.

This is especially material because the private repository has no enforced branch protection and the repository documentation identifies `release-readiness.ts` as the discipline that supplies the gate.

This finding does not dispute R344’s classification: application findings remain report-only. The defect is that the enforcing OS result is not consumed by release readiness.

**Fix:** Add a stable aggregate job after the matrix and require its check name.

```yaml
runtime-images-gate:
  name: runtime-images-gate
  if: always()
  needs: [runtime-select, runtime-images]
  steps:
    - run: test '${{ needs.runtime-images.result }}' = success
```

Then add `runtime-images-gate` to `REQUIRED_CHECKS`. Add a contract test proving that a failed matrix member produces a failed stable aggregate and that readiness requires it.

### CR-06: R4 readiness accepts an empty, stale, failed, or wrong-SHA audit artifact

**Classification:** BLOCKER

**File:** `scripts/release-readiness.ts:293-302`

**Relevant code:**

```ts
const path = join(REPO, "outputs/audit", `release-audit-${tag}.md`);
record(
  "R4 release audit on file",
  existsSync(path),
  ...
);
```

**Issue:** The release gate validates only filename existence. It does not read the report or verify:

- a passing verdict;
- zero blocking findings;
- the release base, tag, or final candidate SHA;
- reviewed file scope;
- reviewer identity;
- whether the file is empty or merely a preparation placeholder.

Consequently, any file at the expected path satisfies R4 even when its contents say the review never ran or failed. The supplied preparation document already acknowledges this weakness.

**Fix:** Parse strict, machine-readable frontmatter and fail closed unless it contains a supported schema with:

- `status: clean` or an explicitly allowed passing disposition;
- `critical: 0`;
- exact release base, tag, and final version/attestation SHA;
- non-empty reviewed scope;
- completed reviewer identity and timestamp.

The eventual audit must bind the post-versioning final SHA. The absence of that future SHA today is a pending release act, not itself a defect; the defect is that the current gate cannot distinguish that absence from a completed passing review.

## Six-Target Assessment

### Task 1 measurement and diagnostic removal

The historical eight-observation evidence supports the narrow claim that the observed application keys varied by client while forged forwarding headers did not change the observed derived key. It does not independently establish fleet-wide behavior across replicas or restarts: the record lacks a durable instance identifier, and the observations are historical rather than freshly reproduced.

No correctness defect was found in the reviewed diagnostic removal. The supplied evidence records absence of the four markers and five identifiers, restoration of the two-argument limiter interface, and equality of the three implementation paths with the pre-diagnostic source. Those checks were not rerun in this review.

### Egress and authentication

CR-02 leaves a DNS-based alternate egress path in the cloud embedder. CR-03 makes an optional cookie authoritative for a money-adjacent session decision. CR-04 leaves the staging origin and Access boundaries untested despite the workflow’s claim.

The reviewed Better Stack, TSA, demos-proxy, origin-gate, and Cloudflare Access paths did not yield an additional proven defect.

### Money and license

CR-03 is a direct duplicate-purchase risk. No additional defect was proven in the reviewed license limiter, deployment/migration, finite-job, RLS-pool, or support-bot grant paths. That statement is limited to the directly inspected paths and is not whole-service coverage.

### Runtime policy

`image_scan_policy.py` and the runtime/base rescan helpers implement R344’s OS-only classification consistently in the inspected code. Application findings remain recorded rather than blocking.

ADR-0419 deliberately keeps the generic `publish-image.yml` Trivy action report-only by default; this review does not relabel that accepted posture as a vulnerability. CR-05 concerns the separate enforcing runtime matrix not being consumed by release readiness.

### Release integrity

Version, publish, mirror, Railway-ref, and registry-publish paths were inspected at their primary seams. No additional concrete break in append-only ledger/sidecar handling or tag/ref consumption was proven.

However, CR-05 and CR-06 mean the final readiness result can be green without two of the claims it purports to enforce. The planned 60 workspace bumps do not prove that all 52 eligible packages pack successfully, and no final version/attestation SHA exists yet.

## Verification and Review Limits

No tests, package commands, live probes, network calls, credentials, or external systems were used, per the review instructions.

Supplied—not independently rerun—verification includes:

- Bun 1.4.2;
- 64 targeted tests, 0 failures, 168 assertions;
- limiter build and six-file lint pass;
- full formatting over 3,503 files;
- recorded runtime-policy tests and saved-report evaluation;
- diagnostic marker/signature/hash checks.

Scope was independently reconciled as 89 commits and 430 paths. The later commits after the exact head contain administrative audit material rather than additional product changes.

The live/dirty branch graph service was unavailable under the governed tool surface, so cross-module analysis used Git history and literal call-chain inspection as the authorized fallback.

The review stopped when a permitted broad literal search encountered the workspace’s denied environment-file path, as required by the dispatch rules. Verbatim denial:

```text
rg: ./services/intel/.env.example: Permission denied (os error 13)
```

No alternative read of that path was attempted.

## Unreviewed Surface

This is not an exhaustive 430-path review. High-risk seams and all six requested dimensions were prioritized. Material areas not fully inspected include:

- `.agents/skills/` implementation, explicitly excluded by the dispatch instruction;
- most marketing, legal, documentation, and generated-content changes;
- the full docs-service server/index/artifact implementation;
- the intel-service store;
- CLI template and golden-file changes;
- most admin provisioning, boot, database, and instrumentation code;
- the complete deploy helper/test suite outside the named smoke, observation, rollback, and workflow seams;
- broader audit-harness/design-critic retirement changes;
- full compatibility analysis for deleted packages;
- the lockfile and the accepted application-dependency residual inventory;
- most changed tests except those directly relevant to the findings.

No clean or exhaustive-review claim is made for those areas.

## Disposition

**FAIL / RELEASE READINESS BLOCKED.**

The current preparation should not be represented as a green release PR. After CR-01 through CR-06 are repaired and independently verified, a release PR can proceed while final release readiness remains pending the normal later acts:

- final version/attestation commit;
- actual pack verification for all eligible packages;
- complete CI, including a stable runtime-image aggregate;
- live-hybrid/checklist attestations;
- a final R4 audit bound to the exact release SHA.

No merge, tag, publish, deploy, migration, or branch-deletion authority is implied by this review.

---

_Reviewed: 2026-09-16T02:13:00Z_

_Reviewer: Codex (gw-code-reviewer)_

_Depth: deep_
