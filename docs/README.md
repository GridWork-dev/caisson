# Caisson — internal docs (source-of-truth map)

## What this is

`docs/` is the **internal source-of-truth surface** for Caisson contributors and the
operator: a set of synthesized per-aspect maps (architecture, package catalog, edition
composition, ADR index, engineering invariants, security model, build state, operations,
glossary) over the canonical specs + ADRs. It is **not** product documentation. Public
product docs ship from `apps/site` (the marketing + Fumadocs surface, ADR-0084) and the
`services/docs` Next/MDX site; buyer-facing material lives there. `docs/` exists to answer
"where is the truth about X, and is X actually built?" for people working _on_ the repo.

This file is the **routing index** - the always-first entry point. It maps a topic to its
one owning file and **routes; it does not redefine.** When a fact lives in a spec or an ADR,
this file points at the exact path; it never copies the canonical prose. On any conflict,
the source-of-truth hierarchy in `CLAUDE.md` wins (board > ADRs > specs > `docs/build-state.md`).

## For X -> see Y

| For...                                                                                                                                                                    | See                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| How the system fits together: data model, ports/seams, base->edition layering topology, the kernel integrity algebra                                                      | `docs/architecture.md` (synthesizes `specs/01-architecture.md`)                                              |
| What a given package is, its role, and which way it depends (catalogs the original 24 of the current 54 `packages/*`; stale on build status -- see `docs/build-state.md`) | `docs/packages.md`                                                                                           |
| The current sellable unit's license/sold-as/price (bundles, à-la-carte modules) -- editions DISSOLVED into six bundles 2026-07-06                                         | `docs/state/package-catalog.md` (`docs/editions.md` is now an archived tombstone, kept for lineage)          |
| Which ADR locked X; the full ADR catalog + the 0025-0039 gap + the 0045-0048 renumber map                                                                                 | `docs/adr-index.md` (indexes `knowledge/decisions/`)                                                         |
| Coding invariants, the single standards gate (`tooling/`), conventions, changeset/version discipline                                                                      | `docs/engineering.md`                                                                                        |
| The security model: fail-closed RLS, field-crypto + crypto-shred, WORM audit chain, timing-safe license/secret compares                                                   | `docs/security-model.md`                                                                                     |
| Compliance control-to-code traceability convention (the `Control: ADR-NNNN` docstring + golden `policyVersion` idiom)                                                     | `docs/compliance/control-traceability.md`                                                                    |
| The security tooling stack (4 layers, gates, operator setup) + the Claude-Code-driven pentest runbook + findings ledger                                                   | `docs/security/tooling-playbook.md`, `docs/security/pentest-runbook.md`, `docs/security/strix-findings-*.md` |
| Whether X is actually built vs a stub vs roadmap (honest per-package/app/service status; machine-checked, `ADR-0253`)                                                     | `docs/build-state.md`                                                                                        |
| CI workflows, deploy, hosting (Railway on `caisson.sh`, ADR-0114/0115), infra, release flow                                                                               | `docs/operations.md`                                                                                         |
| What a Caisson term means (bundle, module, registry, leg, standards gate, buyer MCP, ...)                                                                                 | `docs/glossary.md`                                                                                           |
| What is locked vs open; any open fork awaiting an operator lock                                                                                                           | `docs/state/decisions-and-forks.md`                                                                          |
| The live work tracker: operator-owed / build-gated / trigger-parked / recently closed                                                                                     | `docs/state/outstanding-work.md`                                                                             |
| Deploy log: what was redeployed, why, and the pasted live-verify evidence                                                                                                 | `docs/deploy/STATE.md`                                                                                       |

**Routing rules (mirrors `identity/index.md`):** each topic resolves to exactly one owning
file; a dead pointer is a bug. The per-aspect files own the _synthesized view_; the
_canonical source_ always stays `specs/` + `knowledge/decisions/`. Do not re-derive a fact
here that one of those files owns - route to it.

## Canonical sources outside docs/

`docs/` synthesizes and indexes; it never supersedes these. The authoritative originals:

| Source                 | What it owns                                                                                                                                                                                                              | Mutability                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `specs/`               | The locked concept specs - WHAT + WHY. `00-product-spec.md` (founding), `01-architecture.md`, `02-core-loop-ux.md`, `03-design-framework.md`, `04-voice-and-brand.md`                                                     | Locked; amend by superseding                               |
| `knowledge/decisions/` | The ADRs themselves (`ADR-0001..0242`, gaps exist) - every locked decision, e.g. `ADR-0006-worm-audit-chain-field-crypto.md`, `ADR-0023-fully-commercial-licensing-model.md`, `ADR-0088-adr-number-collision-renumber.md` | **Append-only**, never edited - supersede with a later ADR |
| `archive/plan.md`      | The phased build plan (P0-P7) with exit gates — executed; archived 2026-07-11                                                                                                                                             | Archived history                                           |
| `outputs/`             | Session artifacts: `kickoffs/`, `research/` (rebuild-clean provenance), `specs/`, `streams/`                                                                                                                              | Append/working                                             |

Root-level SoT also lives outside `docs/`: `CLAUDE.md` (working rules + the source-of-truth
hierarchy), `README.md` (repo overview), and `AGENTS.md` (a symlink to `CLAUDE.md` so Codex and
other agents load the same instructions). Root slimmed 2026-07-11: `PRODUCT.md` → `docs/product.md`,
`DESIGN.md` → `docs/design.md`, and `plan.md` + `SUMMARY.md` (executed founding plan +
how-we-got-here) → `docs/archive/`.

