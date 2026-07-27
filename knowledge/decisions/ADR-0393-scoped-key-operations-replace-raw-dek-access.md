# ADR-0393 — Scoped key operations replace raw DEK access on `FieldCryptoContext`

- **Date:** 2026-07-27
- **Status:** Accepted (operator lock at the deriveKey fork picker)
- **Supersedes in part:** ADR-0392 (decision 5 — the narrowed "context-owned" guarantee and its
  explicit deferral of this change; the rest of ADR-0392 stands unchanged)
- **Parent:** ADR-0387 (Azure Key Vault production backing, no resident plaintext-DEK cache) ·
  ADR-0043 (per-tenant keys and the no-remigration invariant) · ADR-0002 (engineering invariants)

## Context

ADR-0392 decision 5 recorded, but did not close, a fork the T8 review rounds opened:
`FieldCryptoContext.deriveKey(keyVersion)` **returned** a plaintext DEK. Two independent reviewers
raised it, and neither of their proposed fixes was safe as first stated — one would have let a
caller zero the context's cached source mid-request, the other would have broken any context that
legitimately caches.

Because the buffer was returned, the context could only ever guarantee that _context-owned_
plaintext died at request exit. Worse, residency was unbounded in **row count**: every `deriveKey`
call allocated a tracked copy retained until `dispose()`, so a request decrypting N rows held N live
DEK copies. That is a real cost for a package sold on provenance and compliance grounds.

The operator's pick at the fork picker was to make the strong claim true now rather than narrow it
permanently. The timing argument was decisive: `@caisson/field-crypto` is at **0.3.5** (pre-1.0, so
this is a minor bump, not a major) and commerce is still sandbox with no production Paddle catalog,
so there are **zero live external consumers**. The cost of this change will never be lower.

## Decisions

### 1. `deriveKey` is replaced by `withKey`, which lends rather than returns

```ts
withKey<T>(keyVersion: number, use: (key: Buffer) => T): T;
```

The context owns the buffer passed to `use` and zeroizes it as soon as `use` returns **or throws**.
The call stays synchronous, so the Drizzle `toDriver`/`fromDriver` hot path is unaffected.

### 2. Sequential operations no longer accumulate working copies; prefetched sources stay request-scoped

Stated exactly, because an earlier draft of this decision was headed "residency is bounded by ONE
OPERATION" and that is false in two ways worth naming:

- **Nested lends.** Re-entrant `withKey` holds one copy per active invocation, not one overall.
- **Prefetched sources.** A `kmsContext` unwraps every version 1..current and holds them as
  plaintext for the whole request by design (ADR-0389); they are erased at `dispose()`. A tenant at
  v12 therefore has 12 resident plaintext DEKs mid-request, entirely independently of lending.

What genuinely changed: the old `workingKeys` set retained every **completed** lend until dispose,
so a request decrypting N rows accumulated N live copies. That is gone. `dispose()` now erases the
prefetched sources plus any lend still executing.

That last clause is load-bearing. A lend whose callback is mid-flight has not reached its `finally`,
so self-wiping completed lends is not sufficient — a callback that disposes the context (directly or
by triggering the abort) and keeps running would otherwise hold live plaintext past disposal. The
context tracks only ACTIVE lends for this, which is not a return to `workingKeys`: entries are
removed in `finally`, so the set never grows with row count. And because dispose zeroizes that lend
underneath a still-running callback, anything computed afterwards ran against an all-zero key — so
`withKey` refuses to return a result produced across a disposal rather than hand back ciphertext
that may be encrypted under a publicly known key.

This narrows, rather than closes, the unbounded-residency point in ADR-0392 decision 5: the
row-count dimension is closed; the rotation-depth dimension is inherent to prefetch-all.

### 3. The generic operations no longer wipe what they are lent — the lender does

`sealField`, `openField`, `encryptField`, and `decryptField` previously each took a defensive copy
and zeroed it. They no longer touch the key's lifetime at all; the context that lends decides. This
removes the hazard that made both originally-proposed fixes unsafe: an operation can no longer zero
a context-owned cached buffer, and a caching context can no longer be corrupted by its consumers.
The invariant `column.test.ts` and `encrypt-field.test.ts` pin ("generic operations never mutate a
context-owned cached key") now holds **by construction** instead of by every call site copying first.

### 4. What this does and does not guarantee — stated exactly

**It does:** eliminate escape by default. There is no longer an API that returns key bytes for a
caller to keep, and every lend is zeroized at operation exit.

**It does not:** make escape impossible. A `use` callback that deliberately copies the bytes out
(`Buffer.from(key)`, a string, another typed array) still escapes, and **no JavaScript API can
prevent that**. The defensible claim is therefore _"the context never returns key material, and
every key it lends is zeroized when the operation using it returns"_ — not _"no plaintext can
survive the request"_.

This distinction is recorded deliberately. The precise failure mode of the four T8 review rounds was
a stated property outrunning what the code delivered; the fix for that is not a stronger sentence.

### 5. Two fail-closed guards, because the misuse direction got worse

Both were added after the security-audit lane on this change; each converts a silent failure into a
loud one, and neither existed before because the old returning API failed differently.

**All-zero key on the derived path.** `derivedContext` zeroizes what `deriveKey` returns, in place.
A provider that violates the ownership contract by returning a CACHED buffer therefore has its cache
wiped by the first operation, and every later write would encrypt under an all-zero key — which
round-trips successfully, so the tenant stores data under a publicly known key with every check
green. An all-zero HKDF output is otherwise a 2^-256 event, so it is treated as impossible and
throws. The contract is the real guarantee (provider.ts OWNERSHIP now names `deriveKey` explicitly,
which it previously did not while `derivedContext` depended on it); this is the loud backstop.

**Thenable `use` callback.** `withKey<T>` cannot constrain `T`, so an `async` callback typechecks.
It returns at its first `await`, the key is zeroized, and the continuation encrypts under all
zeroes. Note the direction changed: the old returning API produced a residency LEAK for this same
misuse — correct crypto, key alive too long — whereas the lend produces valid-looking ciphertext
under a known key. Strictly worse, so `withKey` throws on a thenable result. Iterables are
deliberately NOT rejected; an array return from a synchronous callback is legitimate.

## Consequences

- **Breaking** for any implementer of `FieldCryptoContext` and any caller of `deriveKey`. At the
  time of the lock the blast radius is exactly: four internal call sites, two context
  implementations, field-crypto's own tests, and one test in `@caisson/ai-kit`. No non-test
  consumer outside the package existed.
- `FieldKeyProvider.deriveKey` / `SyncFieldKeyProvider.deriveKey` are a **different seam** and are
  unchanged: those hand keys to the context, which is the request-scoped boundary being closed here.
- Buyer-facing copy that describes zeroization must name operation exit for the generic operations
  and request exit for context disposal; conflating the two is what ADR-0392 had to correct once
  already.
- A future async cryptographic-operation seam (context performs the AEAD itself) remains possible
  but was NOT taken: it would force every custom-context implementer to supply cipher operations
  rather than a key, a much heavier interface for a marginal gain over the lend boundary.
