---
id: p0-license-token-cred-incident
title: "P0 — rotate the production license issuer keypair, purge real prod-signed tokens from fixtures + demo, and rotate the three transit-leaked operator credentials"
tags: [security, secrets, external-system]
status: spec
source: audit-v2 (ADR-0233)
---

# SPEC — P0 license-token + operator-credential incident

## Goal (WHAT + WHY)

Eliminate every real production-signed license token and every transit-leaked
operator credential from the repo + launch surface before the `caisson-oss`
public npm flip (residue item #4), by rotating the Ed25519 issuer keypair
(ADR-0226 Fork 1), replacing golden/demo tokens with dev-keypair-signed ones,
and rotating the three leaked-now credentials — so that no committed artifact
grants a real paid entitlement and no leaked credential remains valid at the
public flip. **This wave is a HARD BLOCKER on the caisson-oss public flip +
the first `confirm=publish` npm dispatch (ADR-0222).**

## Context

The audit-v2 sweep (ADR-0233) surfaced five `severity: high` `status: open`
findings that together constitute a live entitlement + credential incident,
independent of launch timing:

- Two REAL perpetual production-signed license tokens are committed as test
  fixtures / demo data: an **all-editions pro** token in
  `packages/license-verify/src/__golden__/prod-signed-token.json` (which ships
  verbatim in the public `@caisson-sh/license-verify` npm tarball — the mirror
  scans `packages/*`), and a **local-ai** token hardcoded in
  `apps/local-ai/app/demo/pipeline.ts:81-82`.
- The existing `_note` in `prod-signed-token.json` claims the token is
  "public-safe — the detached Ed25519 signature reveals nothing about the
  private key." That framing is cryptographically correct but **misses the
  actual threat**: a real perpetual entitlement token is itself the leak —
  any consumer of `verifyLicense()` (the kernel license gate, the registry
  Worker, any buyer-side edition) will resolve it to the paid tier for free,
  forever. There is no revocation list in offline Ed25519 verify
  (`packages/license-verify/src/verify.ts:71-76`); rotating the baked public
  key is the only way to invalidate the committed tokens.
- Three operator credentials transited a chat session / transcript and were
  never confirmed rotated: `OPENROUTER_API_KEY`, `DISCORD_TOKEN`,
  `MIRROR_PUSH_TOKEN` (`docs/state/opportunity-backlog.md:17-18`,
  `docs/state/launch-runbook.md:74`, ADR-0226 Context).

The locked posture already covers this: **ADR-0226 Fork 1 = (a) regenerate a
fresh launch Ed25519 keypair** (zero prod licenses issued today, so blast
radius is nil and full rotation provenance starts from license #1); **Fork 4 =
(c) on-incident-only rotation** — and these three credentials are an incident.
This SPEC executes the agent-buildable + runbook halves of that lock; it does
not re-open any fork.

The `verify.ts` shape already supports the fix: `verifyLicense()` pins the
baked prod key (the gate-trusted entrypoint); `verifyLicenseWithKey()` takes
an explicit key for tests + advanced self-hosting. The deterministic DEV
keypair (seed `caisson-license-verify-KAT-seed-v1`, reconstructed in
`verify.test.ts:26-30` + `token.test.ts`) already signs the non-prod golden
`signed-token.json`. The work is to RETIRE the prod-signed golden + demo paths,
not to build a new key-injection seam.

## Findings covered

| id               | severity | file                                                                                        | disposition                                                                |
| ---------------- | -------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 04f5d216dc57001b | high     | `packages/license-verify/src/__golden__/prod-signed-token.json`                             | fixed-by-this-spec                                                         |
| 6739eb0cb3ec5999 | high     | `packages/license-verify/src/__golden__/prod-signed-token.json` (public-npm-tarball vector) | fixed-by-this-spec                                                         |
| d89a6162e4006627 | high     | `apps/local-ai/app/demo/pipeline.ts:81-82`                                                  | fixed-by-this-spec                                                         |
| 4460dfca4bc7f51b | high     | `docs/state/opportunity-backlog.md:18` (OPENROUTER/DISCORD/MIRROR_PUSH transit)             | fixed-by-this-spec (runbook + verify gate; operator executes the rotation) |
| 47b2f47252ec3335 | high     | `docs/state/launch-runbook.md:74` (same three credentials)                                  | fixed-by-this-spec (same runbook; same rotation)                           |

No finding is reclassified as noise. The `04f5`/`6739` "_note" framing
(cryptographically true, wrong threat model) is called out under
Reconcile-needed below — the fix is correct either way.

## Approach

### Task 1 — rotate the production Ed25519 issuer keypair (operator + agent)

Per ADR-0226 Fork 1 + `infra/license-issuer/ISSUER_PUBLIC_KEY.md` "Rotation".

- **Operator-only (value handling):** mint a fresh Ed25519 keypair; write the
  private half to `~/.gridwork/caisson.env` as `CAISSON_LICENSE_SIGNING_KEY`
  (PKCS8 DER, base64); set `LICENSE_ISSUE_TOKEN` to a fresh bearer in the same
  act (the sweep rotates them together); mirror both into the `Caisson Launch`
  1Password vault (title === name, ADR-0226 Fork 3). Revoke the OLD signing
  key from `~/.gridwork/env` once the new one is live.
- **Agent-buildable (no secret handled):** after the operator confirms the new
  keypair is in env, update the baked public half in TWO places in one commit:
  (1) `packages/license-verify/src/verify.ts` `LICENSE_PUBLIC_KEY_SPKI_B64`
  (currently fingerprint `0ae7d2abb886ca3d`, the old key); (2) the registry
  Worker's baked verify key (`registry/worker/` — the offline-Ed25519
  entitlement filter, ADR-0106), so no window opens where the issuer signs
  under a key the edge cannot verify. Write the new fingerprint into
  `infra/license-issuer/ISSUER_PUBLIC_KEY.md` (the public-half doc — non-secret,
  safe to commit). Redeploy `services/license` + the registry Worker.
- **Root cause:** the old key signed real entitlement tokens that are now
  committed in the repo; rotating the key is the only way to invalidate them
  (offline verify has no revocation list). This is the load-bearing fix —
  tasks 2-4 are defense-in-depth + the credential incident.

### Task 2 — replace prod-signed golden + demo tokens with dev-keypair-signed ones

- **`packages/license-verify/src/__golden__/prod-signed-token.json`:** DELETE.
  The "the baked production key verifies a real prod-signed token" test at
  `verify.test.ts:90-95+` is the ONLY consumer; it is now meaningless (the
  keypair rotated; a fresh prod-signed token would require the operator to
  mint one and re-commit it — recreating the leak). Replace that test with a
  `verifyLicenseWithKey(devToken, devPublicKey)` assertion that already
  exists as the pattern for the other tests in the same file. The verify
  LOGIC is fully covered by the dev-keypair tests; the prod key is exercised
  LIVE by `services/license` integration tests + the live issuer, not by a
  committed prod-signed token.
- **`apps/local-ai/app/demo/pipeline.ts:81-86,341-343`:** the `PRO_TOKEN`
  constant is a real prod-signed local-ai entitlement, and the demo calls
  `verifyLicense(PRO_TOKEN)` (the prod-key entrypoint). After task 1, the
  rotated prod key makes that token correctly fail-safe to community —
  breaking the demo's "valid → pro" leg. Fix: switch the demo to the dev
  keypair — mint a DEV-signed token from the deterministic seed
  (`caisson-license-verify-KAT-seed-v1`, same reconstruction as
  `verify.test.ts:26-30`) at module load, import `verifyLicenseWithKey`
  alongside `verifyLicense`, and verify the dev token with the dev public
  key. The demo still proves valid→pro / tampered→community / absent→community
  (ADR-0044 exit gate) without ever holding prod-signed material. Mark the
  seed + the `verifyLicenseWithKey` call with a `ponytail:` comment naming
  the invariant: dev keypair only, prod key never exercised here.
- **Root cause:** the `_note` in the golden fixture and the `PRO_TOKEN` comment
  both framed a real prod-signed token as "public-safe," conflating
  private-key secrecy with entitlement validity. The invariant after this
  task: NO prod-signed token is ever committed; only dev-keypair-signed
  tokens appear in fixtures and demos.

### Task 3 — secret-scan gate on `__golden__/` + `app/demo/` paths

Defense-in-depth so a future contributor cannot re-introduce a prod-signed
token under those paths (or any path that ships in the public mirror).

- Add a grep-based guard in `scripts/export-public-mirror.ts` that FAILS
  LOUDLY (nonzero exit, mirroring the existing self-containment gate) if any
  file in the mirror out-dir matches the committed-token shape
  (`CAISSON-PRO-` prefix followed by a base64url payload+signature) —
  catches a re-introduction before the tarball is published. Extend the
  existing `EXCLUDE_TEST_FILES` / fail-loud pattern; do not add a new tool.
- Add a CI / pre-commit secret-scan gate (repo-relative, not mirror-only)
  on `packages/*/src/__golden__/` + `apps/*/app/demo/` that rejects any file
  containing a `CAISSON-PRO-<base64>` token string. The dev-keypair tokens
  are exempt — they verify against the dev key, not the baked prod key, so
  they are not entitlements. ponytail: a `grep -R` over two directory globs
  is the whole gate; no pattern DB, no semgrep rule.

### Task 4 — operator-credential rotation runbook (OPENROUTER / DISCORD / MIRROR_PUSH)

The SPEC documents the runbook; the operator executes (value handling). No
secret value appears here or in any spawned artifact.

- **`OPENROUTER_API_KEY`** (env, `services/support-bot` RAG + memory
  embeddings): mint a fresh key with a per-model spend cap; write to
  `~/.gridwork/caisson.env` + vault; revoke the chat-leaked key. Probe:
  `services/support-bot` `/healthz` green + a memory-embed call succeeds.
- **`DISCORD_TOKEN`** (env, `services/support-bot` bot login): mint a fresh
  bot token with minimal gateway intents; write to env + vault; revoke the
  chat-leaked token. Probe: bot shows Online in the guild.
- **`MIRROR_PUSH_TOKEN`** (GH secret, `.github/workflows/mirror-sync.yml`):
  mint a fresh fine-grained PAT scoped `contents:write` on
  `caisson-sh/caisson-oss` ONLY; write to the repo GH secret; revoke the
  transcript-leaked PAT. Probe: `mirror-sync` workflow_dispatch → green
  force-push.
- Record the rotation dates + the new credential scopes in
  `docs/state/launch-runbook.md` P5 row (the existing P5 finding) and the
  opportunity-backlog §"residue (3)" line, so the docs stop describing the
  credentials as un-rotated.
- **Relates:** `NPM_TOKEN` → granular `@caisson-sh`-scoped automation token
  (ADR-0222) is a separate rotation tracked under the pre-launch sweep SPEC
  (`outputs/specs/pre-launch-credential-sweep/SPEC-pre-launch-credential-sweep.md`)
  — it gates the same public flip but is NOT one of the three audit findings;
  listed here only so the operator can batch the value-handling session.

### Task 5 — sequencing gate

This wave is the documented hard blocker on the caisson-oss public flip
(residue item #4) and the first `confirm=publish` npm dispatch. Record the
gate in `docs/state/opportunity-backlog.md` §"residue" and
`docs/state/launch-runbook.md`: the public flip MAY NOT proceed until (1)
task 1's keypair rotation is live (Worker + license service redeployed), (2)
task 2's golden/demo replacements are merged, (3) task 3's scan gate is green
on a fresh mirror export, and (4) task 4's three rotations are confirmed
(probes green, old credentials revoked).

## Verify (goal-backward)

Re-ask the goal, not the task list: **is every real prod-signed token gone
from the repo + mirror, is the issuer keypair rotated, and are the three
leaked credentials confirmed rotated before the public flip?**

- `grep -rn 'CAISSON-PRO-' packages/ apps/ --include='*.ts' --include='*.json'`
  (excluding `node_modules` / `.next` / `.claude/worktrees`) returns ZERO
  hits — no prod-signed token string anywhere in source.
- `ls packages/license-verify/src/__golden__/prod-signed-token.json` → does
  not exist.
- `bun test packages/license-verify/src` green with the prod-signed golden
  DELETED and the replaced `verifyLicenseWithKey` test in place; the baked
  `LICENSE_PUBLIC_KEY_SPKI_B64` fingerprint in `verify.ts` is the NEW key
  (not `0ae7d2abb886ca3d`).
- `bun test apps/local-ai/app/demo` (or `bun run --cwd apps/local-ai test`)
  green — the demo's valid→pro leg passes on a DEV-signed token via
  `verifyLicenseWithKey`, never on a prod-signed one.
- `bun run scripts/export-public-mirror.ts --out mirror-out --generated-at <date>`
  succeeds; the new grep guard exits zero (no `CAISSON-PRO-<base64>` token
  in any mirror file); `mirror-out/packages/license-verify/src/__golden__/`
  contains NO prod-signed token.
- The secret-scan gate on `packages/*/src/__golden__/` + `apps/*/app/demo/`
  exits zero.
- `infra/license-issuer/ISSUER_PUBLIC_KEY.md` records the NEW public key +
  fingerprint + rotation date.
- Operator confirms (Linear CAISSON-issue or signed-off runbook edit):
  `OPENROUTER_API_KEY`, `DISCORD_TOKEN`, `MIRROR_PUSH_TOKEN` — old revoked,
  new scoped values live, three probes green; `services/license` + registry
  Worker redeployed on the new signing key.

## Reconcile-needed

- **The `04f5`/`6739` `_note` framing** (`prod-signed-token.json:4`,
  `pipeline.ts:78-80`) dismisses the leak on the grounds that "the detached
  Ed25519 signature reveals nothing about the private key." That is true and
  irrelevant: the threat is the **entitlement**, not the private key. The
  fix (rotate keypair + dev-key fixtures) is correct under either framing,
  but the operator should confirm the threat model so the new `_note` /
  comments state the right invariant: "no prod-signed token is ever committed,
  because a real entitlement token is itself the leak — not the private key."
  No code change blocks on this; it is a documentation-framing reconciliation.

## Non-goals

- **Holding, moving, or printing any secret value** — tasks 1 + 4 are
  operator-only value-handling; the agent handles names, public keys, and
  runbook text only.
- **The remaining ~16 pre-launch sweep credentials** (Linear / Resend /
  Turnstile / Grafana / CF / Railway / Paddle-prod / DB / AWS prover / etc.)
  — those live under the pre-launch sweep SPEC
  (`outputs/specs/pre-launch-credential-sweep/SPEC-pre-launch-credential-sweep.md`,
  ADR-0226) and rotate on the same operator session, not under this SPEC.
- **`NPM_TOKEN` scope-tightening** — gates the same flip, tracked under the
  pre-launch sweep SPEC; batched into the operator session, not a finding here.
- **A revocation list / deny-list in `verifyLicense()`** — out of scope;
  offline Ed25519 verify is the locked contract (ADR-0010), and rotating the
  baked key is the sanctioned invalidation path (ISSUER_PUBLIC_KEY.md
  "Rotation"). A deny-list would be a new ADR.
- **CAISSON-14 KMS rider** — separate SPEC under the pre-launch sweep
  (`§5`); unblocks the AWS prover live-proof, unrelated to the token leak.

## Out-of-scope (adjacent findings with other homes)

- The broader open-core license-split hygiene (registry-schema product-ids,
  Apache vs commercial boundary) — `tooling/standards-gate`, not this SPEC.
- The Paddle SANDBOX→production commerce flip — `launch-runbook.md` §2,
  operator-gated DEPLOY act, not a security incident.
- `services/license` issuer hardening beyond the keypair rotation — the
  Stage-2 / Strix remediation waves (ADR-0204) own that surface.

## Effort / value

**Effort:** keypair rotation = operator session + one coordinated redeploy
(agent-buildable: two baked-key edits + one doc update) · golden/demo
replacement = **S** (agent, dev keypair already exists) · scan gate = **XS**
(agent, grep guard in `export-public-mirror.ts` + one CI check) · credential
rotation = operator session (three provider-side rotations + probes).
**Value:** **CRITICAL** — closes a live all-editions entitlement leak in the
public npm tarball + two repo-internal perpetual entitlement tokens + three
transit-leaked operator credentials, and unblocks (gates) the caisson-oss
public flip.
