# Release checklist — <tag>

Copy this file to `docs/releases/<tag>-checklist.md` before publishing the GitHub Release.
`scripts/release-readiness.ts` (run by the release train's readiness job, R3) requires this
file to exist for the tag with **zero unchecked boxes** — every `- [ ]` below is a pre-flight
item that must be `- [x]` before the Release is published. The plain "post" bullets are
verification steps after the train runs; they are deliberately not checkboxes.

## Pre-flight (all boxes checked before publishing the Release)

- [ ] Version PR merged to main (dispatch `version-pr.yml` → review → merge; ADR-0325):
      `.changeset/` drained, versions bumped, CHANGELOGs written, `bun.lock` refreshed, AND
      `registry/{ledger.jsonl,index.json,tarballs.json}` updated in the SAME commit
- [ ] The draft GitHub Release's tag targets the version-PR merge commit or its
      attestation-only successor (docs/audit/checklist only — no package bytes; readiness
      reads the R4 audit + this checklist from the TAGGED tree, and this checklist is only
      completable after the merge, so a successor commit is the normal shape — operator lock
      2026-07-12, first ride). publish.yml re-verifies ancestry and byte-reproduces every
      tarball hash at the tag — a mismatch stops the train
- [ ] CI green on the release SHA (check · standards-gate · registry-index · oscal-conformance ·
      deterministic · support-bot · runtime-images-gate — the push-to-main run on the version-PR merge commit)
- [ ] `bun run sot` green
- [ ] R4 fresh full audit of the cumulative diff since the last release tag, on file at
      `outputs/audit/release-audit-<tag>.md` (SHIP-audit lane: gw-code-reviewer +
      gw-security-auditor, findings adversarially verified)
- [ ] Live-hybrid retrieval golden leg green locally:
      `bun scripts/release-readiness.ts --tag <tag> --local` (Kickoff-M picker lock 2026-07-10:
      this leg gates release readiness, not PR CI)
- [ ] Site surfaces current: /updates entry drafted, pricing/marketplace copy true-to-built
- [ ] Release notes written on the draft GitHub Release (buyer-facing, no ADR citations)
- [ ] No open P0/P1 against the buyer install path (registry tarballs resolve for
      `dist-tags.latest` of every published package)

## R4 artifact schema (R359 / CR-06)

The audit file must begin with strict YAML frontmatter containing only: schema_version: 1,
status: clean, critical: 0, base (previous release tag), tag (this release), sha (the exact
40-character final candidate SHA), reviewed_scope (a non-empty array of paths), and reviewers.
Reviewers contains exactly one code_review and one security_audit entry; each has role,
identity (non-empty), and reviewed_at (an ISO timestamp with timezone). Unknown fields, failed
verdicts, incomplete identities, empty scope and mismatched bindings fail closed. The gate
derives the previous release from the candidate's parent history; it never trusts the audit
file to choose its own comparison base. Prose follows the closing frontmatter delimiter.

Do not copy a preparation or failed report to the tag-named path. Produce the actual completed
audit for the final candidate; the existence of this template is not an attestation.

## Post-release verification (after the train completes)

- (post) Registry spot-check: `bun add @caisson/kernel@latest` from a clean env with the
  standing test license — installs clean
- (post) Mirror spot-check: caisson-sh/caisson-oss HEAD carries the release content, history
  APPENDED (never rewritten)
- (post) npm spot-check: `bunx @caisson-sh/cli@latest --help` resolves the new version
- (post) Site redeploy live: /updates shows the entry
- (post) Announcement posted (operator act — W3/window motion per ADR-0318 F5)
