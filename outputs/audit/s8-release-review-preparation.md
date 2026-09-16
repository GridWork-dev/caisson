# S8 release review preparation — R378 green-PR boundary

Current product review candidate: `98a3501d1e3cdf2e30955b1f7d6d4345cac5e732`.
R378 adds only the authorized build-state correction at `c9250e86`; later preparation
and receipt commits contain no product changes. Forge main remains
`7e11672c29d21b57a12cf1ad1d4758abbd12b66b`. No release tag or version is selected.

## Completed review chain

- Original cumulative code review: [R356 report](s8-r356-retry3-REVIEW.md), six findings;
  subsequent repairs and review rounds are preserved in RUN-NOTES.
- [R370/R371 security](s8-r370-371-SECURITY.md): eight of nine threats closed with
  targeted cumulative security-sensitive inspection; candidate checklist binding remained open.
- [R373 code review](s8-r373-REVIEW.md) and [R373 security](s8-r373-SECURITY.md):
  **PASS WITH DISCLOSURES**, no new findings. CR-07/WR-03 and WR-02 closed; security's
  inherited register is 9/9 closed. These renewals cover two repair files, not a new
  exhaustive review of the entire cumulative release. Inherited coverage stays explicit.

The historical refused dispatches never ran and supply no review evidence. The later
completed reports above supersede the preparation's former one-set-of-eyes status.
Historical direct bucket-key correlation was not remeasured by these code reviews.
The embedding DNS resolution/transport race remains a disclosed residual. R344's
OS-only runtime gate retains the documented application/unfixed CVEs.

## Candidate preflight

R378 SOT ran once after the docs correction: ADR ceiling and package counts GREEN;
only frontmatter freshness and branch hygiene are EXPECTED-DRIFT by explicit ruling.
Aggregate SOT still exits 1 and is not final release-readiness green. Exact document
and source dates are in [the captured output](s8-r378-sot.log); no freshness dates or
branches were changed.

Fresh diagnostic removal proof: [s8-r378-absence.json](s8-r378-absence.json).
All four marker UUIDs and five diagnostic identifiers are absent from six source/test
files and both rebuilt limiter artifacts; hashes match the prior removal proof.
Three implementation files equal pre-diagnostic e2116849; six source/test files equal
bound main. Removal is an ancestor, the temporary changeset is absent, and the only
new changesets are the approval and egress repairs. Bun 1.4.2: 64/0/168, build/lint pass.

R373 verification remains bound to unchanged product bytes: readiness 36/0/75;
affected tests 146/0/505 with accepted pre-existing auth-account teardown exit 99;
root gate 199/199 tasks at concurrency 2, all tail gates green. Both new regressions
failed before repair; two new and eleven prior mutations failed with exact restoration.

## Remaining release acts

This is preparation for the authorized green PR, not the final tag-named R4 audit.
Version consumption, final reviewed parent and attestation-only successor, seven-check
CI on that successor, substantive tag-bound R4 audit, aggregate SOT, live-hybrid evidence,
52-package eligibility/repack proof and consumer propagation remain later gates.
No final checklist item is marked complete from this preparation. Merge, tag, publish,
deployment and live probes require their later rulings.
