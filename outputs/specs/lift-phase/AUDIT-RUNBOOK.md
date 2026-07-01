# Whole-repo multi-model audit — orchestration runbook (ADR-0188 / F4b)

The external driver the `@caisson/audit-harness` package deliberately does not own (AGENTS.md
boundary: no checker implementations, no dispatch, no model calls in-package). In gridwork-core this
would be a `claude/playbooks/manual/` skill; Caisson has no skills dir, so the orchestrator is **Claude
Code + a Workflow**, and this runbook is the repeatable procedure. The harness supplies the pure pieces
(`enumerateSurface`, `reconcile`, `selectValidateCandidates`, `summarize`, the `Challenger` port,
`majorityKills`); the Workflow supplies the multi-model dispatch + the challenger.

## Ports the driver wires

- **Challenger → PAL `challenge`.** `validateHighRisk(finding, challenger)` needs a `Challenger` whose
  `challenge(finding)` returns `{refuted: boolean} | null`. The driver wires it to `mcp__pal__challenge`
  (cross-vendor, per the operator convention) — or, inside a Workflow, to an independent skeptic agent
  prompted to REFUTE (default-to-refuted on tie/throw, which `majorityKills` already enforces). Two
  independent passes; survives only if BOTH return `refuted:false`.
- **Checkers → agents / gates.** Per `AUDIT_DOMAINS[].checkers`: `gw-security-auditor` (agent dispatch)
  for `security`/`rls-tenancy`/`evidence-compliance`; `standards-gate` (shell `bun run gate`) for
  `licensing-spdx`/`standards-gate`; `tooling/design-critic` (shell) for `design-ui`.

## Procedure (one Workflow, pipeline by domain)

1. **Enumerate.** For each `AUDIT_DOMAINS` entry, `enumerateSurface(domain)` → the concrete file list
   (vendor/build dirs already excluded). This bounds each finder to its real surface.
2. **Dispatch (fan out).** One finder per domain → its checker(s) over the enumerated surface. Each
   returns a structured `RawFinding[]` (`{domain, subject, title, severity}`) via a StructuredOutput
   schema. `domain` MUST equal the audited domain id (the reconcile fail-loud guard enforces it).
3. **Reconcile — scope is EVERY domain audited this run.** Load the prior ledger, then
   `reconcile(previous, allFindings, scope)` where `scope = AUDIT_DOMAINS.map(d => d.id)` for a
   whole-repo run (or the subset for a partial run). **This is the must-fix:** a partial run passes the
   subset it audited, so un-audited domains' findings pass through untouched — never false-closed.
4. **Validate open-high.** `selectValidateCandidates(ledger)` → for each, `validateHighRisk(f, palChallenger)`
   twice. A finding that does not survive both passes is suppressed from the "confirmed" set (kept in the
   ledger, not escalated). Advisory: never throws, never gates.
5. **Persist + report.** Write the ledger via the CLI (`audit-harness reconcile --domains=<audited> findings.json`)
   and print `report` (counts by domain × severity × status + the open-high list). Commit the ledger as
   the persisted cross-run source of truth (operator hand-edits only `status`: open→accepted to triage).

## Scope discipline (the whole point of ADR-0188)

- `--domains` is REQUIRED and lists exactly the domains audited **this** run. Never inferred.
- A whole-repo run: `--domains=security,rls-tenancy,licensing-spdx,design-ui,standards-gate,evidence-compliance`.
- A single-domain run: `--domains=security` — every other domain's open findings survive unchanged.
- A `RawFinding` whose `domain ∉ --domains` aborts the reconcile (fail-loud) — fix the scope, not the finding.

## Invocation sketch (Workflow, run by Claude Code)

```
phase('Audit'):  parallel over AUDIT_DOMAINS → finder agent per domain (checker over enumerateSurface) → RawFinding[]
phase('Validate'): parallel over open-high → PAL-challenge ×2 (default-to-refuted) → confirmed set
then: reconcile(prev, allFindings, auditedDomainIds) → write ledger → report
```

Non-blocking by construction (ADR-0134): the audit informs the next build wave (lift slice-1 sellables,
then slice-2 hardening); it never gates a merge.
