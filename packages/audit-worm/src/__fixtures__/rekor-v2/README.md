# Rekor v2 hermetic verify fixtures

Committed pins that let `verifyExternal`'s `externally-transparent` (Rekor) path verify with **zero
live TUF/Rekor fetch** (spike decision #4). First `__fixtures__` dir in `@caisson-sh/audit-worm`.

| File                  | What                                                                                           | Source                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `golden-entry.json`   | A real `TransparencyLogEntry` captured from a live ed25519ph submit (R1 de-risk).              | `POST log2025-1.rekor.sigstore.dev/api/v2/log/entries`, 2026-07-17 (public entry). |
| `trusted_root.json`   | The Sigstore public-good `trusted_root.json` — carries **all** log keys incl. inactive shards. | `sigstore/root-signing` `targets/trusted_root.json`.                               |
| `signing_config.json` | A caisson SigningConfig with `log2025-1` prepended — the **submit** path's write-URL source.   | Authored; mirrors the rekor-tiles README snippet.                                  |

## What the golden entry attests

A throwaway test Ed25519 key (seed = `sha512("caisson-r1-derisk-throwaway-ed25519-seed")[:32]`) signed
sample anchor bytes `{"length":42,"tipHash":"aaa…","genesisHash":"bbb…"}` (hashes only, zero PII) via
`ed25519ph`; `digest = SHA-512(anchorBytes)`, `keyDetails = PKIX_ED25519_PH`. `logIndex 27980982`,
`log2025-1.rekor.sigstore.dev`. The offline verify checks the checkpoint signature against the
receipt-embedded log key (from `trusted_root.json`), the RFC-6962 inclusion proof, and
`leaf.data.digest == SHA-512(anchorBytes)`.

## Refresh cadence

**Stored-receipt verify is freshness-independent by design** (spike decision #2): the receipt embeds the
checkpoint-signing key + origin, and `verifyExternal` verifies the checkpoint **signature** without
enforcing TUF timestamp freshness — a years-old-but-valid checkpoint still verifies after its shard
retires. So a stale `trusted_root.json` here does **not** break stored-receipt verify; it only matters
when capturing a **new** golden entry (a new shard's key must be present). Refreshed on the
pinned-registry sweep cadence, not on a clock.
