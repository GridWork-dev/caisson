# ADR-0344 — Per-row verification PLAN locks: signed anchors, dedicated key, admin+tenant v1 scope

Status: accepted · 2026-07-13 (operator picker round over `outputs/plans/per-row-verification-ui/PLAN.md` §5, same sitting as the PLAN fanout; extends ADR-0331)

## Decision

1. **GATE-1 — anchor trust-root provenance: SIGNED ANCHORS (Option 2, the security lane's
   recommendation — overrides the PLAN author's honest-downgrade recommendation).** Anchors are
   signed at mint; the client and the offline pack verifier check the signature against a pinned,
   out-of-band public key. The operator weighted "the demo an auditor evaluates must be genuinely
   tamper-evident on day one" above scope. Consequences: T-W2 (append-path signing) becomes an
   UNCONDITIONAL task — `sig`+`keyId` land as additive optional anchor fields (never a
   chain-format break; legacy unsigned anchors stay structurally valid); the change carries
   `security`/`secrets` tags and its own dedicated SHIP audit; seal copy = "verified against
   write-once anchor (signature-checked)", never "impossible to tamper".
2. **GATE-1a — anchor-signing key identity: a DEDICATED anchor-signing keypair**, never the
   license issuer key. Domain separation: an anchor-key compromise must not forge licenses, and
   license-key rotation must not invalidate anchor verification history.
3. **GATE-2 — v1 endpoint scope: ADMIN + TENANT ROUTE BOTH IN V1 (overrides the admin-only
   recommendation — a deliberate scope expansion).** The operator route keeps its contract
   (validated-UUID target account, in-handler requireAdmin, access-logging, rate-limit). The
   tenant self-service route is a SECOND endpoint with the strict CR-07 contract: `accountId`
   derived exclusively from the session (no such request field exists), RLS-scoped reads,
   cross-tenant-denial + missing-anchor-fail-closed tests. The two contracts are never conflated
   (the H1 IDOR class). Sequencing: the tenant dashboard view touches `apps/site` — frozen this
   wave — so the tenant-route task group is planned now and EXECUTEs after the Kickoff-S freeze
   lifts; the PLAN gains this task group at its EXECUTE-time refresh.
4. **GATE-3 — redaction predicate home: `@caisson/kernel/redact`** (pure predicate moves to an
   Apache kernel subpath; ui-pro re-exports). Keeps the endpoints' server-side redaction
   dependency-clean and lets the open standalone verifier name the same redaction semantics.
5. **GATE-4 — ProofPanel home: `audit-worm/src/ui`**, reusing ui-pro's PayloadViewer and
   accepting the new `audit-worm/ui → ui-pro` dependency (both commercial; no open-core issue).
   AuditTimeline still takes statuses as props — no reverse dependency.
