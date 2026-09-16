# Security Audit — S8_REPAIRS_3 / R373

**Verdict: PASS WITH DISCLOSURES**

**Base:** `23966290343c342d2fcf81775c73d98151223fb1`
**Head:** `98a3501d1e3cdf2e30955b1f7d6d4345cac5e732`
**Scoped findings:** 2 closed, 0 open
**Inherited threat register:** 9/9 closed
**New findings:** None

The prior CR-07/WR-03 blocker and WR-02 warning are closed. The security gate no longer blocks proceeding to the authorized green release PR steps.

## Scoped closure findings

### CR-07 / WR-03 — Candidate checklist blob binding

**Previous severity:** BLOCKER
**Category:** Release integrity
**Status:** CLOSED

The checklist is now evaluated from the candidate Git object, not the mutable working tree:

- `checkChecklist()` validates the tag and full lowercase SHA, then calls `readGitBlob(repo, sha, path)` at [scripts/release-readiness.ts:440](/home/gw/lab/worktrees/caisson/release-train-2026-09/scripts/release-readiness.ts:440).
- The entry point passes the same parsed `sha` to both `checkAuditArtifact(tag, sha)` and `checkChecklist(tag, sha)` at [scripts/release-readiness.ts:503](/home/gw/lab/worktrees/caisson/release-train-2026-09/scripts/release-readiness.ts:503).
- The workflow supplies `github.sha` as `--sha` through a quoted environment value at [.github/workflows/release-train.yml:54](/home/gw/lab/worktrees/caisson/release-train-2026-09/.github/workflows/release-train.yml:54).
- Missing objects, invalid references, malformed identifiers, and unreadable blobs enter the catch branch, record failure, and return `false`.
- Any failed recorded result makes the direct gate exit nonzero.

The former failure path is stopped: an incomplete candidate checklist remains incomplete when read with `git show <candidate>:<path>`; a completed dirty copy is never consulted.

Real-Git regressions at [scripts/release-readiness.test.ts:139](/home/gw/lab/worktrees/caisson/release-train-2026-09/scripts/release-readiness.test.ts:139) establish:

- committed complete / dirty incomplete → passes;
- candidate blob absent / working-tree copy present → fails;
- committed incomplete / dirty complete → fails;
- the audit-successor check remains true in the last case, isolating checklist validation as the rejecting control.

### WR-02 — Raw committed audit bytes

**Previous severity:** WARNING
**Category:** Audit canonicalization
**Status:** CLOSED

Both committed artifact reads now pass through the raw helper at [scripts/release-readiness.ts:102](/home/gw/lab/worktrees/caisson/release-train-2026-09/scripts/release-readiness.ts:102):

```ts
execFileSync("git", ["show", `${sha}:${path}`], {
  cwd: repo,
  stdio: ["ignore", "pipe", "pipe"],
}).toString("utf8");
```

Security properties verified:

- No shell is involved; command components remain separate argv entries.
- `sha` is constrained to forty lowercase hexadecimal characters.
- The tag is schema-constrained, and artifact paths are constructed from fixed directory/suffix templates.
- No `.trim()` or other normalization occurs.
- The audit parser’s frontmatter expression remains anchored at byte zero at [scripts/release-readiness.ts:361](/home/gw/lab/worktrees/caisson/release-train-2026-09/scripts/release-readiness.ts:361).
- Git/read/parser errors are caught and return `false`.

The previous bypass is therefore stopped: a leading newline remains in the committed source, the byte-zero frontmatter expression fails, and readiness records a failed audit.

The real-Git regression at [scripts/release-readiness.test.ts:128](/home/gw/lab/worktrees/caisson/release-train-2026-09/scripts/release-readiness.test.ts:128) commits a leading-newline audit, repairs only the dirty working copy, and confirms candidate validation still fails.

## Reviewed-parent contract

ADR-0425’s attestation-only contract remains intact:

- the reviewed SHA is derived from `<candidate>^`;
- merge candidates are rejected;
- the successor diff is NUL-delimited with rename detection disabled;
- changed paths are restricted to the exact tag-specific audit and checklist paths;
- both candidate entries must be regular `100644` blobs;
- the audit schema requires a clean result, zero critical findings, both reviewer roles, and the derived parent SHA;
- final CI remains bound to the successor SHA supplied by the release workflow.

