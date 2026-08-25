---
phase: t28-app-pipeline-correction
project: caisson
branch: feat/cloudrun-prereqs
base: a6ff996b3b090656b8b85d971af1ec5db1d3fd8c
reviewed_commit: 989004cfa9c95b9fd675190dae717cdd3ac85bfe
reviewer: gw-security-auditor
created: 2026-08-21
verdict: FAIL
---

# SECURITY — T28 application pipeline correction

Security audit of commits `eff030f370bafc0c5a8a9a9ae033a22edac9ce92` and
`989004cfa9c95b9fd675190dae717cdd3ac85bfe`.

The initial static audit passed, but the parallel deep code review found two incomplete
pipeline mitigations. The reconciled verdict is **OPEN_THREATS — FAIL SHIP**. Both are
upstream-template BLOCKERS, so PR #448 must remain draft. Deployment readiness also
remains **HOLD** because the production receipt is absent; that condition fails closed
and does not authorize mutation of GitHub state.

- **Scope:** `git diff HEAD~2..HEAD`
- **Audit contract:** untracked `BRIEF.md`; the T28 README and five reference files at
  `gridwork-infra@0d22c39`; `identity/security.md`; and
  `07-CICD-PIPELINES-AND-OIDC.md`
- **Threat-register provenance:** this correction has no separate `PLAN.md`
  `<threat_model>`, no `SUMMARY.md` `## Threat Flags`, and no supplied audit `<config>`.
  The sources above are therefore the complete declared register.
- **ASVS posture:** L2-equivalent, following the GridWork security floor.
- **Implementation files:** read-only. This audit modified nothing.

## Verdict

| Classification                      | Count |
| ----------------------------------- | ----: |
| Closed threats                      | 11/13 |
| Open code threats                   |  2/13 |
| Unregistered flags                  |     0 |
| External deployment-readiness holds |     1 |

## Threat verification

| Threat ID | Category                                               | Disposition | Status              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------ | ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T28-C01   | Command injection                                      | mitigate    | CLOSED              | All four workflow `run:` bodies contain zero GitHub `${{ }}` expressions; representative post-auth data routing is `.github/workflows/deploy-staging.yml:190-216,283-301`, `.github/workflows/deploy-production.yml:270-329,595-620`, `.github/workflows/publish-image.yml:331-378`, `.github/workflows/rollback.yml:243-279`.                                                                           |
| T28-C02   | Runner output/environment injection                    | mitigate    | CLOSED              | `deploy/manifest.ts:92-100` rejects CR/LF in every script output; `.github/workflows/publish-image.yml:404-420` emits compact JSON; `.github/workflows/deploy-production.yml:344-407` produces bounded single-line canary environment data.                                                                                                                                                              |
| T28-C03   | Path traversal                                         | mitigate    | CLOSED              | `deploy/manifest.ts:3-6,8-26,49-59` constrains service keys and repository paths; publish filesystem paths consume the validated service key at `.github/workflows/publish-image.yml:331-378`.                                                                                                                                                                                                           |
| T28-C04   | Rollback command/option injection                      | mitigate    | CLOSED              | Auth precedes the necessary Cloud Run lookup but no mutation precedes validation at `.github/workflows/rollback.yml:119-164`; `deploy/validate-rollback.ts:31-69` validates service, revision, projects, and region before `Bun.spawnSync(["gcloud", ...arguments_])`; raw inputs are preserved at `deploy/validate-rollback.ts:74-112`.                                                                 |
| T28-C05   | Receipt bypass/timing oracle                           | mitigate    | CLOSED              | Production maps the receipt through `env:` and verifies it before auth at `.github/workflows/deploy-production.yml:114-135,260-264`; `deploy/verify-receipt.ts:45-78` enforces the 32-character secret floor, preserves whitespace, SHA-256 prehashes both variable-length values, and uses `timingSafeEqual`; discriminating tests are at `deploy/verify-receipt.test.ts:27-58`.                        |
| T28-C06   | Credential exposure before validation                  | mitigate    | CLOSED              | Repository-variable guards run before credentials in staging (`.github/workflows/deploy-staging.yml:49-108`), production (`.github/workflows/deploy-production.yml:81-135,176-264`), publish (`.github/workflows/publish-image.yml:140-226`), and rollback (`.github/workflows/rollback.yml:75-123`). Production also validates manifest and staging provenance before auth.                             |
| T28-C07   | Unlocked dependency resolution                         | mitigate    | CLOSED              | Caisson has a root `bun.lock`; every job that runs a deploy TypeScript entrypoint performs `bun install --frozen-lockfile`, including `.github/workflows/publish-image.yml:92-114,172-182`, `.github/workflows/deploy-staging.yml:77-87`, `.github/workflows/deploy-production.yml:137-147`, and `.github/workflows/rollback.yml:105-117`. The duplicate install was removed from `deploy/gates.sh:1-6`. |
| T28-C08   | Registry token exfiltration                            | mitigate    | CLOSED              | The publisher creates no credential file and validates the `.pkg.dev` login host against the registry prefix before `docker/login-action` receives the access token at `.github/workflows/publish-image.yml:217-261`.                                                                                                                                                                                    |
| T28-C09   | Unproved promotion/rollback target                     | mitigate    | CLOSED              | Production downloads and subset-compares staging evidence before auth at `.github/workflows/deploy-production.yml:201-258`; rollback requires a fixed-string, whole-line evidence match before traffic mutation at `.github/workflows/rollback.yml:166-222,267-279`.                                                                                                                                     |
| T28-C10   | Rollout recovery                                       | mitigate    | **OPEN — BLOCKER**  | First-deploy services are omitted at `.github/workflows/deploy-production.yml:286-308`, while restore processes only recorded rows at `:569-591`.                                                                                                                                                                                                                                                        |
| T28-C11   | Origin/Access bypass verification                      | mitigate    | **OPEN — BLOCKER**  | `.github/workflows/deploy-staging.yml:235-253` and `deploy/smoke.ts:310-343,405-431` exercise only authenticated public-host positive paths.                                                                                                                                                                                                                                                             |
| T28-A01   | Operator gate is possession, not four-eyes             | accept      | CLOSED — documented | The limitation is explicitly documented at `deploy/verify-receipt.ts:17-21` and `.github/workflows/deploy-production.yml:129-130`.                                                                                                                                                                                                                                                                       |
| T28-A02   | Cross-run evidence is unsigned/operator-error evidence | accept      | CLOSED — documented | The actual strength and same-write-authority limitation are documented at `.github/workflows/deploy-production.yml:223-229` and `.github/workflows/rollback.yml:166-175`.                                                                                                                                                                                                                                |

