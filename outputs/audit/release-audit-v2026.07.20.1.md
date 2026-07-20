# R4 release audit — v2026.07.20.1 (successor artifact)

**Verdict: PASS — carried forward from the v2026.07.20 audit over an identical
package-bytes tree, plus the repair-scope review below.**

## Scope

The substantive ride content is byte-identical to v2026.07.20: this tag's tree is the
v2026.07.20 attestation commit (`5759f1ea`, tag base `c262c0c7`) plus exactly two deltas,
neither of which touches package source:

1. **One sidecar row correction** — `registry/tarballs.json`: the `@caisson/kernel@0.5.3` row
   deleted and re-recorded from a pristine frozen-lockfile worktree at the tag.
2. **This attestation** — the v2026.07.20.1 checklist + this audit artifact (docs only).

The full cumulative-diff audit for the ride content is on file at
`outputs/audit/release-audit-v2026.07.20.md` (PASS, no blockers; one INFO scope correction,
one watch item) and applies to this tag unchanged — same range, same tree for every audited
surface.

## Repair-scope review (the only new surface)

- **Why the first ride failed:** leg 1's byte gate re-packs every tarball at the tag and
  requires byte-equality with the recorded sidecar row. The kernel 0.5.3 row had been recorded
  by the release-branch sibling-churn refresh under a bun.lock resolution the squashed tag tree
  does not reproduce (the known lock-sensitive kernel-pack class). The gate did its job:
  fail closed, publish nothing.
- **The repair is the gate's own prescription:** pack from a pristine frozen-lockfile checkout
  of the tag tree and record what that computes. The re-recorded shasum equals the byte gate's
  reported computation at the tag exactly — ride 2 is consistent by construction.
- **Integrity of the correction:** one row replaced (delete + re-append via the same
  `ci-publish-step` recording path the version PR uses — never a hand-edit of hash fields);
  every other row untouched; ledger and index untouched; no package source touched. The
  full-tree byte verification (`ci-publish-step --mode publish`, the exact gate code path) was
  additionally run locally against this tree before tagging.
- **Tag placement:** the successor targets the repair chain stacked on `5759f1ea`, not current
  main head — main gained the compliance wave merges after v2026.07.20 (package source changed
  at unchanged, unconsumed versions), which the byte gate would correctly refuse. The chain is
  merged `--no-ff` into main so ancestry checks hold.

## Verdict

No new package bytes, no new claims surface, no new security surface. The v2026.07.20 PASS
stands; the repair itself is narrow, gate-prescribed, and locally re-verified end to end.

_Reviewer: release-audit lane, in-session; repair executed and verified against the gate's own
code path._
