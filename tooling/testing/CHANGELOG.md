# @caisson/testing

## 0.0.3

### Patch Changes

- 8875592: Both crypto packages gain a browser-safe `./browser` entry point, so the same primitives the server
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

- 74f0756: The risk-register interactive demo on the site now drives the real risk-register package end to
  end — authoring, residual computation, treatment-plan assembly, and the audited override flow all
  run the shipped code instead of a hand-maintained copy. The shared test harness gains a
  module-graph walker that statically proves a browser entry never reaches a Node builtin, so this
  class of demo is verified by source analysis rather than trusting a bundler.

## 0.0.2

### Patch Changes

- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
- b5a3690: Repoint hand-rolled inline controls at the new kit interactive primitives: the marketplace
  facet Type/Category/Price/Media filters now use `Radio`/`Checkbox` instead of raw
  `<input>` elements, the primary-nav Editions/Marketplace/Resources disclosures now build on
  the new `Popover` primitive (removing duplicated Escape/outside-click/focus-return
  handling), the mobile hamburger nav now builds on the open `Dialog` primitive's drawer
  variant (native `<dialog>` + `showModal()`, top-edge sheet — scrim-close, focus trap, inert
  background, and focus-return are the primitive's job now), and the admin
  business-mutation panel's checkbox uses the same kit `Checkbox`.
  `@caisson/testing` gains a shared axe-core + JSDOM harness (`renderIntoJsdom`,
  `expectNoA11yViolations`/`expectNoA11yViolationsIn`) backing the new primitives' a11y
  regression tests. Private packages only; no publishable release.

## 0.0.1

### Patch Changes

- f9d58c4: Test and proof hygiene fixes, no runtime behavior change for buyers.

  - Root bunfig.toml scopes bun test discovery away from stale compiled dist/
    output, plus a regression test in @caisson/testing.
  - apps/admin's PGlite bootstrap now applies the line-item migrations
    (0008/0009), matching the deploy-migrate chain, plus a columns-contract-style parity test.
  - packages/field-crypto's live KMS proof schedules deletion for both throwaway
    CMKs defensively in afterAll, not just the one the last leg reached.
  - apps/admin's /business degrade path distinguishes a genuine undefined-table
    error (Postgres 42P01) from any other transient DB error before rendering the
    provisioning hint.
