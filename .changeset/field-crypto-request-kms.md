---
"@caisson/field-crypto": minor
"@caisson/ai-kit": minor
"@caisson/agent-trajectory": minor
"@caisson/site": patch
---

Add disposable request-scoped KMS contexts with append-only Postgres wrapped-key persistence,
wire production BYOK to purge-protected Azure Key Vault keys, and let MCP run tools bind an async
field-crypto context and its tenant executor in one atomic transaction without retaining plaintext
keys between requests.

BREAKING for direct API consumers, carried as a minor bump because these packages are pre-1.0:

- `RunToolsDeps.keyProvider` (a `SyncFieldKeyProvider`) is REMOVED from `buildRunTools` and
  replaced by a required `fieldCryptoContext` runner. Callers passing a key provider no longer
  compile.
- `WrappedKeyStore` gains a required `putWrappedIfAbsent` member, so any external implementation
  of that interface must add it.

Also bounds request-context prefetch with a new `maxPrefetchVersions` option (default 64), so a
tenant whose rotation depth exceeds what the request budget can serve fails with an error naming
that depth instead of an anonymous deadline timeout; accepts AWS multi-Region `mrk-` key
identifiers and reports replica-pending deletion without inventing a deletion date; requires an
explicit Azure service principal rather than resolving an ambient credential chain; and erases key
material returned by a provider call that completes after its deadline already elapsed.
