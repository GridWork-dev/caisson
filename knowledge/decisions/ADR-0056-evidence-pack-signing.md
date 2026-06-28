# ADR-0056 — Evidence-pack signing: per-tenant Ed25519 over manifest + chain anchor

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Decides the signing key + scheme
the Compliance evidence-pack generator emits under, which ADR-0006 left undefined.)

ADR-0006 says the evidence pack is "signed" but never names a key or a scheme — and the repo holds
three non-interchangeable disciplines (timing-safe Bearer, HMAC webhook, asymmetric Ed25519 license)
plus a SHA-256 audit chain that is an integrity tag, not a signature. The tension this resolves is
**whose identity signs the buyer's evidence**, and over what bytes.

## Decision

**Per-tenant Ed25519 signing key.** The buyer proves provenance of their OWN evidence with their OWN
identity — a key provisioned per tenant, **distinct from the Caisson license-issuer key** (ADR-0010).

- **Detached Ed25519** via `@noble/ed25519` — the **same curve** as the planned license issuer, so
  the verify path is one primitive across the product. The signature is detached (sits beside the
  pack, not embedded), keeping the signed bytes byte-stable and golden-fixturable (ADR-0013).
- **Signed payload = the canonicalized evidence `manifest.json` ∥ the audit-chain anchor (tip hash).**
  Canonicalize via the shipped `audit-chain.ts` `canonicalize` (recursive key-sort); binding the
  anchor ties the pack to the WORM-anchored chain state at generation time (ADR-0006 / ADR-0046).
- **An RFC-3161 trusted timestamp countersigns the signature** — a near-free "existed at time T"
  attestation over the Ed25519 signature, layered on top, not a replacement for it.
- **DSSE / in-toto envelopes + Sigstore / Rekor transparency** are the **premium provenance tier** —
  an un-wired upsell seam (the ADR-0047 / `kms.ts` ethos), not the v1 base.
- **Amends ADR-0006** ("signed" was undefined): this ADR supplies the key, scheme, and signed payload.
  ADR-0006 is append-only and otherwise stands.

## Rejected

- **The Caisson issuer Ed25519 key signing buyer evidence** (reuse the ADR-0010 license infra) —
  cheapest reuse, but signs the BUYER's evidence with CAISSON's identity. Wrong trust model: the
  provenance claim must be the tenant's, not the vendor's.
- **Buyer-supplied AWS KMS asymmetric Sign** — enterprise-grade custody, but pulls the KMS
  dependency into the signing boundary. Kept as a documented **upgrade** behind the signer seam for
  buyers who require hardware-held keys; not the base path.
- **Signing only the chain anchor (tip hash) + timestamp** — reuses the chain already maintained, but
  it is not the per-pack signature buyers expect. Each evidence pack carries its own detached
  signature; the anchor is bound INTO that payload, not signed in its place.

## Binding

Every evidence pack carries a detached Ed25519 signature, made with a **per-tenant** key distinct
from the Caisson license-issuer key, over the canonicalized `manifest.json` concatenated with the
audit-chain tip-hash anchor; an RFC-3161 timestamp countersigns that signature. The signer lives
behind a port so the buyer-supplied-KMS path is a drop-in, and verification reuses the one
`@noble/ed25519` primitive shared with the license issuer. DSSE/in-toto + Rekor remain an un-wired
premium seam. This is fully-commercial code under ADR-0023 (`LicenseRef-Caisson-Commercial`) — note
ADR-0050 made the local-ai edition commercial too, leaving no AGPL flank in this surface. Evidence:
ADR-0006:19 ("signed ZIP", no scheme); ADR-0010 + ADR-0046 (Ed25519 offline-license precedent +
JSON golden representation); `kernel/src/audit-chain.ts` (`canonicalize`, `anchorChain`/`verifyChain`
tip anchor); ADR-0045 (per-tenant key derivation); ADR-0013 (golden harness); ADR-0047 (un-wired
seam ethos); `outputs/research/wave1-forks.md` P2-16 (the operator-gated signing fork).
