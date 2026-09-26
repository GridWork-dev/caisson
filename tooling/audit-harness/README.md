# @caisson-sh/audit-harness

The cross-domain audit/validate harness (ADR-0134 · v2: ADR-0233) — the pure library behind the
whole-repo audit. Internal engineering tooling: **not sellable**, no registry `manifest.ts`,
**non-blocking to a merge** (it never gates `bun run check` or a commit). The loop, fan-out, and
critics live in the driver (`outputs/archive/specs/lift-phase/AUDIT-RUNBOOK.md`), never in-package.

## What it gives you

- **Two clean axes (ADR-0233).** DOMAIN = WHERE (a tree partition), DIMENSION = WHAT (an audit lens).
  - `deriveDomains(root)` — one domain per tree unit (`packages/*`, `apps/*`, `services/*`, registry
    units, `tooling/*`, `infra/*`, workflows, generator templates, docs-content, scripts, the
    synthetic oss-mirror export view), each carrying a **surface class** read from
    `docs/state/public-surface.md` + package license. Derived, never hand-typed;
    `coverage-gate.test.ts` fails loud on any unclaimed or double-claimed tree unit. `domainForPath`
    resolves the single owner of any path (longest-root match).
  - `DIMENSIONS` (D1..D8: security-floor · secret-leakage · customer-facing quality · internal-vs-sold
    leak · license-tier · docs-vs-code · hygiene · visual-quality) + `applicableDimensions(class,
domainId)` — the sparse cell matrix. Mostly class-keyed (`oss-source`/`sold-source` = {D1..D7}),
    with two DOMAIN-keyed riders where class is the wrong axis: **D5** re-applies to an
    `internal-only` domain only when it is a `packages/*` unit, and **D8** applies to `apps/*` and
    nothing else (ADR-0411). **Always pass `domainId`** — omit it and both riders silently drop, so
    D8 never fires at all.
- **One cross-domain reconciling ledger.** `Finding`/`RawFinding`/`reconcile()` — new/unchanged/
  regressed/closed semantics keyed on a dimension-aware stable id
  `sha256(domain ∷ dimension ∷ subject ∷ normalized-title)[:16]`; rewording a title never forks a
  finding. `reconcile()` fails loud on an id collision, an out-of-scope domain, or a domain outside
  `deriveDomains()` — no silent drop. `serializeFindings`/`parseFindings` round-trip a hand-rolled
  TOML `[[finding]]` array-of-tables.
- **Per-round coverage ledger + DRY oracle.** `serializeCoverage`/`parseCoverage` persist one
  `[[cell]]` row per audited (domain × dimension) per round; `isRoundDry(...)` is the loop's explicit
  termination predicate (gate green + every cell executed + no new ids + critic silent).
- **Workflow-scope guard.** `checkScope(declaredDomains, touchedPaths, domainGlobs)` — pure, flags
  any touched path inside a domain's globs whose domain isn't declared (scope creep).
- **`/validate` spine — high-risk only.** A `Challenger` port (one method: `challenge(finding)`) +
  pure `majorityKills(verdicts)` + `validateHighRisk(finding, challenger)`. A `severity: "high"`
  finding is challenged **twice**, independently; it survives only if **both** passes explicitly say
  `refuted: false`. A tie, a `null` verdict, or either explicit refutation defaults to REFUTED
  (killed). `validateHighRisk` never throws — a failing/rejecting challenger call collapses to a
  `null` verdict, which is already treated as refuted.

## Use

```ts
import {
  deriveDomains,
  domainIds,
  applicableDimensions,
  reconcile,
  checkScope,
  validateHighRisk,
} from "@caisson-sh/audit-harness";

// derive the domain partition + build the cell list (domain × applicable dimension):
const domains = deriveDomains();
const cells = domains.flatMap((d) =>
  // pass d.id — the D5 and D8 riders are domain-keyed and vanish without it.
  applicableDimensions(d.class, d.id).map((dimension) => ({
    domain: d.id,
    dimension,
  })),
);

// scope guard — CI job declared one domain but touched another's file:
const domainGlobs = Object.fromEntries(domains.map((d) => [d.id, d.globs]));
const scopeFindings = checkScope(["packages/ui"], touchedPaths, domainGlobs);

// reconcile a fresh run against the persisted ledger (scope = audited domains; universe = fail-loud
// guard against a mislabeled domain):
const { ledger, classes } = reconcile(
  previousLedger,
  freshFindings,
  auditedDomains,
  domainIds(),
);

// escalate a high-risk finding through two independent adversarial passes:
const survives = await validateHighRisk(finding, myPalChallenger);
```

```bash
# reconcile CLI — pipe a JSON array of {domain, subject, title, severity, status?}
bun run tooling/audit-harness/src/cli.ts run.json
# → rewrites audit-ledger.toml, prints: "audit-harness: N in ledger · … (advisory — never blocks)"
```

The real `Challenger` driver (PAL `challenge` → OpenRouter, per the GridWork cross-vendor-LLM
convention) is an injected CLI/skill concern, not part of this package — keeps the harness testable
with a fake challenger and free of any network call.

## Tests

`bun test tooling/audit-harness/src` — reconcile round-trip (new → closed → regressed), TOML
round-trip, the scope guard (flags out-of-domain, passes in-domain), and the `majorityKills` truth
table. No live network.

> Rebuild-clean, generalized from the `design-critic` pattern (ADR-0101). That package was retired
> by ADR-0411 and this harness took over its lens as dimension **D8**; its closed ledger is archived
> at `outputs/archive/audit/design-critic-findings-2026-08-18.toml` and is never re-keyed here.
