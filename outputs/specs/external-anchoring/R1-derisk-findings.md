# R1 de-risk findings — ed25519ph interop + @sigstore-on-Bun + golden capture

- **Status:** COMPLETE (2026-07-17) · gates Fork R-β + the R2/R4/R5 build.
- **Method:** a live one-shot round-trip + offline verify, Bun 1.3.14, scratch project.
  Durable deliverables: the committed fixtures under
  `packages/audit-worm/src/__fixtures__/rekor-v2/` (golden entry + trusted_root + signing_config).

## Verdicts

### (a) ed25519ph interop from JS/Bun against the live public v2 instance → **YES**

- `@noble/curves@2.2.0` `ed25519ph` (imported as `@noble/curves/ed25519.js`) signs on Bun; self
  round-trip verify passes; 64-byte signature.
- A live `HashedRekordRequestV002` (`keyDetails: PKIX_ED25519_PH`, `digest = base64(SHA-512(anchorBytes))`,
  `signature.content = base64(ed25519ph(seed, anchorBytes))`, `verifier.publicKey.rawBytes = base64(DER
SPKI)`) `POST`ed to `log2025-1.rekor.sigstore.dev/api/v2/log/entries` returned **HTTP 201** with a
  full `TransparencyLogEntry` (logIndex `27980982`). ed25519ph over the same seed is accepted by the
  live log — **no ECDSA-P256 fallback needed** (the ADR-0346 documented fallback stays unused).
- The server canonicalizes `data.algorithm: SHA2_512` and stores the exact submitted digest —
  confirmed in `canonicalizedBody`.

### (b) Offline verify (the R5 hand-roll algorithm) → **PROVEN end-to-end, zero network**

Against the captured golden entry + pinned `trusted_root.json`:

1. **Checkpoint (C2SP signed note):** the log's Ed25519 key (from trusted_root, `keyDetails
PKIX_ED25519`) verifies the note signature. The signed text is the **body lines only**
   (`origin\ntreeSize\nbase64(rootHash)\n`) — **NOT** including the blank separator line before the
   `— name sig` block (a load-bearing gotcha: including the blank newline fails the signature).
   The note keyhash = `SHA-256(name ‖ 0x0A ‖ 0x01 ‖ pubkey)[:4]` matched.
2. **Inclusion proof (RFC-6962 §2.1.1):** `leafHash = SHA-256(0x00 ‖ canonicalizedBody)`, audit path
   over `hashes[]` + top-level `logIndex` + checkpoint `treeSize` reconstructs the checkpoint
   `rootHash`. **VERIFIED** (18-hash path).
3. **Digest binding:** `canonicalizedBody.spec.hashedRekordV002.data.digest == SHA-512(anchorBytes)`.

### (c) `@sigstore/sign` / `@sigstore/verify` on Bun → import OK, but **NOT usable for this design**

- Both **import** cleanly on Bun (`@sigstore/sign@5.0.0`, `@sigstore/verify@4.1.0` — note: 4.1.0, not
  the PLAN's 3.1.x).
- **`@sigstore/sign` exposes no v2 self-managed-key submit at the package surface.** Public exports are
  Fulcio-keyless bundle builders (`DSSEBundleBuilder`, `MessageSignatureBundleBuilder`, `FulcioSigner`,
  `RekorWitness`); `TLogV2Client` is an internal `dist/` class, not exported. Using it would mean
  reaching into unstable internals of a Fulcio-oriented package.
- **`@sigstore/verify` exports only TUF-rooted bundle verification** (`Verifier`, `toTrustMaterial`,
  `toSignedEntity`). Its value is exactly the TUF trust-root machinery our **self-contained receipt**
  design deliberately discards (spike decision #2 — verify against the receipt-embedded key, no TUF
  freshness). What's left after removing TUF is the RFC-6962 + signed-note verify, which is ~90 lines.

## Fork R-β resolution → **HAND-ROLL** (record for the ADR)

The evidence resolves Fork R-β to the hand-rolled path, and it is the _lower_-complexity choice here,
not a fallback:

- No exported `@sigstore/sign` v2 submit for a self-managed key; the hand-rolled JSON `POST` is a few
  lines and uses `@noble/curves` (already needed for the ed25519ph signer, R2).
- `@sigstore/verify`'s bundle+TUF surface is the opposite of the self-contained-receipt design; pulling
  a Node-targeted dependency tree onto Bun to use ~90 lines of it (minus the TUF part we don't want) is
  net negative for a **sold** package's supply-chain surface.
- The hand-roll is **proven working** end-to-end in this de-risk (submit + offline verify both pass).

`@sigstore/*` are therefore **not** added as `@caisson/audit-worm` dependencies. `@noble/curves` +
`@noble/hashes` (transitive) are the only new crypto deps.
