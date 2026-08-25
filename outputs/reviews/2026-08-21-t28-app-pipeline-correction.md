---
phase: t28-app-pipeline-correction
project: caisson
branch: feat/cloudrun-prereqs
base: a6ff996b3b090656b8b85d971af1ec5db1d3fd8c
reviewed_commit: 989004cfa9c95b9fd675190dae717cdd3ac85bfe
reviewer: gw-code-reviewer
created: 2026-08-21
reviewed: 2026-08-22T02:54:22Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - .github/workflows/deploy-production.yml
  - .github/workflows/deploy-staging.yml
  - .github/workflows/publish-image.yml
  - .github/workflows/rollback.yml
  - deploy/README.md
  - deploy/gates.sh
  - deploy/gates.test.ts
  - deploy/manifest.test.ts
  - deploy/smoke.test.ts
  - deploy/smoke.ts
  - deploy/validate-rollback.test.ts
  - deploy/validate-rollback.ts
  - deploy/verify-receipt.test.ts
  - deploy/verify-receipt.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
classification_counts:
  blocking: 2
  recommended: 0
  optional: 0
status: issues_found
verdict: FAIL
---

# Phase T28: Code Review Report

**Verdict:** FAIL — the staging gate does not run its claimed origin/Access negative checks, and production recovery cannot compensate a failed rollout involving a first-deploy service.

## Structural Findings (fallow)

- `codebase-memory detect_changes` reported 16 changed paths and zero impacted symbols.
- The entire `deploy/` subtree is excluded as `status=excluded`, `not_indexed_dir`. The zero-symbol result is therefore not completeness evidence.
- All scoped source was reviewed directly, including the workflow-to-helper call paths.

## Narrative Findings (AI reviewer)

### Blocking

#### BL-01: Staging’s claimed bypass suite performs only authenticated happy-path requests

**Classification:** BLOCKING (BLOCKER)

**Files:**

- `/home/gw/lab/caisson-wave3/.github/workflows/deploy-staging.yml:235`
- `/home/gw/lab/caisson-wave3/deploy/smoke.ts:320`
- `/home/gw/lab/caisson-wave3/deploy/smoke.ts:405`
- `/home/gw/lab/caisson-wave3/deploy/smoke.test.ts:134`

**Relevant code:**

```ts
if (isCanaryMode(config.mode)) {
  // direct canary request
} else if (target.accessProtected) {
  headers.set("CF-Access-Client-Id", config.accessClientId!);
  headers.set("CF-Access-Client-Secret", config.accessClientSecret!);
}
```

**Issue:** The workflow labels this step `origin + Access bypass suite`, and the T28 contract says staging must exercise the public hostname plus the origin and Access bypass legs. In practice, `staging` is non-canary, every staging target uses a `gwstg.dev` public hostname, and every request carries the Access service token. No request reaches a raw `run.app` origin without the origin header, and no public request omits the Access token to prove the expected Access redirect.

The new test reinforces the gap by asserting that all eight staging requests include Access credentials. The step therefore remains green if the raw origin begins serving unauthorized traffic or if Cloudflare Access is disabled, contradicting the release-gate contract.

**Fix:** Implement distinct staging checks:

1. Public requests with the service token must reach the application.
2. Public requests without the token must receive the expected Cloudflare Access redirect.
3. Raw Cloud Run origins without the origin header must return 401/403.

Supply validated raw-origin URLs to `smoke.ts` or invoke an equivalent governed bypass-suite implementation. Add tests proving both negative legs fail when their boundary is removed. If workflow inputs must change, fix the upstream T28 template first and re-copy it verbatim.

#### BL-02: Production recovery silently skips first-deploy services

**Classification:** BLOCKING (BLOCKER)

**File:** `/home/gw/lab/caisson-wave3/.github/workflows/deploy-production.yml:286`

**Relevant code:**

```bash
[ -n "$rev" ] || continue
printf '%s %s\n' "$svc" "$rev"
```

The recovery step later processes only recorded rows:

```bash
failed=0
while read -r svc rev; do
  ...
  gcloud run services update-traffic "$svc" \
    --to-revisions "${rev}=100" || failed=1
done < rollback-revisions.txt
```

**Issue:** The workflow deliberately tolerates a service that does not yet exist, but represents that state by omitting the service from `rollback-revisions.txt`. If a multi-service rollout subsequently shifts traffic to that new service and a later shift, observation, or smoke fails, recovery restores only services with prior revisions. The new service is left at its last traffic state.

Because `tee` still creates an empty or partial file, the `hashFiles` guard passes. The restore loop sees no missing row, leaves `failed=0`, and emits no `TRAFFIC RESTORE FAILED` alarm. This violates the workflow’s stated guarantee that every service returns to its pre-run state.

**Fix:** Represent every planned service and its prior state explicitly, preferably as structured JSON with `priorRevision: string | null`. Before shipping, define and implement the approved compensator for `null`—or reject first-deploy services from this rollout until a bootstrap procedure establishes a known rollback state. Add a workflow-shell test covering a mixed existing/new-service rollout followed by a simulated failure. This defect is in the byte-identical upstream workflow, so correct it in `gridwork-infra` and re-copy rather than patching Caisson locally.

## Recommended

None.

## Optional

None.

## Verified Properties

- All five upstream-owned files are byte-identical to `gridwork-infra@0d22c39`.
- `bash deploy/gates.sh` exited 0: Turbo 120/120 tasks and deploy 37/37 tests passed.
- `bun test deploy` also completed without failures.
- All four workflow files parse as valid YAML with `yq`.
- `git diff --check HEAD~2..HEAD` is clean.
- The four public services load the shared origin gate at boot. The confirmed variable names are:
  - `origin_secret_mode = "ORIGIN_SECRET_MODE"`
  - `origin_secret_current = "ORIGIN_SECRET"`
  - `origin_secret_next = "ORIGIN_SECRET_NEXT"`
- `caisson-demos` remains deliberately excluded from the public-origin-secret rows.
- No source files were modified during review. `BRIEF.md` and `.source/` remain untracked.

---

_Reviewed: 2026-08-22T02:54:22Z_

_Reviewer: gw-code-reviewer_
_Depth: deep_
