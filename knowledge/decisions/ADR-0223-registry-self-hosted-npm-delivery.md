# ADR-0223 — registry: self-hosted npm delivery for commercial modules

**Status:** accepted · 2026-07-02 (operator-locked: "option A" direction lock + all eight
sub-forks locked in the same-day picker round).
**Relates:** SPEC `outputs/specs/deferred-respec/SPEC-registry-npm-delivery.md` (the locked
draft, critique-revised) · ADR-0222 (public distribution — the `@caisson-sh/*` npmjs mirror
stays the public-discovery track; this ADR owns the COMMERCIAL delivery track) · ADR-0136
(license-keyed registry gating — extended from index-filtering to tarball delivery) ·
ADR-0097 (registry-schema split — the Apache-2.0 schema stays untouched, see H1) ·
ADR-0110/0113 (license issuer + entitlement/clawback semantics) · ADR-0076
(no-existence-leak, honored by D3). **Supersedes the GitHub-Packages buyer channel** baked
into `packages/cli/src/generate.ts` and `packages/cli/templates/base/.npmrc`
(`@caisson:registry=https://npm.pkg.github.com`).

## Context

The buyer install channel shipped by the generator is structurally dead: GH Packages
requires scope == owner-org, BOTH the npm user "caisson" and the GitHub org "caisson" are
third-party-taken, `publish.yml` has been `CAISSON_PUBLIC_DRY_RUN: "true"` since birth
(zero packages ever published anywhere), and GH Packages would force buyer PATs — bad
commerce UX. Meanwhile the live registry Worker already serves the catalog index with
offline-Ed25519 entitlement filtering (base ∪ entitled, fail-safe-to-base) but no tarballs.
The operator locked **option A**: make `registry.caisson.sh` a real npm registry —
packuments + tarballs — authenticated by the license token buyers already hold.

## Decision (direction + eight sub-forks, operator-locked)

`registry.caisson.sh` serves the npm install protocol for the `@caisson` scope; buyer
`.npmrc` gets one line (`@caisson:registry=https://registry.caisson.sh` +
`//registry.caisson.sh/:_authToken=<license token>`); tarballs live in R2.

- **A = A1 (same-origin Worker proxy):** the Worker serves tarball bytes through its R2
  binding, re-checking the Bearer entitlement on every GET. No pre-signed URLs, one auth
  surface, no cross-host auth loss.
- **B = B1 (base served here too):** open base packages install unauthenticated from the
  same registry; commercial modules license-gated — one scope, one `.npmrc` line, reusing
  the live base-∪-entitled union. The `@caisson-sh/*` npmjs mirror remains the public
  discovery/acquisition surface (ADR-0222), not the buyer channel.
- **C = C1 (raw license token at launch):** the Ed25519 license token IS the `_authToken`;
  npm/bun send it as `Authorization: Bearer`, the exact header the live entitlement filter
  parses. Derived/rotatable install tokens (C2) are the named hardening follow-up.
- **D = D3 (401 bare / 404 with token):** a commercial packument/tarball request with NO
  token → 401 (npm/bun retry with auth); a token that verifies but does not entitle → 404
  (no-existence-leak, ADR-0076).
- **E = E1 (latest only):** one `latest` dist-tag mapped from the ledger; no prerelease
  channel until something produces prerelease tarballs.
- **F = F1 (offline revocation):** the offline Ed25519 contract holds — a refunded/revoked
  buyer can install until token expiry, consistent with perpetual-per-major semantics and
  the Worker's offline verify. Online per-install revocation (F2) pairs with C2 later.
- **G = G1 (Cloudflare-native):** extend the LIVE caisson-registry Worker — edge Ed25519
  verify already there, native R2 binding, `registry.caisson.sh` custom route, same-account
  R2 egress free.
- **H = H1 (commercial tarball sidecar):** a private sidecar maps `(id, version)` →
  `{R2 key, shasum, integrity, size}`. The Apache-2.0 `@caisson/registry-schema` and the
  world-readable `index.json` carry no tarball URLs/hashes and need no version bump.

## Rejected

- **GH Packages buyer channel** — dead (scope==owner + namespaces taken + buyer PATs).
- **302 to pre-signed R2 URLs** — npm/bun auth-on-redirect inconsistency + leaked-URL serves
  anyone until expiry.
- **Commercial-only registry (B2)** — two scopes/registries in every buyer repo for
  outage-independence the mirror already provides.
- **Blanket 404 (D1)** — starves npm's auth-retry flow; **403 (D2)** — leaks catalog existence.
- **Railway-hosted registry (G2)** — re-implements the entitlement gate off-edge, adds egress
  cost and a deploy surface.
- **Extending the open schema (H2)** — commercial tarball pointers in a world-readable
  Apache-2.0 file + a forced schema bump.

## Consequences

The generator's `.npmrc` emit and docs flip to the one-line registry.caisson.sh form in the
build that implements this SPEC; `publish.yml`'s npmjs credential gap stops being a buyer
blocker (npmjs publishing belongs to the ADR-0222 mirror only). Registry
product/entitlement ids never rename. C2 (derived tokens) + F2 (online revocation) are the
recorded hardening pair for post-launch.
