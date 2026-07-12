# @caisson/everything

## 0.2.3

### Patch Changes

- 679cce6: Drop the three dissolved-edition meta pins (@caisson/agent-dev, @caisson/ai-kit,
  @caisson/local-ai) from the Everything members map. The ids were delisted 2026-07-07, are
  filtered from entitlement expansion by the index allowlist, and can never resolve on the
  served registry surface — the new CAISSON-86 coverage pin gate would fail the next version
  cut on them. Buyer entitlements are unaffected: tokens sign purchased ids, and legacy-id
  aliasing is claim-side.
- 4d85f28: UI Pro is published to the registry at $129 standalone, and its description now covers the
  full eleven-component set. The Everything bundle republishes with UI Pro pinned at its real
  published version instead of the pre-publish placeholder, so an Everything purchase now
  installs UI Pro like any other member.

## 0.2.1

### Patch Changes

- Refreshed every bundle's frozen member pin map to the versions published in this release,
  so a bundle purchase delivers the same hardened member set an à-la-carte buyer gets — the
  tenant-isolation, field-encryption, audit-chain, AI-gateway, and local-suite updates in this
  cut now reach bundle buyers too. The Everything bundle additionally re-pins its sibling
  bundles at their refreshed versions. No membership changes: the same modules, newer pinned
  releases.

## 0.2.0

### Minor Changes

- fe73e6f: Adds the purchasable bundles as first-class catalog objects. AI-Production, Local-first, and
  Agentic-Dev package their modules together below the sum of the parts. Provenance is a new bundle
  pairing per-tenant evidence signing, an append-only audit chain, and at-rest field encryption. The
  Everything bundle is the whole commercial catalog in one purchase, including the premium UI kit; the
  open base ships free. Buying a bundle grants exactly its listed modules, and buying it under an
  edition's earlier name still grants the same set.
