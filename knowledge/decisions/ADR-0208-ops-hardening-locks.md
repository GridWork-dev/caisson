# ADR-0208 — ops-hardening locks: owner-only tenant writes · branch-protection extras · TF-state defer · OSCAL rlink won't-fix

**Status:** accepted · 2026-07-02 (edition-tails-ops kickoff — operator lock, picker round 2026-07-02).
**Relates:** ADR-0176 (org `account_member`), ADR-0183 (BYOK submission edge), ADR-0179–0181 (OSCAL
export), ADR-0107 (go-live checklist step 8 — the original TF-state defer), ADR-0178 (members-fold — the
republish this round executes).

## Context + decisions (five small locks from the 2026-07-02 picker round)

1. **BYOK + attestation writes are owner-only** (fixes confirmed Strix vuln-0006, CWE-863). The BYOK
   submission route and the compliance attestation server actions gated only on session presence — any
   `seat` member could rotate org provider keys or rewrite attestations feeding the SAR/POA&M export. Lock:
   writes require `session.role === "owner"` via one shared authz helper (the members-page precedent);
   reads (masked last-4 BYOK metadata, attestation state) stay seat-visible. Rejected: a broader
   allowed-role set (roles today are only `owner|seat`); won't-fix.
2. **Branch protection on `main` hardens three notches**: the `oscal-conformance` job (the ground-truth
   NIST oscal-cli round-trip, unconditional so no stuck-PR risk) joins the required status checks;
   `enforce_admins` on (no admin bypass); `strict` up-to-date-before-merge on (accepted rebase friction).
   Rejected: leaving OSCAL conformance advisory while selling compliance exports.
3. **Terraform state migration stays deferred, now with a documented reason**: research confirmed R2
   silently ignores S3 conditional-write headers, so Terraform ≥1.10 `use_lockfile` is a **no-op on R2** —
   "R2 + lock" as the backlog item was titled is not achievable with the stock S3 backend. Single operator,
   zero CI applies ⇒ no active trigger (ADR-0107's posture holds). The trigger (second operator or CI
   apply) and the locking-gap finding are recorded in `infra/terraform/README.md` + `docs/operations.md` so
   a future migration picks a locking posture consciously (real options then: accept-no-lock on R2, a
   Worker/DO lock backend, or AWS S3+DynamoDB). Rejected now: R2-without-locking migration; AWS S3+DynamoDB.
4. **OSCAL back-matter `rlink` hosting is won't-fix**: the citation URL
   (`caisson.sh/oscal/assessment-plan/<framework>.json`) is not served and won't be — external href
   resolution is explicitly outside the conformance gate; a dead citation link does not justify a route.
5. **The ADR-0178 republish executes as ledger/index-only**: `changeset version` consume (editions
   0.1.0→0.2.0 + all riding pending bumps), ledger append + deterministic index rebuild, with
   `CAISSON_PUBLISH_DRY_RUN` staying `"true"` — the real GitHub-Packages publish flip remains its own
   operator act (ADR-0069/0111), and the registry Worker redeploy rides the standing P0 redeploy act.
