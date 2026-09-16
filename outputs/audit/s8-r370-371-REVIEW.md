---
phase: release-train-2026-09-r370-r371
reviewed: 2026-09-16T14:36:00Z
depth: deep
base: c6156d8ce916ced54fba3309b6999c9a7a73167a
head: 23966290343c342d2fcf81775c73d98151223fb1
repair_commits:
  - a81c537ae0ebc2b7be0c682f84af5840217f6438
  - 18b9c7b7138c5308503c094dc55307867f06f47d
  - 23966290343c342d2fcf81775c73d98151223fb1
files_reviewed: 25
files_reviewed_list:
  - .changeset/s8-bound-tool-approvals.md
  - CLAUDE.md
  - apps/site/app/api/cart/checkout/route.ts
  - apps/site/lib/auth.ts
  - apps/site/lib/cart-routes.test.ts
  - apps/site/lib/cart-routes.ts
  - apps/site/lib/checkout-account.test.ts
  - apps/site/test-fixtures/checkout-account.test.ts
  - docs/adr-index.md
  - docs/releases/TEMPLATE-checklist.md
  - docs/state/decisions-and-forks.md
  - knowledge/decisions/ADR-0425-bind-release-audit-to-reviewed-parent.md
  - knowledge/decisions/ADR-0426-fail-closed-commerce-account-resolution.md
  - knowledge/decisions/ADR-0427-reject-and-expire-pending-tool-approvals.md
  - outputs/audit/release-train-2026-09-RUN-NOTES.md
  - outputs/audit/release-train-2026-09-receipt.md
  - outputs/plans/release-train-2026-09-publish/PLAN.md
  - outputs/specs/release-train-2026-09-publish/SPEC.md
  - packages/tool-exec/README.md
  - packages/tool-exec/src/approval-lifecycle.test.ts
  - packages/tool-exec/src/approval.ts
  - packages/tool-exec/src/index.ts
  - packages/tool-exec/src/tool-exec.ts
  - scripts/release-readiness.test.ts
  - scripts/release-readiness.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
verdict: PASS_WITH_DISCLOSURES
release_readiness: PASS_WITH_DISCLOSURES
---

# R370/R371 Renewed Repair Code Review

**Reviewed:** 2026-09-16T14:36:00Z
**Depth:** deep
**Range:** `c6156d8ce916ced54fba3309b6999c9a7a73167a..23966290343c342d2fcf81775c73d98151223fb1`
**Candidate:** `23966290343c342d2fcf81775c73d98151223fb1`
**Verdict:** **PASS WITH DISCLOSURES**

## Narrative Findings (AI reviewer)

## Summary

All three assigned repair findings are closed at their reported failure paths:

- **CR-07 closed:** schema v2 binds `reviewed_sha` to the final candidate’s single parent. The gate rejects merge successors, nonregular artifacts, and changes outside the two tag-specific paths while final CI remains bound to the successor SHA.
- **CR-08 closed:** checkout now uses a commerce-specific account resolver that propagates membership failures, rejects an unverified explicit account selection, and executes inside the handler’s generic 503 boundary. Dashboard fallback remains separate.
- **WR-01 closed:** pending approvals have digest-bound fifteen-minute expiry, atomic rejection, memory-capacity reclamation, post-consume expiry enforcement, and replay-safe reject/consume races.

No blocking correctness or security defect was found in these remedies.

Two release-gate robustness defects remain. They do not recreate CR-07’s impossible SHA lifecycle and do not bypass the normal clean GitHub checkout by themselves, but they mean the implementation does not yet validate the exact committed artifact bytes as strictly as its documentation claims.

## Warnings

### WR-02: The committed audit is normalized before strict validation

**Classification:** WARNING

**File:** `scripts/release-readiness.ts:93-100,353-358,413-419`

**Relevant code:**

```ts
function run(cmd: string, args: readonly string[], cwd = REPO): string {
  return execFileSync(cmd, [...args], { cwd, ... })
    .toString()
    .trim();
}

const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);

return auditSourceIsValid(
  run("git", ["show", `${tagSha}:${auditPath}`], repo),
  binding,
);
```

**Issue:** `auditSourceIsValid` requires frontmatter to begin at byte zero, but the committed-blob path passes through `run()`, which trims leading and trailing whitespace. Consequently, a committed audit beginning with whitespace is accepted even though the same bytes supplied through `auditArtifactIsValid()` fail the declared strict “file must begin with frontmatter” contract.

This is not currently a verdict bypass—the normalized document still has to satisfy the strict schema—but it makes validation inconsistent and disproves exact committed-byte handling.

**Failure path:**

1. Commit an otherwise valid audit with a leading newline or space before `---`.
2. Direct file validation rejects it because frontmatter is not at byte zero.
3. `auditSuccessorIsValid()` reads the blob through `run()`.
4. `.trim()` removes the invalid prefix.
5. Release readiness accepts the malformed committed artifact.

**Fix:** Read the blob without normalization:

```ts
const auditSource = execFileSync("git", ["show", `${tagSha}:${auditPath}`], {
  cwd: repo,
  stdio: ["ignore", "pipe", "pipe"],
}).toString();

return auditSourceIsValid(auditSource, binding);
```

Add a lifecycle regression proving a committed audit with leading whitespace fails.

### WR-03: Checklist completion is checked in the working tree, not in the tagged commit

**Classification:** WARNING

**File:** `scripts/release-readiness.ts:408-412,434-452`

**Relevant code:**

```ts
for (const path of allowed) {
  const entry = run("git", ["ls-tree", tagSha, "--", path], repo);
  if (!entry.startsWith("100644 blob ")) return false;
}

function checkChecklist(tag: string): void {
  const path = join(REPO, "docs/releases", `${tag}-checklist.md`);
  const unchecked =
    (readFileSync(path, "utf8").match(/^\s*-\s\[\s\]/gm) ?? []).length;
  ...
}
```

