---
"@caisson/field-crypto": minor
---

Breaking: `FieldCryptoContext.deriveKey(version)` is replaced by `withKey(version, use)`. The context now lends a key buffer for one operation and zeroizes it when that operation returns or throws, instead of returning a buffer the caller retains until request exit. Plaintext residency drops from one retained copy per row to a single lend at a time, and the generic seal/open/encrypt/decrypt helpers no longer wipe what they are lent, so a caching context can no longer be corrupted by its consumers. Implementers of the interface and direct callers must migrate; `FieldKeyProvider.deriveKey` is a different seam and is unchanged.
