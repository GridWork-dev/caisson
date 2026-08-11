# KICKOFF — consolidation audit 2026-08 (D9 reopened at the board fork-walk)

**Lane:** solo worktree `/home/gw/lab/caisson-wt-consolidation`, branch
`audit/consolidation-2026-08` (cut from `main` @ `45707a1a`). Engine: opencode sol, full fanout.
**AUDIT ONLY — this lane cuts NOTHING.** Deliverable is a report + picker table; every kill/merge
happens in a later execution wave after operator picker rounds. One PR carrying ONLY
`outputs/audit/2026-08-consolidation/**` (open it, leave unmerged — coordinator merges).

Context: the 2026-07 board audit's D9 verdict was "the empty kill list is the finding" (T4).
The operator REOPENED it 2026-08-09: run a real consolidation audit — targeted on the known
candidates, but broad. Prior art to NOT re-litigate: the 2026-08-09 repo audit (42 findings,
ledger `wf_67a45080-ead`) and its executed wave (ADR-0397–0402, PRs #408–#414).

## Targeted seeds (verify counts from disk first — docs may lag)

1. **The LLM adapter surface** — the board counted 8 adapters (TEC-9). Enumerate the real set
   (grep the provider/adapter modules across `packages/ai-*`, `packages/local-ai` is DELETED —
   lane A), per adapter: callers, tests, registry/bundle membership, last meaningful change.
   Question per adapter: would a buyer or the site notice its deletion?
2. **The `agent-*` package family** — now 5 after the agent-usage fold (ADR-0402). Per package:
   distinct buyer story vs overlap; could any pair fold like agent-usage→agent-trajectory did
   (the `./usage` subpath precedent)?
3. **2026-08-09 audit residuals** — findings confirmed but NOT cut in the wave (the audit ledger
   - ADR-0401's skipped list + lane A's PR #412 "Skipped" section). Re-evaluate each: still
     standing? Why?
4. **The tooling/ surface** — 8 dirs post-wave; overlap check (audit-harness vs standards-gate
   checks, demo-registry vs registry scripts, scripts/ sprawl).

## Broad sweep (repo-wide, fanout by domain)

Per domain (packages/ by family · apps/ · tooling/ · registry/ · services/), hunt:

- Single-implementation interfaces, factories with one product, wrappers that only delegate.
- Packages with ≤1 consumer (graph the workspace deps; a sold package with zero site/demo/doc
  surface is a flag, not an auto-kill — sold SKUs have delist rules, see constraints).
- Near-duplicate modules (the egress-guard/embed-scrub and pricebook/token-rates renames from
  ADR-0401 came from exactly this class — find the rest).
- Dead flags/config/env vars nothing reads; exports nothing imports (knip is wired — use it).
- CI jobs/steps whose failure nobody would notice (guard: check the four-CI-gate-classes memory
  — some gates are invisible to local turbo; absence of local effect is NOT dead).

## Method (sol fanout)

Parallel domain sweeps → per-candidate evidence card (path, LOC, callers, registry/bundle
status, revenue exposure, cut shape: DELETE / FOLD-INTO-X / KEEP-frozen / KEEP) → adversarial
verify pass on every DELETE/FOLD (a second pass tries to REFUTE the cut — cite the caller or
surface that kills it) → ranked table, biggest verified cut first.

## Binding constraints

- **Registry ledger is append-only**; a published/sold id retires only via a delist row with
  provenance (ADR-0271, ADR-0402 precedent). Every candidate card MUST state its ledger/index/
  bundle status — a sold-SKU cut proposal must include its delist + grandfathering shape.
- **Out of scope (fresh operator locks, same walk):** the Python seller plane (docs-RAG +
  support-bot — D8 locked KEEP-frozen-at-two-islands 2026-08-09); anything ADR-0397–0402 just
  executed; `packages/ai-kit` (live site importers — ADR-0397 explicitly kept it).
- Report cites evidence per claim (file:line, caller lists, knip output) — no vibes-based cuts.
- No product-code edits, no deletions, no dependency changes in this lane. Report only.

## Deliverable shape

```
outputs/audit/2026-08-consolidation/
  REPORT.md          # method, domains covered, coverage gaps declared
  PICKER-TABLE.md    # ranked: id | cut shape | LOC | evidence | risk | verified-by
  evidence/          # per-candidate cards
```

Proof: every DELETE/FOLD row carries a refute-attempt verdict; coverage gaps are DECLARED (a
domain not swept is listed as not-swept, never silently omitted). `bun run sot` before the PR
(outputs/ additions are sot-neutral but the preflight still runs).

## Hard don'ts

- No cuts, no code edits, no changesets, no ledger writes, no deploys.
- No re-proposing the wave's executed cuts or its explicit keeps.
- No force-push; no merge — the coordinator merges.