No threat has disposition `transfer`.

## Open threats

### T28-C10 / BL-02 — failed rollout can strand first-deploy traffic

- **Severity:** BLOCKER
- **Category:** rollout recovery / availability
- **Exploit path:** production rollback-state collection treats a missing service as a
  legitimate first deploy and omits it from `rollback-revisions.txt`
  (`.github/workflows/deploy-production.yml:286-308`). The rollout nevertheless deploys
  and shifts every planned service (`:312-329,485-516`). If observation or post-deploy
  smoke then fails, restoration iterates only recorded rows (`:569-591`). A new service
  has no row, is never restored, and the handler can finish without a restore-failure
  alarm while that service remains shifted.
- **Required fix:** production must fail closed before mutation if any planned service
  lacks a serving revision. Initial service creation should use a separately reviewed
  bootstrap path with an explicit compensator. Add new-only and mixed existing/new
  failure-path tests proving no planned service can be omitted from restoration and a
  failed compensator produces a non-zero/alarmed result.
- **Status:** OPEN.

### T28-C11 / BL-01 — staging does not exercise either negative bypass leg

- **Severity:** BLOCKER
- **Category:** origin/Access boundary verification
- **Exploit path:** the step named “origin + Access bypass suite” supplies Access
  credentials and invokes `MODE=staging` only against public hostnames
  (`.github/workflows/deploy-staging.yml:235-253`). Non-canary smoke selects public
  targets, requires credentials, and always attaches them
  (`deploy/smoke.ts:310-343,405-431`). It never requests an Access-protected public
  hostname without credentials and never requests a raw `run.app` origin without the
  origin header. Either denial boundary can regress while staging remains green and
  production promotion proceeds.
- **Required fix:** after staging deployment, resolve and strictly validate each
  service's actual `https://…run.app` URL; assert the raw origin without the origin header
  is rejected; assert each Access-protected public hostname without Access headers is
  rejected; retain the existing authenticated public positive path. Add tests that
  mutation-check both negative legs.
- **Status:** OPEN.

The shared runtime origin gate itself remains fail-closed
(`packages/kernel/src/origin-gate.ts:37-103`); the open threat is the missing deployment
verification promised by the pipeline.

## Closed exploit paths

### GitHub expression-to-shell command injection

**Severity if regressed:** BLOCKER

**Exploit path:** a dispatcher supplies duplicate-key JSON containing `$(payload)`;
`JSON.parse` validates the clean last value, while a raw GitHub expression pastes the
original string into an unquoted heredoc after cloud authentication.

