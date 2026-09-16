# Security Audit — S8_REPAIRS_2 / R370–R371

**Verdict: BLOCKED**

**Base:** `c6156d8ce916ced54fba3309b6999c9a7a73167a`
**Head:** `23966290343c342d2fcf81775c73d98151223fb1`
**Closed:** 8/9 | **Open:** 1/9
**Security blocker:** CR-07 remains partially open because checklist validation is not bound to the candidate Git object.

The security verdict is stricter than the completed code-review verdict. CR-08 and WR-01 are closed. R370’s core reviewed-parent and attestation-only successor logic is present, but one declared release-integrity property is absent: the checklist’s contents are read from the mutable worktree.

## Blocking finding

### CR-07 / WR-03 — Candidate checklist is not blob-bound

**Severity:** BLOCKER
**Category:** Release integrity
**Status:** OPEN

The allowlist correctly includes the tag-specific audit and checklist paths, and the candidate commit’s tree entries are checked as regular blobs. However:

- `auditSuccessorIsValid()` reads the audit from the candidate with `git show` at `scripts/release-readiness.ts:414`.
- `checkChecklist()` instead uses `readFileSync(path, "utf8")` against the current workspace at `scripts/release-readiness.ts:435-445`.
- The entry point calls these independently at `scripts/release-readiness.ts:503-504`.
- The release workflow runs installation steps between checkout and readiness evaluation.

Concrete failure path:

1. Candidate B contains an incomplete checklist blob.
2. After checkout, the workspace copy is changed to mark every item complete.
3. The candidate tree and attestation-only diff checks still pass.
4. `checkChecklist()` reads the modified workspace copy and passes.
5. Release readiness reports success even though the candidate Git object contains an incomplete checklist.

A clean checkout reduces the normal operational likelihood but does not establish immutable candidate-byte validation. No test covers a dirty checklist differing from the candidate blob.

**Required remediation:** read the checklist through `git show ${sha}:${checklistPath}`—or an equivalent candidate-object API—and evaluate completeness from those bytes. Add a regression where the committed checklist is incomplete but the worktree copy is complete.

## Non-blocking warning

### WR-02 — Git object bytes are normalized before frontmatter validation

**Severity:** WARNING
**Category:** Audit canonicalization

The generic Git runner applies `.trim()` at `scripts/release-readiness.ts:93-99`. Consequently, the audit source obtained at line 414 has leading whitespace removed before `auditSourceIsValid()` checks that frontmatter begins at byte zero.

This defeats the stated canonical byte-zero constraint, but it does not bypass the strict schema, `status: clean`, reviewer identities, or reviewed-parent SHA checks. It is therefore a warning rather than a security blocker.

Use a raw-output Git helper for blob reads and add a leading-whitespace rejection test.

## Per-finding disposition

| Finding                                               | Status   | Security evidence                                                                                                                                                                                          |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-01 — mutable approval envelope                     | CLOSED   | Digest covers the immutable proposal and expiry; execution consumes the stored record, revalidates expiry and policy, and reruns schema transformation before spawning.                                    |
| CR-02 — embed DNS/private-address SSRF                | CLOSED   | `embed-scrub-guard.ts` resolves and rejects private/non-public addresses immediately before the credential-bearing fetch; redirects are rejected. The documented DNS resolve/fetch race remains disclosed. |
| CR-03 — missing account hint could duplicate checkout | CLOSED   | Checkout resolves a server-verified membership, scopes entitlement reads and Paddle creation to the same account, and rejects an unverified explicit selection.                                            |
| CR-04 — staging smoke omitted negative access checks  | CLOSED   | Every enumerated staging service runs anonymous vanity-origin and raw `run.app` denial checks; Access credentials are excluded from negative probes.                                                       |
| CR-05 — runtime image matrix not release-required     | CLOSED   | `runtime-images-gate` is in release readiness and requires both matrix selection and every runtime scan result to succeed.                                                                                 |
| CR-06 — audit artifact validated only by filename     | CLOSED   | Schema-v2 contents, clean status, reviewer identities, reviewed SHA, regular-blob mode and candidate audit bytes are validated. WR-02 is a narrower canonicalization warning.                              |
| CR-07 — self-referential/final-candidate attestation  | **OPEN** | The reviewed-parent and exact successor-diff portions are present, but checklist contents remain worktree-bound rather than candidate-blob-bound.                                                          |
| CR-08 — checkout membership errors silently fall back | CLOSED   | Commerce session and membership errors propagate into the generic 503 boundary; dashboard fallback remains isolated. Tests cover resolver failure without entitlement/Paddle calls.                        |
| WR-01 — pending approvals exhaust capacity            | CLOSED   | Atomic rejection, fifteen-minute expiry, pruning on put/reject, expired-consume refusal and post-await executor expiry validation are present.                                                             |

## Repair verification details

