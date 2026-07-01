# ADR-0162 — per-tenant encrypted BYOK (bring-your-own-key) for AI lanes

Status: accepted · 2026-07-01 · Stage-2 Stream C (task C7) · **amends ADR-0011** (provider-agnostic
config / env-pointer BYOK) for BYOK-flagged lanes; composes ADR-0043/0045/0046 (field-crypto) +
ADR-0005 (fail-closed RLS). Operator lock 2026-07-01: **build now** (the recommendation was to defer;
the operator elected to build the mechanism). Reserved range 0160–0169. Append-only; supersede, never
edit.

## Context

Today BYOK is a single deploy-time, operator-supplied pointer: a lane names `apiKeyEnv`, and
`ai-kit/providers.ts:21` reads `process.env[cfg.apiKeyEnv]` once at gateway construction (ADR-0011:
ai-config never reads the key value; one key per provider per deploy). That serves the "vendor meters
usage via credits" model. This ADR adds a **second** lane mode where each of the buyer's tenants can
supply its own provider key, encrypted at rest per-tenant — for buyers who need cost pass-through or
data-residency isolation across their tenants. field-crypto already provides 100% of the storage +
crypto primitive (per-tenant HKDF, AES-256-GCM, versioned envelope, RLS-scoped append-only key store),
so this is additive wiring, not new cryptography.

## Decisions

1. **New per-tenant encrypted key store, reusing field-crypto verbatim.** A `tenant_ai_credential`
   table keyed by `(account_id, provider, key_version)` storing the tenant's provider API key in an
   `encryptedColumn()` (`field-crypto/column.ts:108`) column, behind a FORCE-RLS tenant policy
   (`buildTenantPolicySql`, ADR-0005) with a `WITH CHECK` refusing a forged cross-tenant write. Store
   module mirrors `PgWrappedKeyStore` (`store.pg.ts:108`): append-only, idempotent insert, `ConflictError`
   on a different-bytes rewrite. No new crypto is written — HKDF derive + AES-GCM + envelope are used as
   shipped.

2. **`ProviderConfigSchema` grows a discriminated lane MODE; the default is unchanged.** A lane is
   either an **env-pointer lane** (today's `{provider, model, apiKeyEnv, baseUrl?}` — the unchanged
   default and the only mode any existing config uses) or a **per-tenant lane** (`keySource:
"tenant"`), which carries no `apiKeyEnv` (the key lives encrypted per tenant, not in env). Existing
   configs parse unchanged; BYOK is strictly additive.

3. **ADR-0011's "ai-config never reads the key" invariant is NARROWED, not broken.** ai-config still
   never reads any key value — it only carries the lane's mode. The decrypt happens at the exact same
   edge the env-read happens today: inside `providerFor`, at the `ai-kit` boundary, within `withTenant`.
   For a per-tenant lane, `providerFor` opens `withTenant(db, accountId, …)` → `openField` decrypts the
   tenant's stored key → constructs the SDK client with it, instead of reading `process.env`.

4. **`ModelResolver`/`buildRegistryResolver` grow an `accountId` parameter.** The gateway already
   threads `accountId` through `infer()`/`inferStream()` into the reserve/reconcile legs; the
   model-resolution step is the one leg that is tenant-blind today. Adding `accountId` to
   `ModelResolver = (lane, accountId?) => LanguageModelV2` lets per-tenant resolution happen; env-pointer
   lanes ignore it (backward-compatible — an absent `accountId` resolves an env-pointer lane exactly as
   before). This touches the ADR-0059 gateway contract, so it is recorded here as a bounded, additive
   signature change, not a silent edit.

5. **A short-lived per-`(accountId, provider, keyVersion)` client cache.** Deriving HKDF + decrypting +
   rebuilding an SDK client on every single inference call is wasteful; resolution caches the built
   client for a bounded TTL keyed on the tenant + provider + key-version, so a key rotation (new
   version) naturally invalidates. The cache holds built SDK clients, never raw key bytes beyond the
   client's own retention.

6. **Metering / credits are ORTHOGONAL and untouched.** BYOK changes only _where the key comes from_.
   The `ai-meter` reserve→reconcile→cap path and the `credits` debit run identically for a BYOK lane —
   metering still records usage (it is the spend-cap safety mechanism, not just billing). **Whether a
   BYOK lane should debit credits at all** (a tenant paying its own provider cost arguably shouldn't be
   charged internal credits) is a **pricebook/policy decision, explicitly out of scope here** — the
   mechanism must not prejudge it. Deferred to a pricebook ADR if/when a commercial need lands.

## Tests (golden-before-logic where a fixture pins behaviour)

Store (PGlite + real RLS): put→get round-trips a tenant's key ciphertext; a forged cross-tenant read
returns nothing (RLS); a different-bytes rewrite throws `ConflictError`; key-version bump stores a new
row. Resolution: a per-tenant lane resolves the tenant's decrypted key (test-injected write) and builds
the right adapter; an env-pointer lane still resolves from env with no `accountId`; two tenants with
different stored keys for the same provider get different clients (no cache bleed). Config: the
discriminated schema `.strict()`-accepts both modes and rejects a per-tenant lane that also names
`apiKeyEnv`. Live provider call stays the un-exercised seam (ADR-0059 zero-live-call invariant).

## Deferred (not blocking — named)

- **The buyer-facing key-submission surface** (a coach/API endpoint that encrypt-on-writes a tenant's
  key via `sealField`) — the P3-24-gated write half. C7 builds the store + read-side resolution + a
  test-injected write; the tenant UI is a follow-on slice.
- **The credit-vs-BYOK billing policy** (decision 6) — a pricebook decision, not this mechanism.
- **Key rotation UX / re-encryption on master-key roll** — field-crypto's versioned envelope already
  supports it at the primitive level; exposing a rotation flow is a follow-on.

## Binding (carried from ADR-0011/0005/0046)

The env-pointer lane remains the default and is unchanged. ai-config never reads a key value. Every
per-tenant key read/write runs inside `withTenant` under FORCE-RLS, fail-closed. Keys are stored only
as versioned AES-256-GCM envelopes under a per-tenant HKDF-derived key — never plaintext, never logged.