No stale production caller of the former `checkChecklist(tag)` signature was found.

## Threat disposition

| Threat                                              | Disposition | Status                                        | Audit basis                                                         |
| --------------------------------------------------- | ----------- | --------------------------------------------- | ------------------------------------------------------------------- |
| CR-01 — mutable approval envelope                   | Mitigate    | CLOSED, inherited                             | Prior security audit; not re-audited in R373                        |
| CR-02 — embedding DNS/private-address SSRF          | Mitigate    | CLOSED, inherited with documented DNS race    | Prior security audit; not re-audited in R373                        |
| CR-03 — duplicate/wrong-account checkout            | Mitigate    | CLOSED, inherited                             | Prior security audit; not re-audited in R373                        |
| CR-04 — missing staging denial legs                 | Mitigate    | CLOSED, inherited with local-only proof limit | Prior security audit; not re-audited in R373                        |
| CR-05 — runtime image matrix not required           | Mitigate    | CLOSED, inherited                             | Prior security audit; not re-audited in R373                        |
| CR-06 — filename-only audit validation              | Mitigate    | CLOSED, inherited; raw-byte path rechecked    | Candidate blob and byte-zero validation inspected                   |
| CR-07 — reviewed-parent/final-candidate attestation | Mitigate    | **CLOSED, freshly verified**                  | Candidate identity, immutable checklist bytes, parent/diff contract |
| CR-08 — commerce membership fallback                | Mitigate    | CLOSED, inherited                             | Prior security audit; not re-audited in R373                        |
| WR-01 — approval-store exhaustion                   | Mitigate    | CLOSED, inherited                             | Prior security audit; not re-audited in R373                        |
| WR-02 — normalized committed audit                  | Mitigate    | **CLOSED, freshly verified**                  | Raw Git stdout and leading-newline regression                       |

No accept or transfer dispositions were declared. No current phase `SUMMARY.md` or `## Threat Flags` register exists, and no unregistered implementation flag was established in the scoped repair.

## Verification evidence

This read-only audit did not execute tests or package commands. Inspected parent evidence reports:

- both new regressions red before repair and green afterward;
- both guard mutations red, with byte-identical restoration hashes;
- all eleven earlier mutations red with exact restoration;
- release-readiness suite: 36 pass, 0 fail, 75 assertions;
- combined targeted suite: 146 pass, 0 fail, 505 assertions across 15 files;
- full root-check equivalent: exit 0, 199/199 tasks, 197 cached;
- deploy suite: 64 pass, 0 fail, 329 assertions;
- standards gate: 67 checked, 5 scaffold-skipped;
- aggregate captured tests: 7,029 pass, 0 fail, 28,203 assertions.

An independent `git diff --check` for the exact base/head range was clean. The two implementation/test files have no working-tree delta from the candidate.

## Disclosures and limits

- This was a focused renewal for CR-07/WR-03 and WR-02, not a fresh exhaustive audit of the 430-path cumulative release.
- CR-01 through CR-06, CR-08, and WR-01 retain the earlier audit’s dispositions and limitations; they were not silently re-audited.
- Evidence-only commit `159bffbd` was not treated as product implementation.
- R344’s OS-only runtime-image policy and existing application/unfixed-CVE disclosures remain unchanged.
- The embedding DNS resolution/transport race remains a documented residual risk.
- Future version/tag/attestation SHA, 52-package pack proof, drained changesets, aggregate SOT, live-hybrid checklist evidence, and final R4 tag-bound audit remain later release acts.
- No live probes, credentials, push, PR, merge, tag, publish, deployment, migration, or branch deletion occurred.
- The workspace contained pre-existing parent-owned changes and evidence. This audit modified nothing.

## SECURED

**Phase:** S8_REPAIRS_3 — R373
**Threats Closed:** 9/9
**ASVS Level:** Not declared

### Unregistered Flags

None.

**SECURITY.md:** Parent should persist this report as `outputs/audit/s8-r373-SECURITY.md`.
