# Caisson license issuer — public verify key (B4, P6 operator-gates)

Provisioned 2026-06-30 by the P6 operator-gates session (ADR-0107 checklist step 3);
**ROTATED 2026-07-05** per ADR-0226 / the P0 license-token credential incident (tokens signed by the
prior key were committed and survive in git history + mirror snapshots; offline verify has no
revocation list, so rotating the baked key is the only invalidation). The Ed25519
**signing keypair** is the root of trust for all license issuance. This file holds the **public**
(verify) half only — non-secret, safe to commit. The **private** signing key never appears in the repo.

## Public verify key (SPKI DER, base64) — active since 2026-07-05 (rotation 2)

```
MCowBQYDK2VwAyEAQUI4pkfsYmA3f616p5xCM0P+EzHS9+rRN/y/AGXnOP4=
```

- **Fingerprint** (`sha256(spki_b64)[:16]`): `a170f7a0ab89bab0`
- **Algorithm:** Ed25519 (`crypto.verify(null, …)`)
- **Round-trip verified:** the matching private key signs and this key verifies (dev-key test suite
  proves the verify path; the bake is pinned negatively — a dev-signed token is rejected by the
  shipped entrypoint).

### Retired keys

| Fingerprint        | Active     | Retired    | Why                                                                                                                                                                                                                                           |
| ------------------ | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c0bfb8277a840d2e` | 2026-07-05 | 2026-07-05 | Rotation 1's re-minted worker test fixture was itself a live prod-signed token in-repo (review P1); fixtures went dev-key-runtime-minted, then the key rotated again so the fixture token dies. Never deployed to the live service or Worker. |
| `0ae7d2abb886ca3d` | 2026-06-30 | 2026-07-05 | ADR-0226 rotation: prod-signed tokens leaked into git history/mirror; every token signed by this key is now unverifiable.                                                                                                                     |

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
