# @caisson/email

## 0.3.0

### Minor Changes

- 783110d: Transactional emails now render as branded HTML with a plain-text fallback instead of plain text,
  and a new dev-only preview route shows every template with sample data. The buyer sign-in page
  also gains an email-and-password option alongside the existing magic link, with account
  verification and a forgot/reset password flow.
- 4d7eb71: Add the `credits-expiring` T-30d expiry notice — the first
  transactional/billing template. The template registry is now keyed by a per-template
  `TemplateDataMap` (the three auth templates keep their `{ url }` shape; `credits-expiring` takes
  `{ credits, expiresOn, url }` and renders a dynamic subject). `tryRenderEmailTemplate` coerces
  free-form driver data per template and still falls back to `null` on a shape mismatch, so every
  driver's generic mapping is unchanged.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and corrected a couple of stale cross-package dependency and usage claims to
  match the shipped code. No runtime behavior changed in any package — documentation and
  comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
