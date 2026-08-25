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

**Round 1 (`fd82cd6d`).** `scrub.ts` gained `splitKeyWords()` (a separator at each camelCase
transition, `_`/`-` normalized) and `isSensitiveAttributeKey()`, which tests the deny-list against
both the raw key and its split form — monotone, so it cannot regress an already-redacted key. The
`\b` anchors were kept (an unanchored `dob` matches inside `adobe`) and the vocabulary gained
`first/last/full name`, `birthdate`, `mrn`, `patient`. `scrub-deep.ts` gained the same split for its
anchored `dob`/`mrn` tokens; golden unchanged.

**Round 1 overstated its result.** The commit claimed "20/20 PII probe keys redacted". That number
was measured against a probe set drawn from the two naming conventions the fix targeted (camelCase,
snake_case). The security audit of PR #449 probed independently with 86 keys and measured **48/86**:
plurals (`emails`), digit suffixes (`email2`), fused lowercase (`useremail`, `myssn`), all-caps
(`USEREMAIL`, `SSNVALUE`), and a fullwidth `ｅmail` all still passed through. That is the same
self-derived-expectation error this note diagnoses in the original close — the probe and the fix
came from one mind. The audit also found that round 1's acronym split, `([A-Z]+)([A-Z][a-z])`,
backtracks quadratically: an all-caps key of 32k chars took ~850 ms (measured 3.0 s at 64k in the
mutation check below), and an attribute NAME is attacker-controlled from any instrumented request.

**Round 2 (this branch, the audit's F1–F6).**

- **F1 — ReDoS.** `([A-Z]+)` → `([A-Z])` in both splitters. Proven equivalent over 200,015 random +
  adversarial keys (0 differences); 64k-char all-caps key now 19 ms (observability) / 15 ms (kernel),
  linear in the length.
- **F2 — completeness.** The `\b` word anchors are gone; the short tokens that need precision now
  use letter-lookarounds instead, which see the space `splitKeyWords` inserts where `\b` never
  could: `(?<![a-z])dobs?(?![a-z])`, `(?<![a-z])mrns?(?![a-z])`, `(?<![a-z])patient`,
  `first/last/full[_-]?name(?![a-z])`. `email`/`phone` are unanchored. `ssn` is anchored on ONE side
  (`(?<![a-z])ssns?|ssns?(?![a-z])`) so `myssn`/`SSNVALUE` hit while the mid-word cluster in
  `className`/`businessName`/`processName` does not — a class the auditor's own proposal would have
  falsely redacted. The key is NFKC-normalized before both arms, so fullwidth forms fold.
- **F3** — this correction. **F4** — the empty changeset replaced by real `patch` bumps for
  `@caisson/observability` and `@caisson/kernel`. **F5** — the `address` exclusion is now explained
  at the deny-list itself. **F6** — `SENSITIVE_ATTRIBUTE_KEY` is `@deprecated` for direct `.test()`.

**Result — measured on the shipped `isSensitiveAttributeKey`, not on a copy of the regex:**

| Probe set                                                                                | Round 1 | Round 2   |
| ---------------------------------------------------------------------------------------- | ------- | --------- |
| Core camelCase/snake_case/dot PII keys (20)                                              | 20/20   | **20/20** |
| Auditor's hardening residual — plural/digit/fused/caps/fullwidth (36)                    | 1/36    | **34/36** |
| Secret/credential controls incl. fullwidth `ａpiKey` (17)                                | 16/17   | **17/17** |
| OTel semconv attribute names that must SURVIVE (24)                                      | 24/24   | **24/24** |
| Benign keys that must survive incl. `className`/`outpatientVisits`/`lastNameserver` (22) | 19/22   | **22/22** |

**Accepted residual (2/36):** `userdob`, `recdob` — a 3-letter token fused lowercase in the MIDDLE
of a key. No regex catches these without also catching `adobe`; a value-level scrub is the tool.
(`e_mail`/`E_MAIL` were residual until the re-verification round; `e[_.-]?mail` now covers the
separator-inside-the-word spellings `e-mail`/`e.mail`/`e_mail`, and `medical[_-]?record` covers the
spelled-out MRN.) **Also accepted:** homoglyph and invisible-character spellings that NFKC does not
fold — Cyrillic `еmail`, `em\u00ADail` (soft hyphen), ZWJ/ZWSP, a combining acute — all pass
through. Threat model: an attacker names attributes only on their OWN requests, so this bypass
exfiltrates their own data to the operator's sink; first-party developer naming does not use
homoglyphs. Enumerated, not fixed.
**Accepted over-redaction:** `phoneticKey`, `iPhoneVersion`, `telephoneBooth`, `microphoneEnabled`
(unanchored `phone`); `assn`, `ssnr`, `ssnapshot` (the one-side `ssn` anchor at a word edge) — all
non-semconv, fail-safe direction.

**Independent re-verification (opus, own probe set, after round 2):** F1–F6 all CLOSED; 66/67 on
its 67-key redact set (the miss was the spelled-out MRN, since added), 38/39 benign survive
(`microphoneEnabled`), linear timing across 12 adversarial shapes to 256k chars against a
superlinear greedy control, kernel golden byte-identical to main. It also swept all **889** real
`@opentelemetry/semantic-conventions` names against main and this branch: `newly redacted: []`,
`no-longer redacted: []`. **Pre-existing, out of scope, worth its own ticket:** 21 semconv names
redact on main and here alike via the unchanged `token`/`session`/`authoriz` terms — including
`gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `session.id`, `mcp.session.id` — which
blunts LLM-usage telemetry in a repo that ships AI observability. The "24/24 semconv survive" row
above is true of its own 24-name list only.

**Ledger.** The row keeps `status = "fixed"`. The ledger schema is `open | accepted | fixed` with no
evidence field, and `reconcile()` regenerates every row, so a "partially fixed" status cannot live
there. This note is the retained evidence the original close lacked; the residual above is the
enumerated boundary of "fixed".

## Guardrail

Every guard is mutation-checked against the round-2 test files (75 + 10 tests, all green at HEAD):

| Mutation                                                                 | Red tests                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Restore the greedy `([A-Z]+)` split (F1 revert) — observability / kernel | 1 / 1 (the 64k timing test, 3.0 s / 2.7 s)                              |
| Remove the split arm                                                     | 3 (`userDob`, `userDOB`, `userDobs` — the anchored tokens)              |
| Naive fully-unanchored deny-list                                         | 13 (`adobeVersion`, `className`, `businessName`, `outpatientVisits`, …) |
| Drop NFKC normalization                                                  | 2 (`ｅmail`, `ａpiKey`)                                                 |
| Anchor `ssn` on both sides                                               | 3 (`myssn`, `userssn`, `SSNVALUE`)                                      |

Note the split-arm mutation now reds only 3 (round 1 reported 10): with `email`/`phone` unanchored,
the raw arm catches most camelCase keys on its own, and the split arm's remaining job is the
lookaround-guarded short tokens. That is the honest scope of that arm, not a weaker guard.

## Lesson for the ledger

A bulk reconcile that closes rows "mechanically" and retains no per-row evidence produces ledger
entries indistinguishable from verified ones. A `high`-severity D1 row should not close without a
retained reproduce-check, and a reproduce-check must not draw its probe input from the fixture the
code already passes. Until the remaining 259 mechanically-closed rows carry evidence, **the ledger's
"0 open D1/D2" headline is a claim about the reconcile, not about the code.**
