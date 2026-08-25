---
updated: 2026-08-25
grounds:
  - outputs/audit/ledger.toml
  - packages/observability/src/scrub.ts
  - packages/observability/src/scrub.test.ts
  - packages/kernel/src/scrub-deep.ts
---

# Why audit finding `19d1af0e70d0c2d7` was closed while still broken

**Finding:** `SENSITIVE_ATTRIBUTE_KEY`'s `\bemail\b`/`\bphone\b`/`\bssn\b`/`\bdob\b` word-boundary
terms silently fail to redact camelCase or snake_case attribute keys, letting PII reach the external
OTLP sink. Domain `packages/observability`, dimension D1, severity **high**,
subject `packages/observability/src/scrub.ts:23`.

**Status at discovery (2026-08-23 fleet state pass):** `status = "fixed"` in the ledger. The defect
was still live in `main` at `1bc9988e`. Measured, not inferred — executing the shipped regex,
`userEmail`, `user_email`, `emailAddress`, `phoneNumber`, `customerSsn`, `userDob` all returned
`false`; only bare `ssn`/`dob`/`dateOfBirth` and dot-separated keys matched. **6 of 17** probe keys
were caught.

## How it closed without being fixed

1. **The subject file was never touched.** `git log -- packages/observability/src/scrub.ts` shows
   its last change is `0dd715ae` ("add OTLP logs pipeline with stdout stderr bridge") — unrelated to
   this finding, and predating the close. No commit has ever modified the deny-list regex.
2. **The close was mechanical, in bulk.** The row flipped in `b7911986` ("Kickoff B: hygiene wave +
   audit-findings remediation (264 open findings driven to 5)"), whose own message records
   _"99 confirmed, 131 already fixed at HEAD, 34 refuted with evidence. Reconcile closes 259 rows
   mechanically."_ This row was one of the 259.
3. **No per-row evidence was retained.** The finding id `19d1af0e70d0c2d7` appears **nowhere** in
   `outputs/audit/` except its own ledger row. The "adversarial reproduce-check record for all 264
   open rows" the commit message cites does not exist in the tree for this finding, so the basis for
   classifying it as fixed/refuted cannot be reviewed.
4. **The only change `b7911986` made to `scrub.test.ts` was cosmetic** — two lines, renaming the
   fixture `liam@example.com` to `user@example.com` as part of a PII-in-fixtures prose sweep.
   Nothing about the finding.

## The mechanism that made it look fixed

The pre-existing tests exercised **only dot-separated OTel-convention keys** — `"user.email"`,
`"user.phone"`, `"http.request.header.authorization"`. `.` is a non-word character, so `\b` **does**
find a boundary there and those keys **do** redact. A reproduce-check that probed the shape already
present in the fixture would observe correct redaction and conclude "already fixed at HEAD."

The bug only appears under a naming convention the test file never used. The probe and the
expectation were drawn from the same source, so the check could not fail — the audit equivalent of a
self-derived expectation defeating its own mutation check.

**The same blind spot exists in the sibling scrubber.** `packages/kernel/src/scrub-deep.ts` anchors
`dob`/`mrn` with lookarounds and tests two key forms, and its golden fixture
(`__golden__/scrub-deep.json`) carries `user_dob` and `employee_mrn` — **snake_case only**. Its raw
arm handles those, so the golden passed; camelCase `userDob`/`patientMrn` were **not** redacted and
no fixture could reveal it. Fixed in the same commit as this finding.

## Fix

- `scrub.ts`: added `splitKeyWords()` (inserts a separator at camelCase transitions, normalizes
  `_`/`-`) and `isSensitiveAttributeKey()`, which tests the deny-list against **both** the raw key
  and its word-split form. Testing both is **monotone** — strictly more keys redact, never fewer —
  so it cannot regress an already-redacted key. The `\b` anchors are **kept**: they are load-bearing
  for precision (an unanchored `dob` matches inside `adobe`, `mrn` inside `mrna`). The vocabulary
  also gained `first/last/full name`, `birthdate`, `mrn`, `patient`.
- `scrub-deep.ts`: added `splitWords()` to `isRedactedKey`'s form set. Golden unchanged.
- Result: **20/20** PII probe keys redacted, **15/15** secret/credential controls preserved,
  **0/12** benign operational keys falsely redacted.

**Deliberately NOT added:** `address`. `scrub-deep` accepts `ipAddress` over-redaction as fail-safe
for compliance-evidence egress, but a span-attribute scrub that drops `net.peer.address` /
`http.client_ip` degrades tracing materially, and it is outside this finding. Flagged, not changed.

## Guardrail

Both fixes are mutation-checked. Reverting the split arm in `scrub.ts` fails **10** tests; dropping
the `\b` anchors instead of normalizing the key (the naive "fix") fails **3** on the
`adobeVersion`/`dobro`/`mrnaSequence` false-positive arm. The guard discriminates in both directions.

## Lesson for the ledger

A bulk reconcile that closes rows "mechanically" and retains no per-row evidence produces ledger
entries indistinguishable from verified ones. A `high`-severity D1 row should not close without a
retained reproduce-check, and a reproduce-check must not draw its probe input from the fixture the
code already passes. Until the remaining 259 mechanically-closed rows carry evidence, **the ledger's
"0 open D1/D2" headline is a claim about the reconcile, not about the code.**
