# ADR-0387 — Azure Key Vault backs field-crypto; the async refactor gates the deploy

- **Date:** 2026-07-25
- **Status:** Accepted (operator-locked at the deploy-arming picker)
- **Parent:** ADR-0043 (per-tenant key derivation and the `FieldKeyProvider` port) · ADR-0046
  (self-describing envelope) · ADR-0014 (append-only wrapped-DEK store, crypto-shred) ·
  ADR-0386 (the release/deploy sequencing this now sits inside) · ADR-0380 (lane A, which shipped
  the Azure Key Vault adapter these locks depend on)

## Context

The one-SHA fleet deploy (T4) was blocked on a runbook precondition: `MASTER_FIELD_KEY` and
`FIELD_CRYPTO_SALT` on `caisson-site` have **no arming record**. The failure mode is the reason it
matters — unset, the site boots clean and passes every deploy probe, and only the first buyer's BYOK
submit throws (`apps/site/lib/byok.ts:142-147`). A deploy that omits it looks completely healthy and
fails in front of a paying customer.

Resolving that surfaced a larger question, because two key-management models are shipped and
production had never chosen between them.

## Decisions

### 1. Azure Key Vault KMS backs field-crypto in production

**Operator pick, overriding the recommendation** to keep the ADR-0043 derived env pair as the
production default.

The alternatives were the derived pair (`HKDF(ikm=MASTER_FIELD_KEY, salt=FIELD_CRYPTO_SALT)`, nothing
stored) and the KMS wrapped-DEK path (`packages/field-crypto/src/kms.ts` + `kms-azure.ts`: a
per-tenant DEK wrapped by the KMS, only the wrapped form persisted, unwrapped on read). Lane A
shipped the Azure adapter and its live test in this same wave, which is what made the choice live
rather than theoretical.

The deciding property is that the master key never sits in a Railway environment variable, and that
crypto-shred becomes an act on the KMS rather than on the store (ADR-0014).

### 2. The async refactor lands first; the deploy waits on it

**Operator pick, overriding the recommendation** to deploy on the derived pair now and run the KMS
wave before commerce opens.

This is the lock with teeth, and it exists because the first framing of decision 1 was incomplete.
`KmsKeyProvider` implements the async-only `FieldKeyProvider`. Both production consumers —
`apps/site/lib/byok.ts:137` and `packages/ai-kit/src/mcp-run-tools.ts:61` — require
`SyncFieldKeyProvider`, which only `DerivedKeyProvider` implements. **KMS in production is therefore
a code wave through the tenant-secret path, not an environment swap**, and the deploy does not
proceed until it lands.

**A sync caching shim over `KmsKeyProvider` is explicitly rejected.** Pre-provisioning tenants and
holding unwrapped DEKs in a bounded in-process cache would compile against the existing interface and
ship soonest, but resident plaintext DEKs weaken the exact property that made KMS worth choosing.
`kms.ts` states that DEK plaintext is held only transiently; a process-lifetime cache would make that
comment false. If a future change needs one, it supersedes this ADR rather than quietly relaxing it.

**Timing note, recorded because it was initially stated wrongly.** The one-way door is the first
_real buyer BYOK seal_, not this deploy — there is no rewrap helper, so switching backends after data
is sealed means re-encrypting every field. Nothing is sealed today. This lock therefore buys
ordering, not optionality: it costs deploy latency and removes the risk of ever running production on
a backend we intended to replace.

### 3. The arming act is a full pre-deploy pass, not a one-variable fix

**Operator pick, matching the recommendation.**

Every boot-blocking variable across all six runtime legs gets its presence verified and an arming
record written; the three byte-identical shared bearers (`DOCS_SERVICE_TOKEN`,
`SUPPORT_BOT_GRANT_TOKEN`, `LICENSE_ISSUE_TOKEN`) are rotated atomically — new value on **every**
holder before restarting any of them, then restart verifier-before-issuer and re-probe both sides.
Everything is recorded in the launch vault.

The justification is the finding itself: the BYOK pair reached a launch runbook with no arming
record. One gap found by reading is evidence of a class, not of a single miss.

### 4. An existing-but-unrecorded value is adopted, never regenerated

**Operator pick, matching the recommendation.**

If a variable turns out to be set on the service but absent from the arming records, the existing
value becomes canonical: copy it into the launch vault and write the record. Regenerating would give
cleaner provenance and would permanently destroy anything already sealed under the old value — and
BYOK ciphertext has no recovery path. Non-destructive wins on a surface with no undo.

## Consequences

- T4 gains a code dependency it did not have. The deploy is no longer the next act; the KMS async
  wave is. ADR-0386's "deploy and tag now" ordering is unchanged in shape — this inserts a wave
  ahead of it, and the second train after the oscal wave still follows.
- `SyncFieldKeyProvider` leaves the production path. It may remain for dev/test and for self-hosting
  buyers, who still get ADR-0043's two-variable story.
- Azure Key Vault becomes a production runtime dependency of the seal path: a vault, a key, purge
  protection, and service authentication on `caisson-site`, plus a network hop the derived provider
  never had. Failure of that hop must fail closed.
- The wrapped-DEK store needs a production home. `DbWrappedKeyStore` persists through a
  `KeyValueStore` seam; nothing wires it in production yet.

## Not decided here

- **Where the async boundary sits.** `FieldCryptoContext` (`packages/field-crypto/src/column.ts:48`)
  is the real seam: `sealField`/`unsealField` are sync pure functions over
  `{ deriveKey, currentVersion }`, bound per request via AsyncLocalStorage. Resolving DEKs
  asynchronously at _context-bind_ time keeps those two functions sync and stops the change rippling
  into every encrypted-column read — which is not the rejected cache, because the key would live only
  for the request scope. The open sub-question is the NO-REMIGRATION INVARIANT
  (`provider.ts:16`): a context must answer `deriveKey` for any past key version, and bind time does
  not know which versions a request will read. Pre-fetching every version for the tenant at bind is
  the obvious answer and is cheap while rotations are rare. **The implementing SPEC owns this; it is
  a security-boundary design choice and must not be settled in a code comment.**
- Which cloud the KMS runs in long-term. `kms-aws.ts` and `kms-gcp.ts` are shipped too; Azure is
  chosen here because lane A proved it with a live test.
- Whether `packages/ai-kit`'s MCP run tools move to the same provider or keep a separate one.
