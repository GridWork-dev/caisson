---
"@caisson/field-crypto": minor
---

Breaking: `FieldCryptoContext.deriveKey(version)` is replaced by `withKey(version, use)`. The context now lends a key buffer for one operation and zeroizes it when that operation returns or throws, instead of returning a buffer the caller retains until request exit. Sequential operations no longer accumulate working copies; nested calls hold one copy per active invocation, and a KMS context's prefetched key versions remain resident for the request as before. Callbacks must be synchronous — a promise-returning callback is now a type error and is also refused at runtime, because the key is wiped before the continuation would run.

Also breaking for implementers of `SyncFieldKeyProvider`: `deriveKey()` must return fresh, caller-owned material. The signature is unchanged, but the derived context now zeroizes what it returns in place, so a provider that returns a cached buffer has that cache wiped by the first operation. Previously only `keyFor()` carried this requirement. A provider that violates it is rejected with an all-zero-key error rather than silently encrypting under a known key; KMS providers returning an all-zero DEK are rejected at bind for the same reason.

Direct callers and context implementers must migrate. `FieldKeyProvider.keyFor` is unchanged.
