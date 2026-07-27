# ADR-0392 — The prefetch-all KMS context's real costs, and a bounded prefetch depth

- **Date:** 2026-07-27
- **Status:** Accepted (operator lock at the T8 review-remediation picker)
- **Supersedes in part:** ADR-0389 (decisions 1 and 3 — the stated bind cost and the
  "provision on first seal" property; the design itself is unchanged and still stands)
- **Parent:** ADR-0387 (Azure Key Vault production backing, no resident plaintext-DEK cache) ·
  ADR-0043 (per-tenant keys and the no-remigration invariant) · ADR-0055 (crypto-shred)

## Context

Three independent reviews of the T8 implementation at `415c9a13` — an in-session code review, a
security audit, and an adversarial Codex pass — agreed the ADR-0389 design is the right one and
that the no-remigration invariant genuinely holds. They also found, in three places, that
**ADR-0389 describes something the code does not do**. ADR-0389 is the artifact the operator
locked, so a divergence between it and the shipped behavior is a defect in the record, not a
detail to leave in a comment.

The operator's pick at the remediation picker was to bring the record to the truth and bound the
one cost that has no natural limit, rather than redesign a boundary that is otherwise correct.

## Decisions

### 1. The recorded bind cost was understated; the real unit is provider round trips, not "one unwrap"

ADR-0389 §1 says a bind costs "one current-version read plus one KMS unwrap per version." In the
shipped hosted wiring each version actually costs **two Azure round trips** — `field-crypto-kms.ts`
performs a `getKey` purge-protection re-check before every `unwrapKey` and builds a fresh
`CryptographyClient` for each — **plus two database statements**, because the budgeted transaction
helper prepends a `set_config` to every statement.

The design is unchanged. The record now states the true cost, because every downstream latency
estimate built on ADR-0389's number was off by roughly 2x.

### 2. Prefetch depth is capped, and exceeding it is a named error

Rotation depth and per-request latency are directly coupled: every bind pays for the tenant's whole
rotation history. The key-version format permits 65535 versions, but a 15s request budget cannot
serve anywhere near that. Uncapped, a deep tenant fails as an anonymous deadline timeout.

`KmsContextOptions.maxPrefetchVersions` (default **64**, exported as
`KMS_CONTEXT_MAX_PREFETCH_VERSIONS`) bounds it. A tenant past the cap gets an error naming its
depth and the limit. Raising the default requires evidence that the request budget still holds.

This is a **latent** limit today, not an active one: `provision()` is the only version-advancing
path and it has no scheduled caller, so production tenants sit at version 1. The cap exists so that
wiring rotation later surfaces the cost as a diagnosis instead of an outage.

### 3. Provisioning happens at context bind, including on reads — not "on first seal"

ADR-0389 §3 claims "an account that never stores a secret never allocates field-key state." The
code calls `ensureProvisioned` unconditionally before binding the context, and it must: `kmsContext`
reads `currentVersion()` first, which throws for an unprovisioned tenant. Any caller of the seam —
including read-only ones — therefore allocates an Azure RSA KEK and a wrapped-DEK row.

The stated property holds today only because BYOK submit is currently the sole caller. The record
now says what the code does. Gating provisioning behind an explicit read-only mode was considered
and deferred: no read-only caller exists yet, and adding the flag now would be speculative.

### 4. Crypto-shred is selective ACROSS tenants, never WITHIN one

Because a context prefetches every historical version, destroying a scope's KEK means every
subsequent bind fails: the tenant can no longer read **or write** any encrypted field, and
re-provisioning stays blocked for the provider's purge-protection retention window.

Other tenants are unaffected — that part of the "selective" claim was always true. But
`kms.ts` described the shred as selective without qualification, which reads as if a tenant could
have part of their data erased and keep operating. They cannot. Shredding a tenant ends that
tenant's encrypted-field lifetime. The header is corrected; public-facing copy that already scoped
the claim to cross-tenant isolation was accurate and is unchanged.

### 5. `deriveKey` hands out tracked copies, and that residency is accepted

`kmsContext.deriveKey` returns a fresh copy per call and retains it until `dispose()`, so a request
performing N x M field operations holds N x M plaintext DEK copies until scope exit.

The obvious reduction — returning the context's canonical buffer instead — was **rejected as
unsafe**. `provider.ts` documents `keyFor` results as caller-owned with "callers overwrite it after
use"; a caller following that contract on a canonical buffer would zero the context's own key
mid-request, silently breaking every later operation in that request. The consumers' defensive copy
is correct and stays.

The retained copies are bounded by the request scope and are actively zeroed on success, failure,
and abort, so this is a memory-residency cost, not a lifetime violation of ADR-0387. It is recorded
rather than fixed. Customer-facing copy that described the zeroization more narrowly than the code
behaves is corrected to "at request exit."

## Consequences

- ADR-0389's design, its no-remigration guarantee, and its fail-closed behavior all stand unchanged.
- Latency estimates and runbook expectations must use the decision-1 cost, not ADR-0389's.
- Wiring any scheduled rotation is now a decision with a known ceiling attached, and must revisit
  the decision-2 default before it ships.
- A future read-only caller of the KMS seam must revisit decision 3 before it allocates KEKs on reads.
