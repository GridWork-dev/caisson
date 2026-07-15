# SPIKE — Rekor v2 (rekor-tiles) protocol, for the external-anchoring v1.1 leg

- **Status:** COMPLETE — gates the v1.1 Rekor PLAN per `SPEC.md` §"Rekor protocol spike" and ADR-0332.
- **Date:** 2026-07-13
- **Scope:** resolve, against live sources, the eight questions the SPEC/ADR-0332 CR-01 raised before any Rekor task decomposes. Product code is NOT written here — this is a findings + design-decision document.
- **Bottom line:** **GO** to decompose v1.1 — with one material correction to the SPEC's stated assumption (the existing **pure** Ed25519 tenant signer cannot submit a `hashedrekord` entry as-is; the accepted binding is **Ed25519ph**, reusing the same 32-byte tenant seed) and one mandatory pre-PLAN de-risk (a live ed25519ph submit+offline-verify round-trip against `log2025-1.rekor.sigstore.dev`, plus a Bun-runtime check of the Node-targeted `@sigstore/*` packages).

## Method + sources (all fetched live 2026-07-13)

Primary sources, in descending authority:

- **Spec:** `sigstore/architecture-docs` — `rekor-v2-spec.md`, `algorithm-registry.md`, `sigstore-public-deployment-spec.md`, `client-spec.md §4.4`.
- **Client contract:** `sigstore/rekor-tiles` — `README.md`, `CLIENTS.md`, `api/proto/rekor/v2/hashedrekord.proto`, releases (v2.3.0 DSSE-drop).
- **Wire types:** `sigstore/protobuf-specs` — `protos/sigstore_common.proto` (`PublicKeyDetails`), `protos/sigstore_rekor.proto` (`TransparencyLogEntry`, L94).
- **Trust root:** `sigstore/root-signing` — `targets/signing_config.v0.2.json`, `targets/trusted_root.json`.
- **JS client:** `sigstore/sigstore-js` — `@sigstore/sign` (`witness/tlog/client.ts` `TLogV2Client`, `external/rekor-v2`), `@sigstore/verify` 3.1.0 (`tlog/{checkpoint,merkle,hashedrekord}.ts`; PR #1535 "verification of bundles w/ rekor v2 entries"; PR #1677 DSSE-as-hashedrekord), `@sigstore/tuf`.
- **Ed25519 evidence:** `sigstore/rekor` issues #851, #1724, #2798; `sigstore-go` #520; `rekor-tiles` algorithm-registry validation port.
- **Blog:** `blog.sigstore.dev/rekor-v2-ga/` (2025-10-10, GA announcement).
- **OTS:** `opentimestamps.org`, `opentimestamps/opentimestamps-server` (`otsserver/calendar.py`), `opentimestamps/opentimestamps-client`.

In-repo cross-refs: `packages/signing-primitive/src/sign.ts` (the Ed25519 tenant signer), `SPEC.md`, `knowledge/decisions/ADR-0332-external-anchoring-locks.md`.

---

## Q1 — Rekor v2 `hashedrekord` entry contract, endpoints, and what changed vs v1

**Submission shape.** Rekor v2 exposes a **single write endpoint**: `POST /api/v2/log/entries` (HTTP) or `dev.sigstore.rekor.v2.Rekor.CreateEntry` (gRPC). The one supported request type is `HashedRekordRequestV002`:

```jsonc
// self-managed public key variant (the one relevant to caisson — no Fulcio cert)
{
  "hashedRekordRequestV002": {
    "digest": "<base64 digest of the artifact>",
    "signature": {
      "content": "<base64 signature>",
      "verifier": {
        "keyDetails": "PKIX_ECDSA_P256_SHA_256", // enum from PublicKeyDetails; see Q6
        "publicKey": { "rawBytes": "<base64 DER SubjectPublicKeyInfo>" },
      },
    },
  },
}
```

The verifier is **either** an `x509Certificate.rawBytes` (Fulcio-issued, keyless) **or** a `publicKey.rawBytes` (self-managed key) — Rekor v2 dropped PGP, minisign, pkcs7, SSH, and TUF verifiers (CLIENTS.md §"Certificate and Public Key Verifiers"). Caisson is a self-managed-key deployment (per-tenant key, no Fulcio), so the `publicKey` branch is the target.

**The digest is the raw artifact digest** the signing algorithm covers, **base64** (not hex). `data.algorithm` in the canonicalized entry is the registry hash name (`SHA2_256`, `SHA2_512`, …). Rekor v2 canonicalizes the request into a `HashedRekordLogEntryV002`, JSON-marshals it, and hashes that to get the leaf.

**Response = a `TransparencyLogEntry`** (`protobuf-specs/protos/sigstore_rekor.proto` L94) carrying: `logIndex` (top-level; int64), `logId.keyId`, `kindVersion {kind:"hashedrekord", version:"0.0.2"}`, `canonicalizedBody` (base64 of the leaf preimage), and `inclusionProof { logIndex, rootHash, treeSize, hashes[], checkpoint{envelope} }`. This is persisted directly in a Sigstore **bundle** — clients no longer transform it into a TLE.

**What changed vs v1 (the load-bearing deltas for this design):**

1. **No online proof retrieval, no search — CONFIRMED.** v2 removed the get-by-index, get-by-leaf-hash, get-by-entry, and search-by-hash/identity APIs. "Rekor no longer provides an API for online verification and search" (CLIENTS.md §"Removing Online Verification and Search"; rekor-v2-spec §"Rekor v2 does not support the search API"). The inclusion proof + checkpoint are returned **only** on upload and **must be persisted** by the client; there is no way to re-fetch a lost receipt. A separate search service is "future." → This is exactly the crash-window risk CR-02 anticipated; the SPEC's durable outbox (persist-before-egress) is the correct and necessary answer, and it is not optional.
2. **Single entry type.** Only `hashedrekord/0.0.2`. `intoto`, `rekord`, `dsse`, `jar`, `rpm`, `helm`, `cose`, `alpine`, `rfc3161` are gone. As of `rekor-tiles` v2.3.0 the DSSE type was also dropped — DSSE envelopes are now submitted **as hashedrekord** where `digest = Hash(PAE(payloadType, payload))`. Caisson anchors raw bytes, not DSSE, so this only matters as a fallback packaging (see Q6).
3. **`integratedTime` is always `0`** and `inclusionPromise`/SignedEntryTimestamp are gone — time attestation now comes from a **separate RFC-3161 TSA**, not from Rekor. (CLIENTS.md: "clients MUST use an RFC 3161 signed timestamp.")
4. **`inclusionProof.rootHash`/`treeSize`/`logIndex` inside the proof are duplicative and MUST be ignored** — read the authoritative root hash + tree size from the **verified checkpoint**; read the log index from the top-level `TransparencyLogEntry.logIndex`. `rootHash` is **no longer hex-encoded** (raw bytes).
5. **Read API is tile-based (C2SP `tlog-tiles`)** — monitors fetch tiles, not entries by index. Irrelevant to caisson unless it ever monitors.

**Public instance:** the 2025 Rekor v2 shard is `https://log2025-1.rekor.sigstore.dev`, `majorApiVersion: 2`, `validFor.start: 2025-10-06`, operator `sigstore.dev`, GA 2025-10-10, 99.5% availability SLO (README; blog `rekor-v2-ga`). **Caveat:** as of the GA post the v2 URL was **not yet distributed in the public SigningConfig** (planned "end of 2025 / early 2026") to give verifiers time to upgrade — so a client using v2 today must supply its own SigningConfig with `log2025-1` prepended (README gives the exact snippet). The URL is explicitly **not** to be hardcoded — it rotates ~every 6 months (Q4).

---

## Q2 — sigstore-js support: v2 submission + offline inclusion-proof verification

**Yes, both exist today, in the low-level building-block packages** (not the top-level `sigstore` convenience wrapper, which is Fulcio-keyless-oriented):

- **Submission — `@sigstore/sign`.** `packages/sign/src/witness/tlog/client.ts` ships a **`TLogV2Client`** (alongside the v1 `TLogClient`) whose `createEntry(createEntryRequest: CreateEntryRequest)` posts to a v2 `RekorV2` transport (`external/rekor-v2`, shipped as `dist/…/rekor-v2.js`). `CreateEntryRequest` is imported from `@sigstore/protobuf-specs/rekor/v2`. Current line: **`@sigstore/sign` 5.0.0** (Jun 2026); the v2 transport predates it (present in 4.1.x). Because `createEntry` takes a raw `CreateEntryRequest`, **caisson controls the verifier material and `keyDetails` directly** — it is not locked to the ECDSA-P256 + Fulcio path the README example shows. This is the seam caisson's `RekorAnchorLog` submits through.
- **Offline verification — `@sigstore/verify`.** Current: **3.1.0** (Dec 2025). PR #1535 ("verification of bundles w/ rekor v2 entries") landed the v2 path; the dist carries `tlog/checkpoint.js` (C2SP signed-note checkpoint verify), `tlog/merkle.js` (RFC-6962 inclusion proof), `tlog/hashedrekord.js` (leaf reconstruction), and `trust/` (matches log keys from a TrustedRoot). PR #1677 added the DSSE-as-hashedrekord verify path. This is precisely the material `verifyExternal` needs in v1.1 (Q5).
- **Trust root — `@sigstore/tuf`** (current ^4.x): embeds the public-good root, fetches/caches `trusted_root.json` + `signing_config`. See Q3.

**The honest caveats (spike-implementation risks, not blockers):**

- **Runtime:** these packages declare `engines: node ^20.17.0 || >=22.9.0` and are Node-targeted. **Caisson is Bun.** The crypto they use (WebCrypto ECDSA/Ed25519, node:crypto) is broadly Bun-compatible, but this is **unproven for these specific packages** and MUST be a spike-implementation check before the PLAN commits to them (fallback: hand-roll the ~small v2 submit + the RFC-6962 merkle/checkpoint verify, both of which are short and spec'd — the merkle verify is the same algorithm the repo already knows from `audit-chain.ts`).
- **No high-level "anchor these bytes to Rekor v2" one-liner** exists for a self-managed key — the convenience `sigstore.sign()` targets Fulcio keyless. Caisson composes `TLogV2Client.createEntry` (submit) + `@sigstore/verify` internals (verify) itself. That composition is the bulk of the "Rekor tiles client work" the SPEC's effort sketch flagged.

---

## Q3 — TUF trust-root distribution + CI-reproducible pinning (no live TUF fetch in tests)

**How clients pin/update:** `@sigstore/tuf` bootstraps from an **embedded root** (`./store/public-good-instance-root.json`), initializes a local cache, then pulls updated TUF metadata + targets (`trusted_root.json`, `signing_config`) from the mirror (`https://tuf-repo-cdn.sigstore.dev`). `getTrustedRoot()`/`initTUF()` accept:

- `rootPath` — path to the initial trust root (defaults to the embedded one). **A caller can pin its own committed root.json here.**
- `cachePath` — where metadata/targets cache.
- `forceCache: true` — **"prevents any downloads from the remote TUF repository as long as all cached metadata files are un-expired."** This is the CI-offline lever.
- `mirrorURL`, `forceInit`.

(The Go `sigstore/pkg/tuf` client mirrors this: `TUF_ROOT` env for cache dir, `SIGSTORE_NO_CACHE` for in-memory-only, and an embedded `repository/root.json` fallback — same shape.)

**CI-reproducible mechanism (name the actual files):** commit a pinned fixture set into the package's `__fixtures__/` and drive verification against it with **zero network**:

1. `trusted_root.json` — the exact `sigstore/root-signing` `targets/trusted_root.json` (contains **all** log public keys, including inactive shards — Q4). This is the _only_ file `verifyExternal`'s inclusion-proof/checkpoint check consumes; it does not need the full TUF metadata chain at verify time.
2. `signing_config.v0.2.json` (or a caisson-authored SigningConfig with `log2025-1` prepended) — needed only by the **submit** path to discover the write URL; not needed by verify.
3. A recorded **golden bundle** (a real `TransparencyLogEntry` from a prior live submission of known anchor bytes) to verify offline against (2), never re-submitting in CI.

Then either (a) call `getTrustedRoot({ rootPath: <committed root>, cachePath: <tmp>, forceCache: true })` so no fetch occurs, or (b) skip `@sigstore/tuf` entirely in tests and feed the committed `trusted_root.json` straight into the verifier — the cleaner, fully-hermetic option, and the one the sigstore-js verify tests themselves use (`packages/verify/src/__tests__/__fixtures__/trust.ts`). `@sigstore/mock` exists for mocking the live services but is unnecessary for offline-verify fixtures.

**Binding for caisson:** the pinned `trusted_root.json` is a **committed test fixture with a refresh cadence** (TUF targets expire; a stale pinned root will eventually fail an expiry check if the client enforces it — the offline-verify-of-a-stored-receipt path should verify the checkpoint **signature** against the log key without enforcing TUF timestamp freshness, since receipts outlive any root's validity window — see Q4). Ownership: this fixture lives beside `RekorAnchorLog` in `audit-worm`, refreshed on the same cadence as the pinned-registry sweep.

---

## Q4 — Rotating shards: discovery + does the client handle rotation

**Shard model changed materially from v1.** In v1, shards hid behind one URL + a global index. In v2, **shards are fully independent**: "clients must discover, via TUF, the correct shard to upload to and the correct key to verify an inclusion proof with" (rekor-v2-spec §sharding; sigstore-public-deployment-spec: "with Rekor v2 the shards are not abstracted behind a single URL so the Root-of-Trust mechanism must be used to discover rekor shard URLs"). The public instance shards **~every 6 months**; old shards go **read-only but stay readable** ("additive… old shards will be still available for reading").

**Discovery:**

- **Write:** the TUF-distributed **`SigningConfig`** (`rekorTlogUrls[]`, each with a `validFor` window + `majorApiVersion`) tells the client which shard is currently writable. The validity windows prevent writing to a shard before its TrustedRoot is fully distributed.
- **Verify:** the **`TrustedRoot`** carries **both active and inactive** shard public keys; a verifier matches the checkpoint's `logId.keyId` to the right (possibly retired) shard key.

**Does the client handle rotation?** **Yes, if you use the SigningConfig+TrustedRoot machinery** (sigstore-go/cosign/sigstore-js all do). The client does not reimplement sharding — it reads the current write URL from SigningConfig and the verify key from TrustedRoot by keyId. Caisson does **not** reimplement shard logic; it must, however:

- **Not hardcode `log2025-1…`** — read the write URL from a SigningConfig (which the buyer/deployment supplies until Sigstore distributes the v2 URL publicly).
- **Make receipts self-verifying across shard turndown.** This is the load-bearing consequence for caisson's WORM-retained receipts: a receipt persisted today is verified **years later**, after its shard has been retired. Verification needs that (now-inactive) shard's public key. Two safe options: (a) verify against a TrustedRoot that still lists the inactive shard key (Sigstore keeps them — but this depends on Sigstore's retention of ancient shards); or **(b) recommended — snapshot the log public key (or the whole checkpoint-signing key) into the persisted receipt bundle itself**, so the receipt is self-contained and does not depend on fetching a historical TrustedRoot. The C2SP checkpoint is a signed note; storing the verifying key alongside it makes the receipt verifiable forever without any live lookup — consistent with the SPEC's "the log itself is the escrow, we hold nothing" only if the _escrow's key_ travels with the receipt. **This is a design decision the spike resolves (see below), not an assumption.**

---

## Q5 — Checkpoint + offline inclusion-proof verification: the exact algorithm/material `verifyExternal` needs

**The v2 offline verification algorithm** (rekor-v2-spec §4.1 + §6.1.4; C2SP `tlog-checkpoint`, `tlog-tiles`; RFC 6962 §2.1.1):

1. **Verify the checkpoint.** The checkpoint is a **C2SP signed note**: text body = `origin` (log identity/URL) + `treeSize` + base64 `rootHash`, followed by one or more `— <keyname> <base64 sig>` signature lines. Verify the signature against the **log's public key** (from TrustedRoot, matched by keyId) **and the expected origin/server name**. (Co-signed witness signatures MAY also be present and verified against witness keys — not required at v2 launch; "clients do not need to implement verification of witness signatures initially.")
2. **Establish the leaf hash**, one of two ways (§6.1.4):
   - **Recompute (preferred):** reconstruct the canonicalized `HashedRekordLogEntryV002` from `apiVersion`+`kind`+`{digest, signature, verifier}` and hash it with the entry algorithm's externalized hash → leaf hash. (JSON-canonicalize before hashing.)
   - **Use persisted `canonicalizedBody`:** hash the stored `canonicalizedBody` bytes, but then MUST additionally confirm the entry's recorded digest == expected digest, recorded signature == expected signature byte-for-byte, and recorded verifier == expected verifier.
3. **Verify the inclusion proof** (RFC 6962 §2.1.1) using `TransparencyLogEntry.logIndex` (top-level), `inclusionProof.hashes[]`, and the **treeSize + rootHash from the verified checkpoint** (NOT the duplicated proof fields). The computed root MUST equal the checkpoint root.
4. **(time)** verify the separate **RFC-3161 timestamp** over the signature against the TSA cert for "existed at T" — Rekor v2's `integratedTime` is always 0.

**Material `verifyExternal` must hold to run this offline** (i.e., what the persisted receipt bundle must contain): `{ checkpoint (signed note), inclusionProof.hashes[] + logIndex, leaf inputs (digest + signature + verifier publicKey + keyDetails) OR canonicalizedBody, the log's checkpoint-signing public key + origin string, and (for grade timestamp) the RFC-3161 token }`. `@sigstore/verify` 3.1.0's `tlog/{checkpoint,merkle,hashedrekord}.ts` implement steps 1–3; the merkle step is the same RFC-6962 algorithm caisson already ships in `audit-chain.ts`, so a hand-rolled fallback is low-risk if Bun-compat forces it.

For caisson: `verifyExternal(accountId)` in **v1.1** = fetch the latest WORM receipt → run steps 1–3 against the receipt's checkpoint+proof → confirm the leaf's `digest` equals `SHA-*(WORM anchor bytes)` (this is the byte-match to the chain that v1 already does) → return grade `externally-transparent` only if all pass, else fail-closed. The v1 `verifyExternal` (existence + anchor-byte-match, no inclusion proof) is a strict subset and needs none of the above — confirming the SPEC's Fork E split is sound.

---

## Q6 — Ed25519 end-to-end: **the crux finding — pure Ed25519 is REJECTED; Ed25519ph is the accepted form**

This is the one place the SPEC's stated assumption does not survive contact with the protocol.

**The registry says Ed25519 is supported — but with a `hashedrekord`-specific asterisk.** `algorithm-registry.md` lists `ed25519` (sign/verify) **and** `ed25519-ph` with the note **"Recommended only for `hashedrekord`."** The `PublicKeyDetails` enum (`sigstore_common.proto`) has both `PKIX_ED25519 = 7` and `PKIX_ED25519_PH = 8`. The `rekor-tiles` server's client-signing-algorithm allowlist includes **both** `PKIX_ED25519` and `PKIX_ED25519_PH`.

**But `hashedrekord` cannot verify a _pure_ Ed25519 signature.** The reason is structural and long-documented: `hashedrekord` passes the log **only a digest**, no message. Pure Ed25519 (PureEdDSA, RFC 8032) computes its own hash over the **full message** internally and **ignores any supplied digest** — so given only a digest, verification has no message and fails. Evidence, all live:

- **rekor #851** (maintainer Hayden-IO): "ED25519 signatures are not supported with the hashedrekord type… ED25519 computes the digest as part of its algorithm, so the original artifact is needed."
- **rekor #1724:** "The hashedrekord + ed25519 edge case can be fixed by using ed25519ph."
- **rekor #2798** (2026-04, a use-case near-identical to caisson — Ed25519-signed, hash-chained decision receipts anchored to Rekor): tried `hashedrekord` with Ed25519, hit `"ed25519: invalid signature" regardless of signing approach`. Maintainer: **"Hashedrekord requires ed25519ph, the prehash variant of ed25519, since otherwise ed25519 will hash the signature input again. You can submit the hash of the PAE and the ed25519ph signature as a hashedrekord request."**
- **sigstore-go #520** ("Support other key algorithms for Rekor v2"): "fixes an incompatibility with Ed25519 and hashedrekord with Rekor v2, **which requires Ed25519ph where the digest is provided during verification**."

**What Ed25519ph means for caisson's per-tenant signer** (`packages/signing-primitive/src/sign.ts`):

The tenant signer today produces a **pure** Ed25519 signature: `Ed25519Signer.sign()` calls `ed.signAsync(payload, seed)` from **`@noble/ed25519`** — the standalone package is **PureEdDSA only** (RFC 8032 / FIPS 186-5 / ZIP215; no `ph` API). So the existing signature the tenant produces is **not submittable to `hashedrekord`**.

The fix is **not** a new key — it is a new **signing mode over the same key**:

- Ed25519ph (HashEdDSA, RFC 8032 §5.1) uses the **same 32-byte Ed25519 seed** and yields the **same public key**; it differs only in that it signs the SHA-512 **prehash** of the message with a domain-separation context. So the tenant's key material, key id, and public key all carry over unchanged — the SPEC's "bind to the existing per-tenant Ed25519 signer" intent is **preserved at the key level**.
- The **sign call** changes: `@noble/ed25519` (pure) → **`@noble/curves/ed25519`**, which exposes `ed25519ph` (and `ed25519ctx`). This is a second signing primitive alongside the existing one, ~one function, not a re-key.
- The **submission** then is: `keyDetails: PKIX_ED25519_PH`, `data.algorithm: SHA2_512`, `data.digest: base64(SHA-512(anchorBytes))`, `signature.content: base64(ed25519ph(seed, anchorBytes))`, `verifier.publicKey.rawBytes: base64(DER SPKI of the tenant Ed25519 pubkey)`.

**Binding design (what the SPEC asked the spike to describe):**

- **Key access from the anchoring job:** the scheduled handler (commercial side, per ADR-0332 Job ownership) needs the tenant's 32-byte signing seed at anchor time — the same seed `Ed25519Signer` holds in its private `#secretKey` field (ADR-0045 derivation). The clean shape is to **extend the `signing-primitive` `Signer` port with an `ed25519ph`-mode sign** (or add a sibling `signAnchor(bytes)` that internally uses `@noble/curves` ed25519ph), so the seed **never leaves** the signing primitive and the anchoring job holds only a `Signer` handle — identical containment to how `signEvidencePack` works today.
- **Signing scope:** the anchor signature covers **only the canonical anchor bytes** (`encodeAnchor()` output — hashes + counter, no PII). It is a distinct signature from the evidence-pack signature; both use the same tenant identity.
- **Failure mode if the tenant key is unavailable** (BYOK/KMS tenant whose key isn't reachable from a background job; a crypto-shredded key; a construction failure): the submission **fails closed into the outbox `failed` / operator-reconciliation state** — it MUST NOT anchor with a substitute/deployment key silently, and MUST NOT skip the tenant silently. This mirrors `sign.ts`'s fail-closed discipline. (See the open question below on whether the tenant identity key is even the right signer for this submission — the anchor's trust comes from log inclusion, not from who signed the entry.)

**Alternatives the spike weighed** (feeds the design decision, below):

1. **Reuse the tenant Ed25519 seed via ed25519ph** — one new primitive, same key, satisfies the SPEC's binding intent. Risk: ed25519ph is the **less-trodden JS path** (every sigstore-js example/fixture is ECDSA-P256), and ed25519ph interop against the **live public v2 instance** is unproven from JS specifically (proven in Go via #520 + the server allowlist). → requires the live round-trip check.
2. **Dedicated per-tenant ECDSA-P256 anchoring key** — the fully well-lit path (matches every sigstore-js fixture, no prehash subtlety). Cost: a **second** per-tenant key to provision/store/rotate purely for anchoring, contradicting the SPEC's reuse intent.
3. **DSSE-mapped-to-hashedrekord** — wrap anchor bytes in a DSSE envelope, submit `digest=Hash(PAE)`, `sig=envelope sig`. More packaging, and still needs ed25519ph for the PAE signature under an Ed25519 key. No advantage here over (1). Skip.

---

## Q7 — Public-instance rate/courtesy limits + the 2–20s latency claim

**Latency — the claim is accurate, with a precise mechanism.** Rekor v2 **blocks the upload response until a checkpoint is published whose tree size includes the new entry** (CLIENTS.md). Numbers from the sources:

- rekor-v2-spec §submission: entries are **batched** and integrated as a group; "an individual submission may have a delay of up to **10 seconds**"; "on the order of **2–10 seconds** before receiving a response."
- CLIENTS.md: **"increase request timeouts… to at least 20 seconds"**; witnessing (future) adds an estimated **<10s** more.
- So the SPEC's **"2–20s"** is a correct envelope: **2–10s typical today, budget ≥20s timeout**, up to ~+10s once witnessing is live. This is squarely why the SPEC keeps anchoring **off the hot append path** — a 2–20s blocking call near an append would be unacceptable. Confirmed sound. The `fetchWithTimeout` on this call must be set to **≥20s** (not the repo's usual shorter default), and "upload multiple entries in parallel" is the official guidance if throughput ever matters (it won't at caisson's daily-per-tenant cadence).

**Rate / courtesy limits.** No published numeric per-minute limit for the v2 public instance. What the sources establish:

- The public instance **is rate-limited**; "very high-volume build pipelines (more than a few thousand signatures per hour from a single network) can hit limits" (safeguard.sh, operating against it since 2022). Transient `502`s under load are observed (rekor #2765) and are pod-restart/backpressure, not a hard quota.
- **Request-size cap:** v1's public instance caps uploads at **100KB** (v2 applies "reasonable signature and verifiers limits"; returns HTTP 413 over the limit). Caisson anchor bytes are hashes + a counter → **well under 1KB**, a non-issue.
- **Caisson's exposure is trivially low.** The cadence design (daily per active tenant, skip-if-unchanged) means **one small submission per active tenant per day**. Even thousands of tenants stay far under "a few thousand per hour from one network." The courtesy-limit risk is effectively nil at the designed cadence; the mitigation (private Rekor per buyer) already exists as a docs-only Fork C option for a buyer who wants isolation or higher volume. No new finding threatens Fork B.

---

## Q8 — OpenTimestamps as the degradation path: what its submission needs vs this design

**How OTS submission works** (opentimestamps.org; `opentimestamps-server/otsserver/calendar.py`; `opentimestamps-client`):

- The client POSTs a **single 32-byte digest** (typically SHA-256, nonce-protected) to one or more **calendar servers** (`https://a.pool.opentimestamps.org`, `b.pool…`, `finney.calendar.eternitywall.com`, …). **No signature, no API key, no registration, no per-entry key material** — "These servers are free to use and they don't require any registration or api key."
- The calendar aggregates all pending digests into a **Merkle tree** and commits the tip to **Bitcoin** (`OP_RETURN`), returning an immediate **`PendingAttestation(calendar_uri)`**. The `.ots` proof is **upgraded later** (`ots upgrade`, calendar `/timestamp/<commitment>`) once the Bitcoin tx confirms — minutes-to-hours latency.
- **Verification needs Bitcoin block headers** (a full or pruned node, or a trusted header source) to confirm the commitment landed in a block. JS lib: `javascript-opentimestamps`.

**OTS vs this design (the contrast that matters):**

- **No per-tenant signature at all** — CONFIRMED. The SPEC's note that OTS needs "no per-entry signature required, so it degrades gracefully if the Rekor spike stalls" is exactly right: OTS entirely sidesteps the Q6 Ed25519ph problem. The `ExternalAnchorSubmission` shape's `signature`/`verifier` fields are simply **unused** for the OTS implementation — a clean drop-in behind the same port, which validates the SPEC's target-agnostic port family.
- **Aggregation is free** — the calendar Merkle-trees all submitters together, so caisson's "deployment-wide super-root" tenant-batching optimization is **already provided by OTS for free** (matches the SPEC's Tenant-story note). One tenant's daily digest costs nothing.
- **Trust/latency trade:** OTS gives **Bitcoin-anchored** public transparency (arguably a _stronger_ escrow than a single log operator) but with **hours** to a verifiable proof and a **Bitcoin-node dependency at verify time**, vs Rekor's **2–20s** proof and a **key-based** offline verify. For `externally-transparent` grade, either satisfies "provable to a party who holds nothing of the buyer's."
- **Design implication:** OTS fits the durable-outbox state machine cleanly — `submitted` (pending attestation held) → `receipted` (after `upgrade` lands the Bitcoin proof). The outbox's "operator-reconciliation on response loss" is _less_ dangerous for OTS than Rekor because OTS submission is idempotent-ish (re-submitting a digest just gets re-aggregated; no irrevocable duplicate public entry with a unique index). This makes OTS the **safer** first `externally-transparent` target to actually ship, even though Rekor is the flagship.

---

## Resolved design decisions (the spike locks these for the v1.1 PLAN)

1. **The `externally-transparent` submission binds the tenant Ed25519 seed via _Ed25519ph_, not the pure signature** — `keyDetails: PKIX_ED25519_PH`, `data.algorithm: SHA2_512`, digest = `SHA-512(anchorBytes)`, sig = `ed25519ph(seed, anchorBytes)` from `@noble/curves/ed25519`. Same key, same public key, same key id as the existing per-tenant signer; new signing _mode_ added to the `signing-primitive` `Signer` port so the seed never leaves it. The SPEC's "reuse the existing Ed25519 signer" survives **at the key level**; the "one module ≈ sign.ts, submit a pure signature" mechanic does **not**. **ECDSA-P256 dedicated anchoring key is the documented fallback** if the live ed25519ph interop check (below) fails.
2. **The persisted WORM receipt is self-contained** — it stores the checkpoint (signed note), the inclusion proof (`hashes[]` + `logIndex`), the leaf inputs (`digest`/`signature`/`verifier`), the RFC-3161 timestamp (grade `trusted-timestamped` layer), **and the log's checkpoint-signing public key + origin string**. Rationale: shards turn down (~6 mo) and receipts are WORM-retained for years; verification must not depend on fetching a historical TrustedRoot. `verifyExternal` verifies the checkpoint signature against the receipt-embedded key without enforcing TUF timestamp freshness (a years-old-but-cryptographically-valid checkpoint is exactly what we want to still verify).
3. **Submit URL comes from a deployment-supplied SigningConfig, never hardcoded** — buyer config carries the v2 shard URL (`log2025-1…` today) until Sigstore distributes it publicly; caisson reads it, does not embed it. Shard rotation is handled by the SigningConfig/TrustedRoot machinery, not reimplemented.
4. **CI is fully hermetic via committed fixtures** — a pinned `trusted_root.json` + a caisson SigningConfig + one golden `TransparencyLogEntry` bundle in `audit-worm`'s `__fixtures__/`; verify runs with `forceCache:true` or by feeding the committed root straight to the verifier. **No live TUF or Rekor fetch in any test.** The fixture set carries a refresh-cadence note (TUF targets expire).
5. **The RFC-3161 timestamp is a separate call** — Rekor v2 gives no integrated time; the `trusted-timestamped` grade's TSA leg (already v1) supplies the time attestation that rides alongside the Rekor receipt in the `externally-transparent` grade. The two grades **compose** (a public-log receipt can also carry a TSA time token); they are not either/or at the wire level.
6. **OTS is a real, and arguably _safer-to-ship-first_, `externally-transparent` drop-in** — same port, `signature`/`verifier` fields unused, no key problem, idempotent-ish submission, free aggregation. Rekor stays the flagship for its 2–20s offline-key proof; OTS is the documented degradation path and a low-risk way to prove the `externally-transparent` grade end-to-end before betting on ed25519ph interop.
7. **`fetchWithTimeout` on the Rekor submit is ≥20s** (not the repo default), per CLIENTS.md — this is a hard requirement, not a tuning knob.

## Open questions that survive the spike

1. **Does binding the _tenant identity_ key to the submission buy anything?** The `externally-transparent` trust comes entirely from **log inclusion** (the checkpoint + proof), and the anchor bytes already commit the tenant's chain tip via `tipHash`. Rekor merely requires _some_ verifier material to form a valid `hashedrekord`; it does not establish authorship trust for this use case. A **single deployment-level (or even ephemeral) anchoring key** would satisfy Rekor's contract and eliminate the per-tenant-key-access-from-a-background-job problem and the ed25519ph work entirely. The SPEC _wants_ the tenant binding; the spike surfaces that it may be **ceremony without security value**. **Recommend the PLAN explicitly decide: tenant-key-via-ed25519ph vs deployment-key** — this is the single highest-leverage open call, and it is an operator/security decision, not a mechanical one.
2. **Bun runtime compat of `@sigstore/sign` 5.x / `@sigstore/verify` 3.1.x** — Node-targeted `engines`. Unproven on Bun. If it fails, the fallback is a hand-rolled v2 submit (small) + RFC-6962 merkle/checkpoint verify (algorithm already in `audit-chain.ts`). **Must be checked before the PLAN pins these deps.**
3. **ed25519ph `hashedrekord` interop against the _live public_ v2 instance from a non-Go client** — proven in Go (#520) and in the server allowlist, but not observed from JS/Bun. **The pre-PLAN de-risk (below) resolves this.**
4. **Historical-shard key availability if we did NOT self-contain receipts** — mooted by decision #2 (we self-contain), but if that decision is ever reversed, this reopens as a hard dependency on Sigstore's retention of retired shard keys in TrustedRoot.
5. **Witnessing** — not required at v2 launch and not implemented by clients yet; when Sigstore lands synchronous witnessing, co-signed checkpoints become an _additional_ offline time source (could partly displace the separate RFC-3161 call). Out of scope for v1.1; note it as a future simplification.
6. **Public SigningConfig distribution date** — Sigstore had not distributed the v2 URL publicly as of GA (planned "end of 2025 / early 2026", i.e. possibly now-ish at 2026-07). If distributed by v1.1 build time, the buyer-supplied-SigningConfig step simplifies; if not, the buyer config carries it. Cheap to check at PLAN time.

## Go / No-Go recommendation

**GO** — decompose the Rekor v1.1 leg into a PLAN, subject to two conditions and one correction.

- **Correction (already folded into the decisions above):** the SPEC's "reuse the existing Ed25519 signer to submit `hashedrekord`" is wrong as literally stated — pure Ed25519 is rejected. The corrected, still-cheap path is **ed25519ph over the same tenant seed** (or, pending open question #1, a deployment-level key). This is a bounded, well-understood change, not a blocker.
- **Condition 1 (pre-PLAN de-risk, ~a day):** run **one live round-trip** — construct an ed25519ph `HashedRekordRequestV002` over sample anchor bytes with a test Ed25519 key, `POST` to `log2025-1.rekor.sigstore.dev/api/v2/log/entries`, persist the `TransparencyLogEntry`, and **verify its inclusion proof + checkpoint offline** against a pinned `trusted_root.json`. This simultaneously proves (a) ed25519ph interop from JS/Bun, (b) `@sigstore/sign` v2 submit + `@sigstore/verify` v2 verify on Bun, and (c) the CI-fixture story. If ed25519ph fails here, fall back to ECDSA-P256 (decision #1) — still GO, just a different signer.
- **Condition 2:** the PLAN's first task **decides open question #1** (tenant-key-via-ed25519ph vs deployment-level key), because it changes both the signer work and the per-tenant-key-access surface.

The protocol is fully specified, the JS client libraries support v2 submit + offline verification today, TUF pinning for hermetic CI is a solved and named mechanism, shard rotation is handled by the client machinery (not reimplemented), and OTS gives a lower-risk parallel path to prove the grade. The known-large piece remains, as the SPEC predicted, the **Rekor tiles client composition** (submit construction + offline inclusion-proof verify in `verifyExternal`), now with the added-but-bounded ed25519ph signing mode. Nothing found in this spike threatens the v1 TSA leg, the durable outbox, Fork B cadence, or the trust-grade split — CR-02's "no online proof retrieval" is **confirmed**, making the outbox mandatory, exactly as ADR-0332 locked.
