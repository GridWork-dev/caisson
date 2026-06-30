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
the source-of-truth hierarchy in `CLAUDE.md` wins (board > ADRs > specs > `plan.md`/`SUMMARY.md`).

## For X -> see Y

| For...                                                                                                                  | See                                                             |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| How the system fits together: data model, ports/seams, base->edition layering topology, the kernel integrity algebra    | `docs/architecture.md` (synthesizes `specs/01-architecture.md`) |
| What a given package is, its role, and which way it depends (the 24-package catalog)                                    | `docs/packages.md`                                              |
| What composes each edition, OSS-vs-paid posture, the hero wedge                                                         | `docs/editions.md`                                              |
| Which ADR locked X; the full ADR catalog + the 0025-0039 gap + the 0045-0048 renumber map                               | `docs/adr-index.md` (indexes `knowledge/decisions/`)            |
| Coding invariants, the single standards gate (`tooling/`), conventions, changeset/version discipline                    | `docs/engineering.md`                                           |
| The security model: fail-closed RLS, field-crypto + crypto-shred, WORM audit chain, timing-safe license/secret compares | `docs/security-model.md`                                        |
| Whether X is actually built vs a stub vs roadmap (honest per-package/app/service status)                                | `docs/build-state.md`                                           |
| CI workflows, deploy, hosting (Cloudflare Pages on `caisson.sh`), infra, release flow                                   | `docs/operations.md`                                            |
| What a Caisson term means (edition, module, registry, leg, standards gate, buyer MCP, ...)                              | `docs/glossary.md`                                              |
| What is locked vs open; any open fork awaiting an operator lock                                                         | `docs/state/decisions-and-forks.md`                             |

**Routing rules (mirrors `identity/index.md`):** each topic resolves to exactly one owning
file; a dead pointer is a bug. The per-aspect files own the _synthesized view_; the
_canonical source_ always stays `specs/` + `knowledge/decisions/`. Do not re-derive a fact
here that one of those files owns - route to it.

## Canonical sources outside docs/

`docs/` synthesizes and indexes; it never supersedes these. The authoritative originals:

| Source                 | What it owns                                                                                                                                                                                                              | Mutability                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `specs/`               | The locked concept specs - WHAT + WHY. `00-product-spec.md` (founding), `01-architecture.md`, `02-core-loop-ux.md`, `03-design-framework.md`, `04-voice-and-brand.md`                                                     | Locked; amend by superseding                               |
| `knowledge/decisions/` | The ADRs themselves (`ADR-0001..0105`, gaps exist) - every locked decision, e.g. `ADR-0006-worm-audit-chain-field-crypto.md`, `ADR-0023-fully-commercial-licensing-model.md`, `ADR-0088-adr-number-collision-renumber.md` | **Append-only**, never edited - supersede with a later ADR |
| `plan.md`              | The phased build plan (P0-P7) with exit gates                                                                                                                                                                             | Live                                                       |
| `outputs/`             | Session artifacts: `kickoffs/`, `research/` (rebuild-clean provenance), `specs/`, `streams/`                                                                                                                              | Append/working                                             |

Root-level SoT also lives outside `docs/`: `CLAUDE.md` (working rules + the source-of-truth
hierarchy), `README.md` (repo overview), `SUMMARY.md` (how-we-got-here), `PRODUCT.md`,
`DESIGN.md`.

## Files in this directory

The nine per-aspect maps land together in this docs wave; each is a synthesized catalog/index
that did not previously exist as one document.

| File                                | Scope (one line)                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/architecture.md`              | The system map: package layering (base composes down, never up - ADR-0003), the kernel integrity algebra, the RLS/crypto/WORM composition topology, and the seam ports.        |
| `docs/packages.md`                  | Catalog of all 24 `packages/*`: what each is, its edition role, and its dependency direction.                                                                                  |
| `docs/editions.md`                  | The 5 editions (Base, Compliance hero, AI Production Kit, Local-first AI, Agentic-Dev) - what composes each and its commercial posture.                                        |
| `docs/adr-index.md`                 | Index of `knowledge/decisions/ADR-0001..0105`: title, status, supersede chains, the number gap, and the GTM 0045-0048->0084-0087 renumber (ADR-0088).                          |
| `docs/engineering.md`               | The engineering invariants (ADR-0002): TS-strict, Bun, Zod `.strict()`, integer money, the one standards gate, golden-file regression, changeset discipline.                   |
| `docs/security-model.md`            | The security model: fail-closed RLS (ADR-0005), field-crypto + per-tenant keys + crypto-shred (ADR-0006/0043/0055), the WORM audit chain, license/secret timing-safe compares. |
| `docs/build-state.md`               | The honest build ledger: what is genuinely built vs structure-only vs roadmap, per package/app/service.                                                                        |
| `docs/operations.md`                | CI (`.github/workflows/{ci,deploy-site,lighthouse}.yml`), the standards-gate job, Cloudflare Pages deploy + `infra/terraform`, hosting on `caisson.sh`, changeset releases.    |
| `docs/glossary.md`                  | The Caisson vocabulary - one definition per term; this file wins vocabulary conflicts.                                                                                         |
| `docs/state/decisions-and-forks.md` | The live decision board (already present): every decision, locked or open, until the operator locks it (CLAUDE.md SoT #1).                                                     |

## Build-state note (read before trusting any "shipped" claim)

Verified against the filesystem on write: the **base substrate is built + tested** - `kernel`,
`tenancy-rls`, `field-crypto`, `auth`, `billing`, `credits`, plus `cli` (`create-caisson`). The
**edition packages now carry a first implemented leg + tests merged via Wave-1** (e.g.
`packages/compliance` ~2.9k LOC / 11 tests, `packages/audit-worm` ~1.3k LOC / 6 tests,
`packages/local-ai` ~2.2k LOC / 9 tests) - this is **beyond** ADR-0082 §3's 2026-06-28
"four editions are empty stubs / structure only" snapshot, which is now **stale** for those
packages. They are **not** feature-complete editions, and `services/support-bot` is README-only.
Do not claim editions are fully built. The authoritative, reconciled per-unit status lives in
`docs/build-state.md`; treat that file as the owner and this note as a pointer.
