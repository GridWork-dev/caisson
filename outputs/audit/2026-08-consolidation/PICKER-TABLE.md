# Consolidation picker table

Rows 1–18 survived refutation as immediate, narrowly shaped work. Rows 19–24 require an operator
decision, a major-version/public-surface decision, or additional high-risk verification. Estimated
LOC is net reduction unless marked exact/gross.

| Rank | ID  | Cut shape                                                  |                 LOC | Evidence                                         | Risk   | Status          | Verified by              |
| ---: | --- | ---------------------------------------------------------- | ------------------: | ------------------------------------------------ | ------ | --------------- | ------------------------ |
|    1 | C02 | DELETE retired marketplace/build residue                   |    441 exact target | [card](evidence/C02-site-marketplace-residue.md) | Low    | VERIFIED        | app refuter              |
|    2 | C03 | DELETE dead account-entitlement resolver                   |           414 exact | [card](evidence/C03-license-resolver.md)         | Medium | VERIFIED        | platform/service refuter |
|    3 | C05 | FOLD-INTO `@caisson/tenancy-rls` pg transactor helper      |             180–195 | [card](evidence/C05-pg-transactor.md)            | High   | VERIFIED        | platform/service refuter |
|    4 | C06 | DELETE unused private service-license barrel exports       | 137 exact after C03 | [card](evidence/C06-license-barrel.md)           | Medium | VERIFIED        | platform/service refuter |
|    5 | C08 | DELETE private app residue and dead nav metadata           |                  87 | [card](evidence/C08-app-private-residue.md)      | Low    | VERIFIED        | app refuter              |
|    6 | C07 | FOLD-INTO shared scheduler test fixture                    |               80–90 | [card](evidence/C07-scheduler-test-fixture.md)   | Low    | VERIFIED-NARROW | platform/service refuter |
|    7 | C09 | FOLD-INTO `@caisson/testing/module-graph`                  |                 ~80 | [card](evidence/C09-kernel-graph-walker.md)      | Low    | VERIFIED        | tooling refuter          |
|    8 | C12 | FOLD-INTO private jobs registry helper                     |               45–50 | [card](evidence/C12-jobs-registry.md)            | Medium | VERIFIED        | platform/service refuter |
|    9 | C11 | FOLD-INTO private Intel OpenRouter transport/parser        |               35–50 | [card](evidence/C11-intel-openrouter.md)         | Medium | VERIFIED        | platform/service refuter |
|   10 | C14 | DELETE unused Intel private package entrypoint             |            30 exact | [card](evidence/C14-intel-entrypoint.md)         | Low    | VERIFIED        | platform/service refuter |
|   11 | C15 | DELETE standards-gate library residue                      |                 ~30 | [card](evidence/C15-standards-residue.md)        | Low    | VERIFIED        | tooling refuter          |
|   12 | C17 | DELETE orphan EU AI Act manifest                           |            26 exact | [card](evidence/C17-eu-ai-manifest.md)           | Low    | VERIFIED        | compliance refuter       |
|   13 | C18 | FOLD-INTO kernel secret comparison primitive               |               20–25 | [card](evidence/C18-secret-compare.md)           | High   | VERIFIED        | platform/service refuter |
|   14 | C19 | DELETE Better Stack unauthenticated bypass                 |               15–25 | [card](evidence/C19-betterstack-bypass.md)       | Medium | VERIFIED        | platform/service refuter |
|   15 | C21 | FOLD-INTO billing parser primitive helper                  |               12–14 | [card](evidence/C21-billing-readers.md)          | Medium | VERIFIED        | platform/service refuter |
|   16 | C22 | DELETE unused trust-page devDependency                     |    2 metadata lines | [card](evidence/C22-trust-page-dependency.md)    | Low    | VERIFIED        | compliance refuter       |
|   17 | C24 | FOLD-INTO one boundary-policy data source                  |                0–15 | [card](evidence/C24-boundary-policy.md)          | Medium | VERIFIED        | tooling refuter          |
|   18 | C23 | FOLD-INTO standards-gate ownership: dependency graph guard |       ~0; 409 moved | [card](evidence/C23-dependency-guard-home.md)    | Medium | VERIFIED        | tooling refuter          |
|   19 | C01 | DELETE/DELIST `@caisson/analytics`                         |              586 TS | [card](evidence/C01-analytics-retirement.md)     | High   | DECISION-GATED  | AI refuter               |
|   20 | C04 | FOLD-INTO audit-harness; archive design-critic ledger      |      350–400 active | [card](evidence/C04-design-critic-fold.md)       | High   | DECISION-GATED  | tooling refuter          |
|   21 | C10 | DELETE `PgKeyVersionStore` in next field-crypto major      |         64 physical | [card](evidence/C10-pg-key-version-store.md)     | High   | NEXT-MAJOR      | compliance refuter       |
|   22 | C13 | FOLD-INTO browser-audit skill with explicit CI test        |                 ~46 | [card](evidence/C13-browser-audit-fold.md)       | Medium | CONDITIONAL     | tooling refuter          |
|   23 | C16 | FOLD-INTO neutral tarball-sidecar schema core              |               25–35 | [card](evidence/C16-tarball-schema.md)           | High   | HIGH-RISK       | platform/service refuter |
|   24 | C25 | FOLD-INTO canonical route/writing registries               |                  ~0 | [card](evidence/C25-visual-route-inventory.md)   | Low    | CONDITIONAL     | app refuter              |

## Picker notes

- _C01 disposed 2026-08-18 → **ADR-0410** (retire `@caisson/analytics`). The Status column above is
  left at its audit-time value: this table is a frozen audit artifact, not a live tracker._

- Choosing C01 requires a superseding ADR, append-only module delist, retained tarball history,
  Open Base/public-doc cleanup, and an external-usage check. It has no paid grandfathering burden.
- Choosing C04 requires a visual audit-harness dimension, a superseding ADR, and verbatim archival
  of the 5,835-line design ledger; those archive lines are not counted as deleted.
- Choosing C10 is a public API removal from a sold package and belongs only in `field-crypto@2.0.0`.
- C16 changes release-byte integrity validation. It is small but intentionally ranked in the
  high-risk section, not among mechanical cuts.
- Rows may be selected independently except C03/C06, whose exact counts overlap by one barrel line.
