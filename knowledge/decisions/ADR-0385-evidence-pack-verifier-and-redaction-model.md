# ADR-0385 — Out-of-band evidence-pack verifier and fail-closed export redaction

- **Date:** 2026-07-25
- **Status:** Accepted (operator-locked at the grill-remediation picker)
- **Parent:** ADR-0380 (the lane A residuals whose implementation these two findings landed in) ·
  ADR-0043 / ADR-0052 / ADR-0054 (the WORM chain and evidence primitives) · ADR-0094 (the
  open-core boundary the new package sits outside) · ADR-0215 (the shared secret-scrub predicate)

## Context

An adversarial grill of the four open PRs tested 44 hypotheses, refuted 39, and confirmed 5. Three
landed on PR #335 (lane A). Two of those had more than one defensible fix and are locked here; the
third (the Inngest adapter silently discarding `singletonKey`) has one obvious answer and needs no
decision.

Both findings are in the **evidence-export path** — the surface this product sells. Neither was
caught by lane A's own code review, security audit, and adversarial review, all of which reported
PASS. That is worth recording: a lane auditing its own output is not a substitute for an
independent one.

## Decisions

### 1. The evidence pack ships no verifier; verification moves fully out of band

**Operator pick, overriding the recommendation** to sign a file manifest while keeping the bundled
verifier as a convenience path.

The pack's seal covered the ordered receipts and metadata but not `verify.mjs` or `README.md`. The
top-level `sha256` did cover them — and was itself unsigned, travelling inside the same archive.
The attack is one step: keep `receipts.json` and its valid `packSeal` untouched, replace
`verify.mjs` with a program that prints `PASS`, recompute the unsigned digest. The README instructs
the recipient to run exactly that program. The seal cannot detect the substitution because its
payload contains no verifier or file-manifest digest.

The general form of the defect is that **an embedded verifier cannot establish its own integrity**.
Any fix that leaves an executable inside the archive as the sanctioned verification path is
arguing about how hard the substitution is, not whether it works.

- A new package `@caisson/verify-pack` becomes the only sanctioned verification path.
  `LicenseRef-Caisson-Commercial`, matching its evidence-path siblings.
- The pack stops shipping an executable verifier, and the seal payload is extended to cover a
  canonical manifest of every file name and digest, so any substitution inside the archive breaks
  the signature rather than merely being detectable in principle.
- The README directs the recipient to verify with the independently obtained package, never with
  anything that travelled inside the pack.

**The honest limitation, which the implementation must state rather than paper over.** `npm publish`
is operator-gated and has not happened, so `npx @caisson/verify-pack` does not resolve publicly yet.
Until it does, the in-repo package is the verification path and the out-of-band guarantee is a
design property rather than a delivered one. Documentation must not imply the package is already
installable. This ADR locks the direction; publish remains its own operator act, behind the OSS and
release gates.

### 2. Export redaction becomes a fail-closed per-event allowlist

**Operator pick, matching the recommendation** over broadening the denylist.

`DEFAULT_REDACT_KEYS` was a 14-name exact-match denylist plus a small set of recognizable string
shapes. `credential`, `credentials`, `auth`, and `clientAssertion` were absent outright, and
`setCookie` normalizes to `setcookie`, which does not match the listed `cookie`. An opaque secret
that resembles no known token shape passed the string scrub untouched. Storing
`{"credentials":{"value":"hunter2"}}` and requesting the admin proof or evidence-pack export
returned `hunter2` in the receipt and in `receipts.json` — **server-side disclosure, not a
client-side hiding failure**.

Broadening the list would have fixed every name the grill actually found and nothing else. A
denylist is structurally leaky: it can only redact what someone predicted, and the next secret
under an unanticipated key name leaks identically. For an export path in a product whose pitch is
audit-evidence integrity, "we listed the ones we thought of" is not a guarantee.

- An exported audit payload emits **only** the fields its event-specific schema names. Anything
  unrecognized is dropped, not passed through.
- An event type with **no** schema exports no payload fields at all. Absence fails closed; it never
  defaults to open.
- The broadened denylist is retained as defense in depth for display surfaces, with negative tests
  for opaque values under `credential(s)`, `auth`, `clientAssertion`, and `setCookie`.

The cost is one schema per audit event type, enumerated from the code rather than invented. That is
the larger change, and it is the one that stops being wrong when someone adds a field nobody
anticipated.

## Consequences

- A new commercial package enters the catalog. It is a **verification tool, not a sellable SKU**:
  no `SKU_RETAIL` row, no bundle membership, no catalog-count change. It does not touch the
  ADR-0383/0384 wave.
- The evidence-pack format changes: no bundled verifier, and a seal payload covering a file
  manifest. Since no pack has been issued to a real buyer, there is nothing to migrate.
- Exports lose fields that no schema names. That is the point, but it means an event type whose
  schema is missed will silently export an empty payload — the fail-closed direction, and the
  reason the schema set must be enumerated from real event types rather than guessed.
- Independent adversarial review earned its place in the lane. Three P1s reached a green CI on
  self-reported clean audits; CI checks the gates it has, and none of these were gate-shaped.

## Not decided here

- When `@caisson/verify-pack` is published to npm. Operator act, behind the OSS/release gates.
- Whether the display-side denylist eventually collapses into the same allowlist. Left open until
  the export schemas exist and the duplication is real rather than anticipated.
- An integer, versioned FX policy. The sibling P2 (a non-USD charge misread as USD cents) is fixed
  by falling back to retail rather than converting; a real cross-currency floor needs a locked
  conversion policy, which nobody has asked for yet.
