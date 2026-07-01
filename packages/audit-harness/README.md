# @caisson/audit-harness

The cross-domain audit/validate harness (ADR-0134) — generalizes `tooling/design-critic`'s
stable-id findings ledger from design-only to **every** auditable domain in the monorepo. Internal
engineering tooling: **not sellable**, no registry `manifest.ts`, **strictly non-blocking** (it never
gates `bun run check` or a commit).

## What it gives you

- **Audit surface manifest** (`AUDIT_DOMAINS`) — a declared inventory of every auditable domain
  (`security`, `rls-tenancy`, `licensing-spdx`, `design-ui`, `standards-gate`,
  `evidence-compliance`), each naming its own glob patterns + checker(s). Declaration only.
- **One cross-domain reconciling ledger.** `Finding`/`RawFinding`/`reconcile()` — the same
  new/unchanged/regressed/closed semantics `design-critic` uses, generalized with a `domain` field.
  Stable id = `sha256(domain ∷ subject ∷ normalized-title)[:16]` — rewording a title never forks a
  finding. `serializeFindings`/`parseFindings` round-trip the ledger through a hand-rolled TOML
  `[[finding]]` array-of-tables (same constrained shape as `design-critic/findings.toml`).
- **Workflow-scope guard.** `checkScope(declaredDomains, touchedPaths, domainGlobs)` — pure, flags
  any touched path that falls inside a domain's globs but that domain isn't declared (catches a
  design-gate job drifting into an RLS migration file, say).
- **`/validate` spine — high-risk only.** A `Challenger` port (one method: `challenge(finding)`) +
  pure `majorityKills(verdicts)` + `validateHighRisk(finding, challenger)`. A `severity: "high"`
  finding is challenged **twice**, independently; it survives only if **both** passes explicitly say
  `refuted: false`. A tie, a `null` verdict, or either explicit refutation defaults to REFUTED
  (killed). `validateHighRisk` never throws — a failing/rejecting challenger call collapses to a
  `null` verdict, which is already treated as refuted.

## Use

```ts
import {
  AUDIT_DOMAINS,
  reconcile,
  checkScope,
  validateHighRisk,
} from "@caisson/audit-harness";

// scope guard — CI job declared "design-ui" but touched an RLS file:
const domainGlobs = Object.fromEntries(
  AUDIT_DOMAINS.map((d) => [d.id, d.globs]),
);
const scopeFindings = checkScope(["design-ui"], touchedPaths, domainGlobs);

// reconcile a fresh audit run against the persisted ledger:
const { ledger, classes } = reconcile(previousLedger, freshFindings);

// escalate a high-risk finding through two independent adversarial passes:
const survives = await validateHighRisk(finding, myPalChallenger);
```

```bash
# reconcile CLI — pipe a JSON array of {domain, subject, title, severity, status?}
bun run packages/audit-harness/src/cli.ts run.json
# → rewrites audit-ledger.toml, prints: "audit-harness: N in ledger · … (advisory — never blocks)"
```

The real `Challenger` driver (PAL `challenge` → OpenRouter, per the GridWork cross-vendor-LLM
convention) is an injected CLI/skill concern, not part of this package — keeps the harness testable
with a fake challenger and free of any network call.

## Tests

`bun test packages/audit-harness/src` — reconcile round-trip (new → closed → regressed), TOML
round-trip, the scope guard (flags out-of-domain, passes in-domain), and the `majorityKills` truth
table. No live network.

> Rebuild-clean, generalized from the local `tooling/design-critic` pattern (ADR-0101). Does not
> touch or import `design-critic` — a standalone copy. Adopting the harness into `tooling/`/
> `packages/ui` is an integration follow-up (ADR-0134), not in this package.