**Mitigation found:** all values enter shell steps through step-level `env:` mappings.
No `${{ }}` expression occurs in any `run:` body. JSON artifacts are constructed with
`jq --arg`/`--argjson`, not heredocs.

**Required fix if regressed:** remove every GitHub expression from the affected `run:`
body, map the value through `env:`, and consume it as a quoted shell variable. Quoting
the heredoc delimiter alone is insufficient.

### Workflow output and path injection

**Severity if regressed:** BLOCKER

**Exploit path:** CR/LF creates forged `$GITHUB_OUTPUT` keys, or an unsafe service key
escapes `digests/$SERVICE` and `image-manifest-$SERVICE.json`.

**Mitigation found:** the shared `output()` function rejects CR/LF; service keys use
`^[a-z][a-z0-9-]{0,62}$`; compact `jq -c` is used for control-plane values.

**Required fix if regressed:** restore the shared single-line output guard and the
service-key schema before any workflow filesystem or output use.

### Rollback input injection

**Severity if regressed:** BLOCKER

**Exploit path:** a free-text revision reaches `gcloud` after WIF auth, or validation
approves a trimmed value while the workflow mutates traffic using the raw input.

**Mitigation found:** the raw service/revision are preserved; service ownership and
revision syntax are checked before the `gcloud` runner; the runner uses an argv array;
the described revision must exactly equal the submitted revision.

**Required fix if regressed:** validate the exact consumed bytes before spawn, retain
the strict service/revision regexes, and continue using an argv array.

### Receipt bypass or disclosure

**Severity if regressed:** BLOCKER

**Exploit path:** an unset or weak production receipt is accepted, whitespace is
normalized away, a direct comparison leaks length information, or an error logs secret
material.

**Mitigation found:** the expected secret must be at least 32 characters; neither side
is trimmed; both are SHA-256 prehashed and compared with `timingSafeEqual`; no path emits
either value.

**Required fix if regressed:** restore the minimum, exact-byte comparison, prehash, and
no-output guarantees before production auth.

## External deployment-readiness holds

This is not an exploitable fail-open state. It blocks ready/merge/deploy and requires
separately authorized operator action.

### HOLD-01 — `PROD_DEPLOY_RECEIPT` is absent

- **Severity:** DEPLOYMENT-READINESS BLOCKER; code-audit severity: none
- **Observed state:** the read-only GitHub metadata check found no
  `PROD_DEPLOY_RECEIPT` secret name on the production environment.
- **Exploit path:** none. `deploy/verify-receipt.ts:70-74` exits before
  `google-github-actions/auth` at `.github/workflows/deploy-production.yml:260-264`.
- **Required fix:** an authorized operator must provision a receipt of at least 32
  characters in the production environment and preserve the approved operator-side
  source. Do not print, commit, or otherwise expose the value.

The Wave-3 freeze remains independently binding: PR #448 stays draft, no workflow is
dispatched, and no production readiness claim is valid until T34a and the required
Railway origin-secret provisioning are complete (`deploy/README.md:39-52`).

## Origin-secret variable confirmation

All four public services use the shared kernel loader and therefore the same names:

| Service           | Boot-path evidence                    | `origin_secret_mode` | `origin_secret_current` | `origin_secret_next` |
| ----------------- | ------------------------------------- | -------------------- | ----------------------- | -------------------- |
| `caisson-site`    | `apps/site/proxy.ts:44-55`            | `ORIGIN_SECRET_MODE` | `ORIGIN_SECRET`         | `ORIGIN_SECRET_NEXT` |
| `caisson-admin`   | `apps/admin/src/proxy.ts:108-117`     | `ORIGIN_SECRET_MODE` | `ORIGIN_SECRET`         | `ORIGIN_SECRET_NEXT` |
| `caisson-license` | `services/license/src/app.ts:568-624` | `ORIGIN_SECRET_MODE` | `ORIGIN_SECRET`         | `ORIGIN_SECRET_NEXT` |
| `caisson-docs`    | `services/docs/src/app.ts:90-129`     | `ORIGIN_SECRET_MODE` | `ORIGIN_SECRET`         | `ORIGIN_SECRET_NEXT` |

The actual environment reads are centralized at
`packages/kernel/src/origin-gate.ts:29-35,47-53`. `caisson-demos` is deliberately excluded:
it has no public hostname and is IAM-only behind the site proxy.

## Re-adoption checklist coverage