**Issue:** `auditSuccessorIsValid()` proves only that the tagged checklist is a regular blob. Its completion status is subsequently evaluated from the mutable working tree. A locally modified or pre-gate-mutated checklist can therefore make readiness green even though the immutable tag still contains unchecked items.

The current release workflow begins with a clean checkout, so this is not an immediate normal-path bypass. It remains a correctness defect in the reusable/local readiness command and creates a fragile dependency on no preceding workflow step ever mutating the checkout.

**Failure path:**

1. Tag successor B with an incomplete `docs/releases/<tag>-checklist.md`.
2. Modify the checkout copy to mark every box complete without committing it.
3. `auditSuccessorIsValid()` accepts B because the tagged path exists as a regular blob.
4. `checkChecklist()` reads the modified filesystem copy.
5. The checklist gate reports green for bytes that are not present in B.

**Fix:** Pass the candidate SHA into `checkChecklist` and read the committed blob with `git show <sha>:<path>` without trimming. Add a regression where the committed checklist is incomplete and a dirty completed working-tree copy cannot rescue it.

## Repair Closure Matrix

| Finding                              | Assessment                   | Evidence                                                                                                                                                                 |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CR-07 self-referential audit SHA     | **Closed**                   | `reviewed_sha` derives from the candidate’s sole parent; final CI remains on the tag SHA; NUL-delimited no-rename diff restricts the successor to two tag-specific paths |
| CR-08 wrong-tenant checkout fallback | **Closed**                   | Production route binds `getCheckoutSession`; membership/provider failures return 503 before entitlement or Paddle work; explicit unverified selections fail closed       |
| WR-01 approval-store exhaustion      | **Closed**                   | Atomic `reject`, fixed expiry, expiry pruning before `put`/`reject`, expired-consume rejection, and executor recheck restore bounded capacity                            |
| Original CR-01 approval mutation     | Closed unchanged             | Private one-shot record, digest binding, current-policy/schema revalidation, spec-owned environment                                                                      |
| Original CR-02 embedding DNS         | Closed with prior disclosure | Resolved guard runs before each request; documented DNS resolve/transport TOCTOU remains                                                                                 |
| Original CR-03 duplicate checkout    | **Closed by CR-08**          | Strict verified commerce account now owns entitlement and transaction scopes                                                                                             |
| Original CR-04 staging denial legs   | Closed with prior limits     | Structural three-leg proof remains; no live probe or middleware attribution claimed                                                                                      |
| Original CR-05 runtime image gate    | Closed unchanged             | Stable aggregate remains in the seven-check readiness set                                                                                                                |
| Original CR-06 audit validation      | **Closed by CR-07**          | The final candidate can now be constructed and validated without requiring a commit to contain its own SHA                                                               |

## Verification and Review Limits

No tests, package commands, live probes, network calls, credentials, or external systems were used.

Supplied evidence—not independently rerun—reports:

- CR-07 suite: 32 pass, 0 fail, 70 assertions; three mutation arms red.
- CR-08 production route: 8 pass, 0 fail, 23 assertions.
- Restored cart/auth suite: 25 pass, 0 fail, 78 assertions, with the operator-accepted pre-existing exit 99.
- WR-01 affected suite: 46 pass, 0 fail, 121 assertions; five mutation arms red.
- Combined affected suite: 142 pass, 0 fail, 500 assertions across 15 files.
- Full root-check equivalent: exit 0, 199/199 tasks.
- Captured aggregate: 7,029 pass, 0 fail, 28,149 assertions.
- Deploy tests: 64 pass, 0 fail, 329 assertions.
- Standards gate: 67 checked, 5 scaffold-skipped.

The live-branch graph service was unavailable under this governed tool surface. Cross-module analysis therefore used named source reads, Git history, and scoped literal call-chain inspection.

A later nonconforming piped literal search was denied. No alternate search was attempted after the denial:

```text
Script error:
Command blocked by PreToolUse hook: BLOCKED: repo-read delegated Codex children may run only bounded read commands. Command: rg -n "\.propose\(|\.execute\(|ToolApproval|approvalId|expiresAt" packages apps | rg "tool|approval|execute|propose"
```

## Disclosures and Unreviewed Areas

- This is a focused review of three repair commits, not a fresh exhaustive review of `v2026.08.18..895849a677cdb2e1a9a48d11b9c73a2ac1a0ae6c`.
- The original 430-path coverage limitations remain.
- The receipt-only `5bd4a97d` evidence additions were not treated as new product implementation.
- The embedding guard’s documented DNS resolution/transport TOCTOU remains.
- Checkout’s previously disclosed concurrent-purchase, already-created-transaction, bundle-expansion, and settlement limits remain.
- Staging denial evidence remains local/structural rather than a live probe.
- R344’s OS-only runtime-image enforcement and known application-CVE disclosures are unchanged.
- Final tag/version/attestation SHA, actual 52-package pack proof, drained changesets, final aggregate source-of-truth state, and live-hybrid/checklist evidence remain later release acts.
- The separate renewed security audit has not run.

## Disposition

**PASS WITH DISCLOSURES.**

There is no code-review blocker preventing the authorized security review from proceeding. WR-02 and WR-03 should be corrected before representing release readiness as exact committed-byte validation or opening the final green release PR.

No merge, version dispatch, tag, publish, deployment, live probe, migration, or branch deletion is authorized or implied.

---

_Reviewed: 2026-09-16T14:36:00Z_
_Reviewer: Codex (gw-code-reviewer)_
_Depth: deep_
