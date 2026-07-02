# ADR-0201 — Live transports go live: prove all three against real infra

**Status:** accepted · 2026-07-01 (editions-go-live session, operator picker — 4 questions, all locked).
**Supersedes the defer clause of ADR-0184** (live transports "leave all three stubbed / no build") — the
adapter code itself was never in question and is unchanged in design. Relates **ADR-0054/0051** (WORM
store + retention mode), **ADR-0064** (local-ai backends), **ADR-0059/0160** (ai-kit gateway +
drivers), **ADR-0182/0198** (BYOK $0 vs platform metered), **ADR-0171** (AWS account precedent).
Append-only; supersede with a later ADR, never edit. **Tags:** `infra`, `external-system`, `security`.

## Context

ADR-0184 (same-day, edition seam-completion) deferred proving the three fully-implemented live
transports — S3 WORM Object-Lock (`audit-worm`), hosted/rented inference (`local-ai` + the `ai-kit`
platform lane), on-device ONNX (`local-ai`) — as a pure spend/operational decision. The editions-go-live
kickoff reopened it: the two flagship editions sell capabilities that have never run against real
infra, and the Compliance stub blocks a real sale. Fresh research also surfaced a **live-only defect**
the stubs could never catch: `ai-kit`'s `openrouter`/`local`/`ollama` provider cases use
`createOpenAI` + `baseURL`, and since AI SDK v5 that provider defaults to the **Responses API** — live
registry-resolved calls would POST to `{baseURL}/responses` (beta on OpenRouter, absent on Ollama)
instead of `/chat/completions`. Provider research: AWS S3 is the only S3-compatible store passing both
adapter invariants (per-object Object Lock API + `If-None-Match` conditional writes; Cohasset-assessed
for SEC 17a-4(f)/FINRA 4511(c)/CFTC 1.31); Cloudflare R2 has no Object Lock API, Backblaze B2 501s on
`If-None-Match`, Wasabi's conditional writes are unverified, MinIO community is unmaintained AGPL.

## Decision

**Prove all three transports against real infra this session** (operator lock, diverging from the
kickoff's lean S3-only recommendation):

1. **S3 WORM — AWS S3, provisioned THIS session (DEPLOY-class act explicitly operator-authorized).**
   Bucket `caisson-worm` (us-east-1, Object Lock enabled at creation, versioning implied), provisioned
   by the idempotent `infra/worm/provision.ts` script with a lifecycle reaper on the live-proof
   prefix. The live proof runs in **GOVERNANCE mode with a minutes-long `RetainUntilDate`**: duplicate
   `IfNoneMatch:'*'` PUT → 412 → `ArtifactExistsError`; unversioned DELETE leaves the locked version;
   versioned DELETE without bypass → denied; cleanup via `x-amz-bypass-governance-retention`.
   **COMPLIANCE mode is never live-tested by default** (irreversible objects; the ADR-0051 typed
   opt-in + production gate stands). A scoped prover IAM policy (PutObject, GetObject, Get/PutObjectRetention,
   plus BypassGovernanceRetention on the proof prefix only) is documented in the provisioner; prover
   creds stay separate from product creds.
2. **Hosted (non-BYOK) inference — OpenRouter, both lanes.** One org `OPENROUTER_API_KEY`
   (`https://openrouter.ai/api/v1`, Bearer). The `ai-kit` platform lane's `openrouter`/`local`/
   `ollama` provider cases move to **`@ai-sdk/openai-compatible`** (explicit chat-completions;
   fixes the Responses-API default). `local-ai` gains **`createOpenRouterRentedTransport`** mapping
   the existing `RentedTransport` port to `/embeddings` + `/chat/completions` (usage → the metered
   sink; egress-guarded like every rented call; response re-validated `.strict()`). Per-customer
   sub-keys via OpenRouter's provisioning API (USD spend limits) are the documented ToS-safe resale
   pattern — documented, not built now. Platform-key calls stay fully metered (ADR-0198: BYOK $0 is
   per-action allowlisted; this lane is not BYOK).
3. **On-device ONNX — availability-gated proof; the dep stays out of the tree.**
   `@huggingface/transformers` remains an optional peer (deliberately uninstalled, non-literal dynamic
   import per ADR-0064/0184); pin guidance **≥ 4.2.0** (the `env.fetch` injection point the backend
   codes against merged 2026-02-21; official Bun support; ~270 MB native deps are why it never enters
   `package.json`). The live test skips unless the module is importable AND the env opt-in is set.

**Live-test convention (all three):** live tests live in a per-package `live/` directory OUTSIDE the
default `bun test ./src` path, run via a `test:live` script, and additionally self-skip
(`test.skipIf`) without their creds/module — so the default suite, CI (secret-free runners), and the
published tarball (src-exported packages, no `files` allowlist) never see or run them. This follows
the repo's availability-probe precedent (oscal-cli `skipIf`, ADR-0180) rather than inventing an
env-flag-in-src pattern.

## Rejected

- **Keep all deferred (reaffirm ADR-0184)** — leaves the flagship Compliance WORM claim proven only
  by fake-send unit tests while the site sells it live self-serve; the operator elected to close the
  gap now that the cost is one bucket + one org key + three gated tests.
- **Backblaze B2 / R2 / Wasabi / MinIO for WORM** — each fails a hard invariant today (no Object Lock
  API; 501 on conditional writes; unverified; unmaintained AGPL). Revisit only with a live 412 probe.
- **`@openrouter/ai-sdk-provider` for the gateway** — its AI-SDK-v5 line is frozen at 1.5.4 (2.x
  targets SDK v6); `@ai-sdk/openai-compatible` stays on the maintained SDK-v5 family and also fixes
  the `local`/`ollama` cases.
- **Installing `@huggingface/transformers` as a dev dependency** — ~270 MB of native onnxruntime/sharp
  weight on every `bun install` for a path CI must never execute anyway.

## Consequences

- `packages/audit-worm`, `packages/ai-kit`, `packages/local-ai` each gain a `live/` proof + a
  `test:live` script; `ai-kit` swaps three provider cases to `@ai-sdk/openai-compatible` (new dep,
  manifest mirrored); `local-ai` gains the OpenRouter rented transport.
- `infra/worm/provision.ts` + the bucket become part of the operator's infra surface;
  `docs/build-state.md:256-261` is reconciled from "un-exercised by design" to "proven live"
  per transport once each proof passes.
- The un-exercised-seam honesty framing of ADR-0184 is retired for the proven transports; any FUTURE
  transport keeps the same rule: no live call in the default suite, DI seams stay the CI path.