| Item | Result                                                                                                                                         |
| ---: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | CLOSED — all five files match `gridwork-infra@0d22c39` byte-for-byte.                                                                          |
|    2 | CLOSED — no repository-local workflow-body adaptation.                                                                                         |
|    3 | CLOSED — shared output guard rejects CR/LF; direct workflow writers emit compact single-line values.                                           |
|    4 | CLOSED — service keys are strictly schema-bound before path use.                                                                               |
|    5 | CLOSED — staging passes and validates explicit `MODE=staging`.                                                                                 |
|    6 | CLOSED — rollback smoke requires and selects only `$SERVICE`.                                                                                  |
|    7 | CLOSED — revision validation precedes the argv-array `gcloud` spawn.                                                                           |
|    8 | CLOSED — rollback validation consumes the raw service/revision bytes.                                                                          |
|    9 | CLOSED — publish emits compact valid JSON; no tolerance/reparse workaround was found.                                                          |
|   10 | N/A — no repository runbook, script, or `gh workflow run` invocation dispatches these workflows.                                               |
|   11 | N/A — no saved hold preset exists. The workflow itself enforces 30–900 seconds.                                                                |
|   12 | N/A — no downstream repository reader consumes the renamed artifacts.                                                                          |
|   13 | N/A — no downstream repository reader consumes the changed evidence shapes.                                                                    |
|   14 | CLOSED — `CANARY_URLS` is consumed with `JSON.parse`, not line splitting.                                                                      |
|   15 | CLOSED in code — registry host and registry prefix must match before token delivery.                                                           |
|   16 | N/A — there is no publish→staging workflow-call site; staging is manual/reusable. A future caller must explicitly pass/inherit Access secrets. |
|   17 | CLOSED — unset/short, trailing-whitespace mismatch, and exact-match receipt tests are runnable and green.                                      |
|   18 | CLOSED — the workflow owns the one conditional frozen install; `gates.sh` no longer duplicates it.                                             |
|   19 | REACHED, EXTERNAL HOLD — `PROD_DEPLOY_RECEIPT` is absent. Seeding was prohibited and not attempted.                                            |
|   20 | CLOSED — fresh read-only metadata confirms all ten required repository-variable names are present.                                             |

No checklist item was silently skipped. Items 10–13 and 16 are not applicable for the
reasons above; item 19 was deliberately not executed because the audit forbids secret
handling and external mutation.

## Template provenance

| File                                      | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `.github/workflows/deploy-production.yml` | `0b54a22bb969485f55fad4fe13aea175629ae09d182cd55915fe3dc9eea9ac44` |
| `.github/workflows/deploy-staging.yml`    | `49fed94b414533113363f60fc8654cf3adeb41ea04ee3fd57cbb6fb7dcd5068b` |
| `.github/workflows/publish-image.yml`     | `ea528b8fbb5c80f3711630e66a0b4dce7e4c6ed4c0c722870f9a6363a387ed07` |
| `.github/workflows/rollback.yml`          | `443c645cddabf41f432843ce0ef4cc471643a7359f7027ff0dd2130850e3174d` |
| `deploy/verify-receipt.ts`                | `03848e92d73c2208af01f4cb18e882c08feb40ee06c0f6522407c6dddd04b1b4` |

Each hash equals its corresponding source under
`gridwork-infra/docs/t28-app-pipeline/` at `0d22c39`.

## Verification evidence

- `bun test deploy`: **111 pass, 0 fail**
- Supplied phase evidence: `bash deploy/gates.sh` exit 0; Turbo **120/120**;
  focused deploy suite **37/37**
- `git diff --check HEAD~2..HEAD`: pass
- `bash -n deploy/gates.sh deploy/prepare-build.sh`: pass
- GitHub-expression scan inside all `run:` bodies: **0 matches**
- Unpinned third-party `uses:` scan: **0 matches**
- Secret-signature scan of the scoped diff: **0 matches**
- `actionlint`: unavailable locally; the four workflows remain byte-identical to the
  corrected reviewed upstream templates.

## Unregistered flags

None. No `SUMMARY.md` threat flags exist for this correction, and the scoped
implementation introduced no attack surface lacking a mapping above.

## OPEN_THREATS

**Phase:** T28 — application pipeline correction

**Closed:** 11/13 | **Open:** 2/13

**ASVS Level:** 2-equivalent

| Threat ID | Category               | Mitigation Expected                                                                 | Files Searched                                                                    |
| --------- | ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| T28-C10   | Rollout recovery       | Every planned service must have a verified restoration path before traffic mutation | `.github/workflows/deploy-production.yml`                                         |
| T28-C11   | Origin/Access boundary | Staging must test unauthenticated Access denial and raw-origin denial               | `.github/workflows/deploy-staging.yml`, `deploy/smoke.ts`, `deploy/smoke.test.ts` |

**External Holds:** 1 — fail-closed production receipt prerequisite

Next: correct both mitigations in the upstream T28 template, re-copy all five owned files,
rerun the security audit, and keep PR #448 draft.