## Docs-surface conventions (enforced by `bun run sot`, check #8)

The 2026-07-11 docs-surface phase locked these rules; the `docs-surface` check in
`tooling/scripts/sot-check.ts` flags drift on the first two:

1. **Root markdown allowlist.** The repo root carries exactly three `*.md` files:
   `CLAUDE.md`, `README.md`, and `AGENTS.md`. Anything else lands in `docs/` (live) or
   `docs/archive/` (history) — never accumulates at root.
2. **`AGENTS.md` is a symlink to `CLAUDE.md`** — the zero-drift mirror that gives Codex and
   other agents the same project instructions. Never fork it into a real file; edit
   `CLAUDE.md` and the mirror follows.
3. **Live vs archive.** A doc that stops being true moves to `docs/archive/` whole (git mv,
   history preserved) or is replaced by a short **tombstone stub** pointing at its successor
   (the `docs/editions.md` pattern). Archived docs are immutable after the move — the
   `archive-integrity` check flags edits.
4. **Evidence artifacts don't live in the tree.** Bulk untracked evidence (screenshots,
   audit run output, scan artifacts) is tarred to `~/lab/archive/<slug>-<yyyy-mm>.tar.zst`
   and removed; tracked long-term proof bundles go under `outputs/archive/`. `.gitignore`
   already excludes the visual/browser-audit evidence classes.

## Files in this directory

The nine per-aspect maps land together in this docs wave; each is a synthesized catalog/index
that did not previously exist as one document.

| File                                      | Scope (one line)                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/architecture.md`                    | The system map: package layering (base composes down, never up - ADR-0003), the kernel integrity algebra, the RLS/crypto/WORM composition topology, and the seam ports.                  |
| `docs/packages.md`                        | Catalog of the original 24 of the current 54 `packages/*`: what each is, its (legacy) edition role, and its dependency direction. Status column is stale -- see `docs/build-state.md`.   |
| `docs/editions.md`                        | **ARCHIVED tombstone stub** (2026-07-05) -- editions DISSOLVED into six bundles 2026-07-06 (`ADR-0257`/`0258`). Current sold-as/price view: `docs/state/package-catalog.md`.             |
| `docs/adr-index.md`                       | Index of `knowledge/decisions/ADR-0001..0297`: title, status, supersede chains, the number gap, and the GTM 0045-0048->0084-0087 renumber (ADR-0088).                                    |
| `docs/engineering.md`                     | The engineering invariants (ADR-0002): TS-strict, Bun, Zod `.strict()`, integer money, the one standards gate, golden-file regression, changeset discipline.                             |
| `docs/security-model.md`                  | The security model: fail-closed RLS (ADR-0005), field-crypto + per-tenant keys + crypto-shred (ADR-0006/0043/0055), the WORM audit chain, license/secret timing-safe compares.           |
| `docs/compliance/control-traceability.md` | The control-to-code traceability convention (`Control: ADR-NNNN` docstrings + golden `policyVersion` pins) auditors use to trace a policy to its implementation.                         |
| `docs/security/tooling-playbook.md`       | The repo-local 4-layer security stack (SAST/supply-chain/DAST/AI-pentest), what gates, the CI wiring, operator setup, credentials (ADR-0314).                                            |
| `docs/security/pentest-runbook.md`        | The Claude-Code-driven (ptai + HexStrike) agentic-pentest runbook: engines, target/scope matrix, the hunt list, PoC discipline, drive prompts. Findings ledger in `strix-findings-*.md`. |
| `docs/build-state.md`                     | The honest build ledger: what is genuinely built vs structure-only vs roadmap, per package/app/service. Machine-checked per-package counts (`ADR-0253`).                                 |
| `docs/operations.md`                      | The 8 CI workflows (`.github/workflows/*.yml`), the 4 required checks, Railway deploy (ADR-0114/0115) + `infra/terraform` (DNS), hosting on `caisson.sh`, changeset/publish releases.    |
| `docs/glossary.md`                        | The Caisson vocabulary - one definition per term; this file wins vocabulary conflicts.                                                                                                   |
| `docs/state/decisions-and-forks.md`       | The live decision board (already present): every decision, locked or open, until the operator locks it (CLAUDE.md SoT #1).                                                               |
| `docs/state/outstanding-work.md`          | The live work tracker: operator-owed / build-gated / trigger-parked / recently closed, every row cites its ADR/spec/PR.                                                                  |

## Build-state note (read before trusting any "shipped" claim)

`packages/*` has grown from the original 24 to **54 dirs**, and the four legacy editions
(compliance, ai-kit, local-ai, agent-dev) **dissolved into six commercial bundles** 2026-07-06
(`ADR-0257`/`0258`) -- compliance, ai-production, local-first, agentic-dev, provenance
(net-new), everything. Every base + bundle-member package now has real, tested, live-transport-proven
code behind it (`ADR-0201`); do not cite the pre-2026-07-06 "editions are structure-only stubs"
framing (`ADR-0082` §3) as current. The authoritative, machine-checked per-unit status lives in
`docs/build-state.md` (`ADR-0253`); the license/sold-as/price view lives in
`docs/state/package-catalog.md`. Treat both as the owners and this note as a pointer.
