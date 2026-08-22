---
phase: t28-app-pipeline-correction
project: caisson
branch: feat/cloudrun-prereqs
base: a6ff996b3b090656b8b85d971af1ec5db1d3fd8c
reviewed_commit: 989004cfa9c95b9fd675190dae717cdd3ac85bfe
reviewer: gw-security-auditor
created: 2026-08-21
verdict: PASS
---

# SECURITY — T28 application pipeline correction

Security audit of commits `eff030f370bafc0c5a8a9a9ae033a22edac9ce92` and
`989004cfa9c95b9fd675190dae717cdd3ac85bfe`.

The scoped code is **SECURED**: all declared code mitigations are present, with no
security blocker or unregistered attack surface found. Deployment readiness remains
**HOLD** because two required GitHub settings are absent. Both conditions fail closed;
they are external prerequisites, not code-audit failures or authorization to mutate
GitHub state.

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
| Closed mitigations                  |    11 |
| Documented accepted risks           |     2 |
| Open code threats                   |     0 |
| Unregistered flags                  |     0 |
| External deployment-readiness holds |     2 |

## Threat verification

| Threat ID | Category                                               | Disposition | Status              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ------------------------------------------------------ | ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T28-C01   | Command injection                                      | mitigate    | CLOSED              | All four workflow `run:` bodies contain zero GitHub `${{ }}` expressions; representative post-auth data routing is `.github/workflows/deploy-staging.yml:190-216,283-301`, `.github/workflows/deploy-production.yml:270-329,595-620`, `.github/workflows/publish-image.yml:331-378`, `.github/workflows/rollback.yml:243-279`.                                                                                         |
| T28-C02   | Runner output/environment injection                    | mitigate    | CLOSED              | `deploy/manifest.ts:92-100` rejects CR/LF in every script output; `.github/workflows/publish-image.yml:404-420` emits compact JSON; `.github/workflows/deploy-production.yml:344-407` produces bounded single-line canary environment data.                                                                                                                                                                            |
| T28-C03   | Path traversal                                         | mitigate    | CLOSED              | `deploy/manifest.ts:3-6,8-26,49-59` constrains service keys and repository paths; publish filesystem paths consume the validated service key at `.github/workflows/publish-image.yml:331-378`.                                                                                                                                                                                                                         |
| T28-C04   | Rollback command/option injection                      | mitigate    | CLOSED              | Auth precedes the necessary Cloud Run lookup but no mutation precedes validation at `.github/workflows/rollback.yml:119-164`; `deploy/validate-rollback.ts:31-69` validates service, revision, projects, and region before `Bun.spawnSync(["gcloud", ...arguments_])`; raw inputs are preserved at `deploy/validate-rollback.ts:74-112`.                                                                               |
| T28-C05   | Receipt bypass/timing oracle                           | mitigate    | CLOSED              | Production maps the receipt through `env:` and verifies it before auth at `.github/workflows/deploy-production.yml:114-135,260-264`; `deploy/verify-receipt.ts:45-78` enforces the 32-character secret floor, preserves whitespace, SHA-256 prehashes both variable-length values, and uses `timingSafeEqual`; discriminating tests are at `deploy/verify-receipt.test.ts:27-58`.                                      |
| T28-C06   | Credential exposure before validation                  | mitigate    | CLOSED              | Repository-variable guards run before credentials in staging (`.github/workflows/deploy-staging.yml:49-108`), production (`.github/workflows/deploy-production.yml:81-135,176-264`), publish (`.github/workflows/publish-image.yml:140-226`), and rollback (`.github/workflows/rollback.yml:75-123`). Production also validates manifest and staging provenance before auth.                                           |
| T28-C07   | Unlocked dependency resolution                         | mitigate    | CLOSED              | Caisson has a root `bun.lock`; every job that runs a deploy TypeScript entrypoint performs `bun install --frozen-lockfile`, including `.github/workflows/publish-image.yml:92-114,172-182`, `.github/workflows/deploy-staging.yml:77-87`, `.github/workflows/deploy-production.yml:137-147`, and `.github/workflows/rollback.yml:105-117`. The duplicate install was removed from `deploy/gates.sh:1-6`.               |
| T28-C08   | Registry token exfiltration                            | mitigate    | CLOSED              | The publisher creates no credential file and validates the `.pkg.dev` login host against the registry prefix before `docker/login-action` receives the access token at `.github/workflows/publish-image.yml:217-261`.                                                                                                                                                                                                  |
| T28-C09   | Unproved promotion/rollback target                     | mitigate    | CLOSED              | Production downloads and subset-compares staging evidence before auth at `.github/workflows/deploy-production.yml:201-258`; rollback requires a fixed-string, whole-line evidence match before traffic mutation at `.github/workflows/rollback.yml:166-222,267-279`.                                                                                                                                                   |
| T28-C10   | Rollout stranded at partial traffic                    | mitigate    | CLOSED              | Hold input is digit- and range-bounded before auth at `.github/workflows/deploy-production.yml:149-190`; progression is 5/25/100 with observations at `:485-516`; failed or cancelled runs restore recorded traffic and alarm separately on restore failure at `:539-593`.                                                                                                                                             |
| T28-C11   | Origin-secret leakage/fail-open origin                 | mitigate    | CLOSED              | Canary URLs are restricted to normalized HTTPS `*.run.app` origins and secrets are required per protected target at `deploy/smoke.ts:186-245,273-317`; credentials are attached only at `:320-343`. The shared origin gate is armed by default, accepts only the exact development/test opt-out, validates canonical secrets, and compares them with `timingSafeEqual` at `packages/kernel/src/origin-gate.ts:37-103`. |
| T28-A01   | Operator gate is possession, not four-eyes             | accept      | CLOSED — documented | The limitation is explicitly documented at `deploy/verify-receipt.ts:17-21` and `.github/workflows/deploy-production.yml:129-130`.                                                                                                                                                                                                                                                                                     |
| T28-A02   | Cross-run evidence is unsigned/operator-error evidence | accept      | CLOSED — documented | The actual strength and same-write-authority limitation are documented at `.github/workflows/deploy-production.yml:223-229` and `.github/workflows/rollback.yml:166-175`.                                                                                                                                                                                                                                              |

No threat has disposition `transfer`.

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

These are not exploitable fail-open states. They block ready/merge/deploy and require
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

### HOLD-02 — `GCP_WIF_PROVIDER` is absent

- **Severity:** DEPLOYMENT-READINESS BLOCKER; code-audit severity: none
- **Observed state:** the read-only GitHub metadata check found no repository variable
  named `GCP_WIF_PROVIDER`.
- **Exploit path:** none. The first-step non-empty guards fail before WIF authentication:
  `.github/workflows/publish-image.yml:148-164`,
  `.github/workflows/deploy-staging.yml:52-69`,
  `.github/workflows/deploy-production.yml:89-106`, and
  `.github/workflows/rollback.yml:79-97`.
- **Required fix:** an authorized operator must set the reviewed WIF provider identifier.
  This audit does not authorize changing repository metadata.

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
|   20 | REACHED, EXTERNAL HOLD — repository-variable state was checked; `GCP_WIF_PROVIDER` is absent and the workflows fail closed.                    |

No checklist item was silently skipped. Items 10–14 and 16 are not applicable for the
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

## SECURED

**Phase:** T28 — application pipeline correction

**Threats Closed:** 13/13

**ASVS Level:** 2-equivalent

**Open Code Threats:** 0

**External Holds:** 2 — fail-closed deployment prerequisites