### R370 release attestation

Verified:

- Schema v2 binds `reviewed_sha` to the candidate’s single parent.
- Merge successors are rejected.
- Diff enumeration is NUL-delimited with rename detection disabled.
- Only the exact audit and checklist paths are allowed.
- Both allowed tree entries must be regular `100644` blobs.
- Audit content is loaded from the candidate.
- Final workflow evaluation receives the release tag and `github.sha`.
- Scratch-repository tests exercise product-path, neighboring-path and wrong-reviewed-SHA rejection.

Not verified:

- Candidate-blob checklist contents.
- Leading-whitespace rejection on raw committed audit bytes.

### R371 checkout isolation

Verified:

- `getCheckoutSession()` does not convert membership/provider errors to an anonymous personal account.
- `resolveCheckoutAccount()` verifies the selected account against memberships and rejects explicit mismatches.
- Session resolution occurs inside the checkout route’s generic failure boundary.
- Entitlement reads and Paddle transaction creation use the same verified account.
- The dashboard-specific availability fallback remains separate.
- Production-route tests cover membership failure, forged account selection, provider failure, personal and organization success, missing session and empty memberships.

### Approval rejection and expiry

Verified:

- Fixed TTL is 900,000 milliseconds.
- Expiry is included in the public schema and proposal digest.
- Memory-store rejection deletes atomically without spawning.
- Consume deletes before returning and refuses expired records.
- Put/reject prune expired capacity.
- The executor rechecks expiry after awaited consume.
- Digest comparison uses `timingSafeEqual`.
- Tests cover 1,000-slot rejection and expiry recovery, boundary expiry, both reject/consume race orders, client expiry mutation and durable-adapter expiry defense.

No production durable approval-store adapter was found in the reviewed scope. Atomic consume/reject and cleanup remain mandatory for future adapters. Authorization of `reject()` remains the embedding application’s responsibility, as documented by ADR-0427.

## Additional security-sensitive seams inspected

The audit also inspected the named high-risk seams for preservation of existing controls:

- Better Stack adapter authentication and bounded input
- WORM transparency anchoring and TSA imprint validation
- Site session-cookie and auth-server hardening
- Paddle transaction construction and account scoping
- Demo proxy origin, credential-header and redirect controls
- Production origin-gate fail-closed behavior
- Cloudflare Access JWT issuer/audience/algorithm checks
- License-service token checks, tenant scoping and webhook verification
- Deployment-time database requirements
- Transaction-scoped RLS context and forced-RLS generation
- Support-bot billing-grant authentication, request limits and role hierarchy
- Staging smoke-test origin discovery and denial probes
- Runtime image census and OS-package blocking policy
- Release, publish, version-PR, mirror-sync and image-publish workflows

No additional declared-mitigation gap was established in those reads.

## Disclosures and limits

- This was a three-repair security review with targeted cumulative seam inspection, not a fresh exhaustive audit of all 430 paths since `v2026.08.18`.
- Parent-supplied results report 142 targeted tests and 7,029 aggregate tests passing, plus mutation checks and a green full root check. This read-only lane inspected the corresponding source and test cases but did not execute commands.
- R344’s OS-fixable image blocking policy is preserved. Application and unfixed CVEs remain disclosure-only under that policy.
- The SSRF resolver still has its documented DNS resolution/fetch TOCTOU residual.
- Checkout exact-SKU entitlement behavior, bundle expansion, concurrent purchases, already-created Paddle transactions and settlement behavior were not expanded beyond prior review coverage.
- No live probes, credentials, publication, tagging, deployment or external effects were performed.
- Future tag/version/attestation SHA, 52-package pack proof, drained changesets, aggregate SOT, live-hybrid checklist evidence and the final R4 tag-bound audit remain later release acts.
- Historic direct bucket-key evidence was not remeasured.
- No phase `asvs_level`, `block_on`, or `## Threat Flags` declaration was present. All explicit CR/WR register entries were treated as mitigations; no accept or transfer disposition was inferred.
- No implementation file was modified. The parent must persist this report as `outputs/audit/s8-r370-371-SECURITY.md`.

## OPEN_THREATS

**Phase:** S8_REPAIRS_2 — R370/R371
**Closed:** 8/9 | **Open:** 1/9
**ASVS Level:** Not declared

### Open

| Threat ID     | Category          | Mitigation expected                                                                     | Files searched                                                                                                       |
| ------------- | ----------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| CR-07 / WR-03 | Release integrity | Validate checklist completeness from the candidate Git blob, not mutable worktree state | `scripts/release-readiness.ts`, `scripts/release-readiness.test.ts`, `.github/workflows/release-train.yml`, ADR-0425 |

**Next:** bind checklist validation to candidate bytes, add the dirty-worktree regression, rerun the targeted mutation and release-readiness suites, then renew the security audit.
