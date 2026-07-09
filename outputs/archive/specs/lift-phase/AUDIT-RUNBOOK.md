# Whole-repo multi-model audit — orchestration runbook (ADR-0188 / F4b · v2: ADR-0233)

The external driver the `@caisson/audit-harness` package deliberately does not own (AGENTS.md
boundary: no checker implementations, no dispatch, no model calls in-package). In gridwork-core this
would be a `claude/playbooks/manual/` skill; Caisson has no skills dir, so the orchestrator is **Claude
Code + a Workflow**, and this runbook is the repeatable procedure. The harness supplies the pure pieces
(`deriveDomains`, `domainForPath`, `applicableDimensions`, `enumerateSurface`, `reconcile`,
`selectValidateCandidates`, `summarize`, the `Challenger` port, `majorityKills`, `isRoundDry`,
`serializeCoverage`); the Workflow supplies the multi-model dispatch, the finders, the critic, and the
challenger.

**v2 (ADR-0233) — what changed from v1:** the domain axis is DERIVED + gated (`deriveDomains()`, not a
hand list), a second axis DIMENSION (`./dimensions.ts`, D1..D7) makes each finder shard a **cell**
(domain × applicable-dimension), the run is a **loop** with an explicit DRY predicate + completeness
critic (not "run again until a critic goes quiet"), and two new buyer-facing lenses (D3/D4) audit the
customer-deliverable packages. Never fable for fan-out (binding, Caisson CLAUDE.md).

## Ports the driver wires

- **Challenger → PAL `challenge`.** `validateHighRisk(finding, challenger)` needs a `Challenger` whose
  `challenge(finding)` returns `{refuted: boolean} | null`. The driver wires it to `mcp__pal__challenge`
  (cross-vendor, per the operator convention) — or an independent skeptic agent prompted to REFUTE
  (default-to-refuted on tie/throw, which `majorityKills` already enforces). Two independent passes;
  survives only if BOTH return `refuted:false`.
- **Checkers → agents / gates, per dimension** (`./dimensions.ts` `checker`, doctrine lanes):
  - D1 security-floor + D2 secret-leakage → `gw-security-auditor` (sonnet)
  - D3 customer-facing + D4 internal-leak + D6 docs-vs-code → `gw-code-reviewer` / copy critic (sonnet)
  - D5 license-tier → `standards-gate` (shell `bun run gate`, deterministic)
  - D7 hygiene → haiku recon + `standards-gate`

## Procedure (one Workflow — the loop)

```
ENUMERATE  (haiku / main): deriveDomains() → coverage-gate.test.ts (fail-loud: every unit claimed) →
                           build the cell list: for each domain, applicableDimensions(domain.class)
                           → cells (domain × dimension). enumerateSurface(domain.globs) → file list.
FAN-OUT    (sonnet + haiku): one finder per cell, routed to the dimension's checker (above), bounded
                           to the cell's file surface. Each returns RawFinding[]
                           {domain, dimension, subject, title, severity}. domain MUST equal the cell's
                           domain (reconcile's universe + scope guards enforce it).
VALIDATE   (PAL challenge ×2, default-to-refuted): high-severity findings only — the majorityKills spine.
SYNTHESIZE (opus, main): reconcile(prev, all, scope=every audited domain, deriveDomains-universe) →
                           throws on id-collision or a mislabeled domain (no silent drop). Write the
                           findings ledger + append this round's coverage rows (one per cell).
CRITIC     (opus): completeness critic — given the derived domains + coverage ledger + tree, NAME any
                           escaped surface or unaudited cell. Feeds isRoundDry().
DRY?       isRoundDry({coverageGateGreen, expectedCells, rows, newFindingIds, criticNamedSurfaces}).
           dry → STOP. not-dry → the returned reasons ARE the next round's work → LOOP.
```

- **`--domains` scope is EVERY domain audited this round** (`reconcile` false-close guard, ADR-0188).
  A single-domain run passes just that domain; every other domain's findings survive unchanged.
- **Coverage ledger** (`outputs/audit/coverage.toml`, `serializeCoverage`): one row per cell per round
  `{round, domain, dimension, files_scanned, findings, executed}`. An unaudited cell is a `report`
  grid gap, not an inference.
