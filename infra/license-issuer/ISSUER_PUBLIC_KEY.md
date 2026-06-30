# Caisson license issuer — public verify key (B4, P6 operator-gates)

Provisioned 2026-06-30 by the P6 operator-gates session (ADR-0107 checklist step 3). The Ed25519
**signing keypair** is the root of trust for all license issuance. This file holds the **public**
(verify) half only — non-secret, safe to commit. The **private** signing key never appears in the repo.

## Public verify key (SPKI DER, base64)

```
MCowBQYDK2VwAyEAYUM+v6AQcPjNRoRJyQpDSA7S/LwNu1CecWQZ7A1OJU0=
```

- **Fingerprint** (`sha256(spki_b64)[:16]`): `0ae7d2abb886ca3d`
- **Algorithm:** Ed25519 (`crypto.verify(null, …)`)
- **Round-trip verified:** the matching private key signs and this key verifies (checked at provisioning).

## Code-track action (I1 issuer — NOT this operator session)

1. **Bake the verify key.** Replace the KAT test-vector at
   `packages/license-verify/src/verify.ts` (`const LICENSE_PUBLIC_KEY_SPKI_B64 = …`, currently the
   deterministic `caisson-license-verify-KAT-seed-v1` vector) with the SPKI base64 above. That swap is
   the only change needed for `verifyLicense()` to accept production-issued tokens.
2. **Issuer signs with the private key.** The issuer (code-track I1) loads
   `CAISSON_LICENSE_SIGNING_KEY` (PKCS8 DER, base64) and signs the **kernel-canonical** claims bytes
   (`canonicalize(claims)`), Ed25519 — matching `verify.ts`'s canonical-payload conformance check.
3. **Update the token KAT tests** that assert the old test-vector key, or keep a separate dev keypair
   for tests and bake the production key only in the shipped build (release-time decision).

## Private signing key — where it lives

- **Now:** `~/.gridwork/env` → `CAISSON_LICENSE_SIGNING_KEY` (PKCS8 DER, base64). Operator's secret
  store; never committed, never printed.
- **At issuer deploy:** copy it into the issuer service's platform secret store (Railway, ADR-0105
  posture) as `CAISSON_LICENSE_SIGNING_KEY`. The issuer is the **only** process that ever holds it
  (`verify.ts` header: "the matching private signing key lives ONLY with the P6 issuer and never ships
  in any tarball").

## Rotation

Rotating the keypair is a deliberate release-time act: it invalidates every previously-issued license
(they verify against the baked key). Re-run provisioning only with intent; bump the baked key + re-issue.
