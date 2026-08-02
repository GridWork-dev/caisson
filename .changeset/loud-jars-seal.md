---
"@caisson/field-crypto": minor
"@caisson/signing-primitive": minor
"@caisson/testing": patch
"@caisson/site": patch
---

Both crypto packages gain a browser-safe `./browser` entry point, so the same primitives the server
runs can now run inside a client bundle, a Cloudflare Worker, or any other WebCrypto-only runtime.

field-crypto's browser entry carries per-tenant HKDF key derivation, AES-256-GCM seal and open, the
row-bound additional-authenticated-data tuple, and the self-describing envelope codec, working over
`Uint8Array` and WebCrypto instead of Buffer and the Node crypto module. It is the same wire format,
not a parallel one: a value sealed in a browser opens under the server's `decryptField`, a value
written by `encryptField` opens in a browser, and both directions are pinned byte-for-byte against
the shipped fixtures. The new names sit alongside the existing ones rather than replacing them —
`deriveTenantKeyAsync`, `aesGcmSealAsync`, `aesGcmOpenAsync`, `buildAadBytes`,
`serializeEnvelopeBytes`, `parseEnvelopeBytes`, plus `nextKeyVersion` and `MAX_KEY_VERSION` for the
rotation bound the key-version registry already enforced. One behavior note: parsing an envelope
accepts both standard and URL-safe base64, preserving values the previous Node decoder could read;
whitespace is still tolerated and malformed values fail closed. The public seal operation always
generates its own fresh nonce, matching the Node cipher without exposing a caller override.

signing-primitive's browser entry carries the verify half: the signable-payload construction,
`verifyEvidenceSignature`, and the RFC-3161 test-double authority, so a relying party can check an
evidence pack's provenance entirely in their own browser. Nothing about the signature scheme
changed — the browser path runs the very same Ed25519 primitive the signer does, because that
primitive never needed Node in the first place. The signing identity stays off the browser entry
deliberately: a tenant seed does not belong in a bundle end users download. Two additions on both
entries: `hexToBytes` for decoding a signature or key, and
`timestampCountersignsSignatureAsync`, the WebCrypto twin of the existing timestamp check, which
keeps its synchronous form and uses a fixed-work digest comparison without importing Node crypto.

Both packages now declare a Node 20.12 minimum, and every export the main entry offered before is
still there with the same name and shape. The site's field-crypto and signing-primitive interactive
demos now run those shipped packages directly instead of hand-maintained copies of them, and the
shared test harness gained a scan for Node-only globals to go with its existing module-graph walk.