- **Persist + report:** `audit-harness reconcile --domains=<audited> findings.json` writes
  `outputs/audit/ledger.toml`; `report` prints the domain × severity × status tally + the coverage grid.

## Termination — the DRY predicate (replaces v1's "run again and see")

A round is DRY iff ALL hold (`isRoundDry`):

1. the coverage gate is green — every tree unit claimed (`coverage-gate.test.ts`);
2. every applicable cell shows `executed:true` in the coverage ledger this round;
3. the round produced zero findings whose id is not already in the ledger (no new/regressed ids);
4. the completeness critic named nothing.

**Coverage-claim adversary** — before declaring DRY, run one skeptic pass (PAL or an independent
agent) prompted _"name one repo surface this run did not audit."_ A non-empty answer is a new cell →
LOOP. This is the adversarial guard on the coverage claim itself, distinct from the per-finding
`validateHighRisk` challenge.

## The two new copy-lens finder prompts (D3 / D4)

Both are `gw-code-reviewer` (sonnet), grounded in `docs/shipped-source-quality-rubric.md` (rule ids
SS-1..SS-14) + ADR-0080. They run ONLY on `oss-source` / `sold-source` / `buyer-runtime` domains
(D4 is output-only on `buyer-runtime`); the harness's `applicableDimensions` already gates the cells.

**D3 — customer-facing / sales-ready quality.** Prompt shape:

> You audit source a BUYER reads. For each file in the cell surface, flag any line violating
> `docs/shipped-source-quality-rubric.md`: gridwork-isms (SS-1), session/wave shorthand (SS-2), bare
> ADR/spec refs as the only explanation (SS-3), issue-tracker refs (SS-4), unprofessional or
> what-not-why comments (SS-5), TODO/FIXME/HACK residue (SS-6), commented-out code (SS-7), README
> claims not true-to-built (SS-9/10/11), weak `package.json` description (SS-12), or debug-dump error
> strings (SS-14). Return RawFinding[] with `dimension:"D3"`, `subject:"path:line"`, and the SS rule
> id in the title. Cite the narrowest rule. Advisory — flag judgement calls with a one-line rationale.

**D4 — internal-vs-sold leak.** Prompt shape:

> You hunt INTERNAL surface leaking into SOLD source. For each file, flag any reference a buyer must
> not see: operator/host names, private infra paths (`apps/admin`, `tooling/`, `infra/`, `~/.gridwork`),
> internal endpoints (Railway grey origins, SigNoz/Grafana/Tempo), sibling private repos, or internal
> repo/session/ADR context presented as if the buyer shares it (SS-1/SS-8). On a `buyer-runtime`
> domain, audit only what a buyer can view-source (rendered output / client bundle), not server-only
> internals. Return RawFinding[] with `dimension:"D4"` + `subject:"path:line"`.

**oss-mirror (Fork D).** The `oss-mirror` domain is synthetic: run `scripts/export-public-mirror.ts`
in the round, then run D3/D4/D5 over its OUTPUT (the `@caisson/`→`@caisson-sh/` rename, dropped tests,
restamped licenses) — the export view catches a dangling internal specifier the in-repo source cannot.

## Invocation sketch (Workflow, run by Claude Code)

```
round r:
  cells = for each deriveDomains() domain, applicableDimensions(class) → (domain × dimension)
  phase('Fan-out'):  parallel over cells → finder agent per cell (checker over enumerateSurface) → RawFinding[]
  phase('Validate'): parallel over open-high → PAL-challenge ×2 (default-to-refuted) → confirmed set
  reconcile(prev, all, auditedDomains, deriveDomains-universe) → write ledger + append coverage rows
  critic(opus) + coverage-adversary → named surfaces
  isRoundDry(...) ? STOP : LOOP(r+1) with the reasons as the worklist
```

Non-blocking by construction (ADR-0134/0233): the audit informs the next build wave; it never gates a
merge. Promoting the coverage gate + D3/D4 into `standards-gate` as blocking checks is a SEPARATE
follow-up, only after a clean v2 baseline (ADR-0233 Fork B).
