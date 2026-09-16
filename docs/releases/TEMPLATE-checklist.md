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
- [ ] The draft release tag targets the single-parent attestation successor of the reviewed
      version candidate. Only outputs/audit/release-audit-<tag>.md and
      docs/releases/<tag>-checklist.md may differ from its reviewed parent (ADR-0425).
      The tagged tree contains the audit naming reviewed_sha = that parent; readiness
      verifies both the parent binding and exact changed-path allowlist. No product or
      other documentation bytes may enter this successor.
- [ ] CI green on the release SHA (check · standards-gate · registry-index · oscal-conformance ·
      deterministic · support-bot · runtime-images-gate — the full run on the final tagged successor SHA)
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

## R4 artifact schema (R370 / ADR-0425)

The audit begins with strict YAML frontmatter containing only: schema_version: 2,
status: clean, critical: 0, base (previous release tag), tag (this release), reviewed_sha
(the exact 40-character SHA of the tag candidate parent), reviewed_scope (a non-empty
array of paths), and reviewers. Reviewers contains exactly one code_review and one
security_audit entry, each with role, non-empty identity, and reviewed_at ISO timestamp
with timezone. Unknown fields, failed verdicts, incomplete identities and wrong bindings
fail closed. The gate derives the reviewed parent and previous release itself.

Review candidate A first. Commit its completed audit naming A and the completed checklist
as successor B. Only these two tag-specific regular files may change. The gate reads the
committed audit in B, proves B has exactly one parent A, and rejects every other changed
path (including other audit or checklist files). Full CI still runs on B, not merely A.
Never put B inside its own audit: that would change its SHA. The release workflow keeps
passing the final tag SHA; readiness derives reviewed_sha with rev-parse <tag_sha>^.

Do not copy a preparation or failed report into the tag-named path. No release tag or final
attestation exists during preparation; this template is not a completed audit.

## Post-release verification (after the train completes)

- (post) Registry spot-check: `bun add @caisson/kernel@latest` from a clean env with the
  standing test license — installs clean
- (post) Mirror spot-check: caisson-sh/caisson-oss HEAD carries the release content, history
  APPENDED (never rewritten)
- (post) npm spot-check: `bunx @caisson-sh/cli@latest --help` resolves the new version
- (post) Site redeploy live: /updates shows the entry
- (post) Announcement posted (operator act — W3/window motion per ADR-0318 F5)
