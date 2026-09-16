---
phase: release-train-2026-09-r373
reviewed: 2026-09-16T15:54:24Z
depth: deep
base: 23966290343c342d2fcf81775c73d98151223fb1
head: 98a3501d1e3cdf2e30955b1f7d6d4345cac5e732
repair_commits:
  - 0bd7433f4a5286c1d849216495f8508a3863fc24
  - 98a3501d1e3cdf2e30955b1f7d6d4345cac5e732
files_reviewed: 2
files_reviewed_list:
  - scripts/release-readiness.ts
  - scripts/release-readiness.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
verdict: PASS_WITH_DISCLOSURES
---

# Phase R373: Code Review Report

**Reviewed:** 2026-09-16T15:54:24Z
**Depth:** deep
**Range:** `23966290343c342d2fcf81775c73d98151223fb1..98a3501d1e3cdf2e30955b1f7d6d4345cac5e732`
**Candidate:** `98a3501d1e3cdf2e30955b1f7d6d4345cac5e732`
**Verdict:** **PASS WITH DISCLOSURES**

## Summary

Both assigned repair findings are closed.

- **CR-07/WR-03 closed:** checklist completeness is now evaluated from the candidate Git blob identified by the same candidate SHA used for audit validation. A dirty complete working-tree copy cannot rescue an incomplete or absent committed checklist.
- **WR-02 closed:** audit and checklist blobs are read through a raw `execFileSync` helper without `.trim()`. Leading whitespace remains visible to byte-zero frontmatter validation and is rejected.
- **ADR-0425 contract preserved:** the audit remains bound to the candidate’s single parent, only the two tag-specific attestation paths may differ, both paths must be regular blobs, and final CI remains bound to the successor SHA.

All reviewed files meet quality standards. No new blocker or warning was found.

## Narrative Findings (AI reviewer)

No BLOCKER or WARNING findings.

## Repair Closure

### CR-07/WR-03 — Candidate checklist blob binding: CLOSED

**Implementation:** `scripts/release-readiness.ts:440-464,515`

`checkChecklist()` now requires the candidate SHA, validates it as a full object ID, and reads:

```ts
const source = readGitBlob(repo, sha, path);
```

The production entry point passes the same `sha` used by `checkAuditArtifact()`:

```ts
checkAuditArtifact(tag, sha);
checkChecklist(tag, sha);
```

All missing-object, invalid-reference, and unreadable-blob paths enter the catch branch, record a failed check, and return `false`.

A bounded call-site inspection found no stale production caller using the former worktree-bound signature.

**Real-Git regression coverage:** `scripts/release-readiness.test.ts:139-165`

The scratch-repository tests establish all material directions:

- committed complete / dirty incomplete passes;
- candidate blob absent / working-tree copy present fails;
- committed incomplete / dirty complete fails;
- `auditSuccessorIsValid()` remains green in the incomplete-checklist case, proving the checklist assertion itself supplies the rejection.

### WR-02 — Raw committed audit bytes: CLOSED

**Implementation:** `scripts/release-readiness.ts:102-108,361-375,421-425`

Both artifact reads now use:

```ts
function readGitBlob(repo: string, sha: string, path: string): string {
  return execFileSync("git", ["show", `${sha}:${path}`], {
    cwd: repo,
    stdio: ["ignore", "pipe", "pipe"],
  }).toString("utf8");
}
```

No trimming or whitespace normalization occurs before `auditSourceIsValid()` applies its byte-zero frontmatter expression.

**Real-Git regression coverage:** `scripts/release-readiness.test.ts:128-137`

The test commits an otherwise-valid audit with a leading newline, repairs only the dirty working copy, and confirms candidate validation still fails.

### Attestation-only reviewed-parent contract: PRESERVED

**Implementation:** `scripts/release-readiness.ts:377-429`

The repair does not weaken the previously reviewed contract:

- `reviewedSha` derives from `<candidate>^`;
- merge successors are rejected;
- the successor diff is NUL-delimited and rename detection is disabled;
- only the exact tag-specific audit and checklist paths are allowed;
- both candidate entries must be `100644` blobs;
- the audit must name the derived parent and previous release;
- both artifact content checks address the immutable candidate object.

The unchanged release workflow passes `${{ github.sha }}` as `--sha` at `.github/workflows/release-train.yml:54-64`, retaining final-CI binding to the successor rather than its reviewed parent.

## Inherited Coverage

This was a two-finding repair review, not a renewed review of every prior disposition.

- The reviewed-parent and attestation-only portions of CR-07 were re-inspected and remain intact.
- CR-07/WR-03 and WR-02 received fresh closure above.
- CR-01 through CR-06, CR-08, and WR-01 were not re-reviewed here. Their earlier dispositions are neither changed nor independently reasserted by this report.
- Commit `159bffbd` contains audit-evidence normalization only and was not treated as product implementation.

## Verification Evidence

No tests or package commands were executed by this read-only review lane.

Inspected parent-provided evidence reports:

- both new mutation arms fail on pre-repair behavior and preserve byte-identical restoration hashes;
- all eleven prior mutation arms were rerun, failed as expected, and restored exact hashes;
- release-readiness suite: 36 pass, 0 fail, 75 assertions;
- combined targeted suite: 146 pass, 0 fail, 505 assertions across 15 files;
- full root-check equivalent: exit 0, 199/199 tasks, 197 cached, 621 ms;
- deploy suite: 64 pass, 0 fail, 329 assertions;
- standards gate: 67 checked, 5 scaffold-skipped;
- aggregate reported total: 7,029 pass, 0 fail, 28,203 assertions.

`git diff --check` was clean for the exact reviewed range. The reviewed implementation and test paths have no working-tree delta from the candidate.

## Disclosures and Limits

- This is not a new cumulative audit of the 430 paths changed since `v2026.08.18`.
- The live-branch graph service was unavailable in this governed lane. Cross-file analysis used full named-source reads, Git history/diffs, and bounded literal call-site inspection.
- The separate renewed security verdict remains pending; this clean code-review verdict permits that review to proceed.
- Parent-owned uncommitted audit evidence was not treated as candidate product content.
- No live probes, credentials, push, PR, merge, tag, publication, deployment, migration, or branch deletion occurred.
- Future version/tag/attestation SHA, 52-package pack proof, drained changesets, aggregate source-of-truth state, live-hybrid checklist evidence, and final R4 tag-bound audit remain later release acts and are not asserted here.
- R344’s OS-only runtime policy and existing application-CVE disclosures are unchanged.

## Disposition

**PASS WITH DISCLOSURES.**

There is no code-review blocker. CR-07/WR-03 and WR-02 are closed, and the parent may proceed to the required renewed security review.

---

_Reviewed: 2026-09-16T15:54:24Z_
_Reviewer: Codex (gw-code-reviewer)_
_Depth: deep_
