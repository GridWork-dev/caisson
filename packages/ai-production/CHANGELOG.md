# @caisson/ai-production

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
