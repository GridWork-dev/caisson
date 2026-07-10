# ADR-0315 — Close-out triage picker locks (all four specs armed + three mechanism locks)

**Status:** accepted · 2026-07-10 (three-stream close-out picker, same sitting as the PR #200
merge). **Tags:** `security`, `billing`, `ai`, `frontend`. Locks the direction of the
`outputs/specs/close-out-triage/` DRAFT set so execution can proceed without re-asking.

## Context

The 2026-07-10 three-stream close-out (Kickoff-I perf/mobile · Kickoff-J pricing-gtm verification
· Kickoff-K security round-2) triaged every deferred item and non-essential-CI finding into four
DRAFT specs. Per the one-operator rule the specs tabled their forks for a picker rather than
auto-deciding. The picker ran the same sitting.

## Decision

1. **All four specs are ARMED (DRAFT → LOCKED):** `SPEC-retrieval-quality-battery-v2`,
   `SPEC-security-scan-findings-triage`, `SPEC-affiliate-production-flip`,
   `SPEC-perf-followups`. Execution is a normal SPEC→PLAN→EXECUTE pickup from here; nothing in
   this ADR authorizes skipping the remaining acts.
2. **JSON-LD posture (scan-triage F1): shared helper refactor.** One `jsonLdScript()` helper
   serializes + escapes (`<` → `<`) once; all 8 `apps/site` schema.org sites move onto it and
   un-flag structurally. Inline suppressions REJECTED — the operator prefers the structural fix.
3. **Digest pins (scan-triage F2): wire Renovate.** The Renovate GitHub app on the `caisson-sh`
   org owns continuous `@sha256` digest bumps; `--strict-digests` flips once the first Renovate
   pin wave merges. The app install is an operator act (org admin) — tracked in the tracker §1
   security-stack row. Manual one-shot pinning REJECTED as the standing mechanism.
4. **Refund-policy corpus (battery-v2 F1): make it answerable.** A refund-policy docs page joins
   the corpus so the support bot answers with citation instead of escalating. Rider: the docs
   page must cite the site legal page as its source of truth (one canonical text, the docs page
   summarizes + links) so the two surfaces cannot drift silently.

## Consequences

- The `deterministic` CI job has a named path to green-and-meaningful (helper refactor + CVE
  triage + SARIF upload fix + Renovate pins + strict flip).
- The affiliate `discount_id` capture is confirmed pre-production-flip scope (billing tag — the
  security audit fires at its SHIP).
- The support bot's refund behavior changes from escalate to cited-answer once battery-v2
  executes; the battery report must include the refund-question leg as evidence.
- Renovate becomes a repo vendor (app install operator-owed; config lands with the scan-triage
  execution).
