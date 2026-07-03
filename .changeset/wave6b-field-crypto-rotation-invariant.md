---
"@caisson/field-crypto": patch
---

Documented and test-hardened the key-rotation contract for encrypted fields: rotating a
tenant's key version never requires re-encrypting existing data. Every stored value already
carries the key version it was written under, so old rows keep decrypting under their original
key while new writes pick up the current one automatically. Added an explicit test proving the
rotated key is actually different key material (not just a different version label) and a
doc comment spelling out the no-remigration guarantee for anyone implementing a custom key
provider.
