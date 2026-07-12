# @caisson/testing

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
