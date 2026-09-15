# S8 release checklist preparation — final tag unbound

Preparation only, bound to candidate 05081a20091d3a7971609daab94008c8d352688e. No final tag has been selected or cut. All nine preflight boxes remain open; this file is not a release attestation. Copy and bind the actual tag only after its inputs exist.
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
      deterministic · support-bot — the push-to-main run on the version-PR merge commit)
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

## Post-release verification (after the train completes)

- (post) Registry spot-check: `bun add @caisson/kernel@latest` from a clean env with the
  standing test license — installs clean
- (post) Mirror spot-check: caisson-sh/caisson-oss HEAD carries the release content, history
  APPENDED (never rewritten)
- (post) npm spot-check: `bunx @caisson-sh/cli@latest --help` resolves the new version
- (post) Site redeploy live: /updates shows the entry
- (post) Announcement posted (operator act — W3/window motion per ADR-0318 F5)

## Current measured inputs and open gates

Step 2 fresh absence proof is complete on Bun 1.4.2. Step 3 full-backlog CLI is complete: 35 changesets, 60 planned version bumps (57 patch, 3 minor). These are preparation inputs, not completed version/CI/publication boxes.

R4 remains NOT RUN by peers; s8-release-review-preparation.md records the refusal and precise review targets. Accepted lane branch/freshness drift does not make aggregate SOT exit 0 in release-readiness. Final tag, version PR, six-check roster, live-hybrid evidence, buyer install proof and buyer-facing release content remain open. Do not run readiness against an invented tag or check these boxes based on historical releases.
