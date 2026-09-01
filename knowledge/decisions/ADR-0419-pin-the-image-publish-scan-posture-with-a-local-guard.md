# ADR-0419 — Pin the image-publish scan posture with a local guard, because the default lives in someone else's file

- **Date:** 2026-09-01
- **Status:** Accepted (operator picker in the caisson session pane, 2026-09-01 — ask `CAI-ASK-2c`, label verbatim below)
- **Scope:** `tooling/audit-harness` (the new guard) · `docs/security/tooling-playbook.md` (the prose it pins) · `.github/workflows/publish-image.yml` (read-only — a byte-identical template copy this repo must never edit)
- **Parent:** ADR-0327 / CAISSON-95 (the pinned `deterministic` security-scan gate) · ADR-0314 (the repo-local security tooling stack)
- **Tracks:** CAISSON-221 (image-publish scan posture)

## Context

`publish-image.yml` scans every published image digest with Trivy and ends the step with
`exit-code: ${{ vars.TRIVY_EXIT_CODE || '0' }}`. Caisson deliberately leaves the `TRIVY_EXIT_CODE`
repo variable **absent**: image-layer CVEs are recorded as publish evidence, not gated, because the
blocking supply-chain gate is `scan.sh --layer ci`, required as `deterministic`. A publish that reds
on an unfixable base-image CVE is precisely the disabled scan the playbook argues against.

Two facts make that posture fragile in a way prose alone cannot hold:

1. **Absent and `TRIVY_EXIT_CODE=0` are indistinguishable template-side.** The fallback resolves an
   unset variable to `'0'`, so nothing in this repo records which of the two caisson chose. One
   paragraph in `docs/security/tooling-playbook.md` is the entire record.
2. **The default is upstream's to change.** The workflow is a byte-identical copy of a shared CI
   template and is never edited here. If the template's fallback ever becomes `'1'`, caisson's
   publishes start blocking on image CVEs with no local signal, and the playbook paragraph silently
   becomes false — a doc that describes a posture the repo no longer has.

## Decision

### Ruling 2c — "Land a local static guard on the template default"

`tooling/audit-harness/src/publish-scan-posture.test.ts` reads both files off disk and fails if they
drift apart. It asserts the template still carries the `'0'` fallback expression, that no workflow in
this repo sets `TRIVY_EXIT_CODE` locally, and that the playbook still carries its "record, never
block" section — so deleting the prose without deleting the posture reds too.

It lives in an existing workspace package on purpose. A new root-level test file would need a line in
`ci.yml`'s explicit test list, and `audit-harness` already resolves the repo root from
`import.meta.dir` and picks up `./src` automatically.

**The workflow file is not edited, now or by this guard's failure.** When it fires, the reader's job
is to re-read the template diff and decide the posture deliberately — then update the test and the
playbook together. Never the template.

Two options were declined:

- **Policy-anchor only** — leave the playbook paragraph as the record and add nothing executable.
  This was the analysis's recommendation. Declined: it is the status quo that produced the exposure,
  and prose cannot notice a change in a file it merely describes.
- **Wait for the upstream template to make the default explicit.** Declined: it makes caisson's
  posture depend on someone else's schedule, and the guard is three assertions.

## Consequences

- An upstream template re-adoption that flips the default now reds a caisson test before it can flip
  a publish, which is the whole point: the failure arrives at review time rather than as a surprised
  red publish weeks later.
- The guard reds on a **legitimate** change too — the day caisson decides to gate on image CVEs, the
  test must be updated in the same change as the variable. That is intended; the posture is supposed
  to cost one edit to change.
- The playbook section heading is now load-bearing. Renaming it breaks the build, which is the
  cheapest available way to keep the prose and the posture from separating.
