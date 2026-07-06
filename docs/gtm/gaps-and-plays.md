---
updated: 2026-07-05
status: live
grounds:
  - outputs/research/monorepo-bigpicture-2026-07.md
  - outputs/kickoffs/KICKOFF-B-hygiene-audit-remediation.md
  - knowledge/decisions/ADR-0244-*.md
  - knowledge/decisions/ADR-0245-*.md
---

# Gaps and plays

The 13-gap disposition from the 2026-07 five-angle research sweep (monorepo engineering,
productized-library GTM, solo-operator ops, SEO/AEO for devtools, agent-driven repo ops), plus
the standing do-not-copy list. Source: `outputs/research/monorepo-bigpicture-2026-07.md` §2–3.
Raw evidence and full URL list stay in that file — this page tracks live disposition only.

## Gap ledger

| #   | Gap                                                                                                    | Live status                                  | Disposition                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Perpetual license had no stated updates/renewal window                                                 | **CLOSED** — ADR-0244 (2026-07-05)           | One-time purchases = perpetual use + 12 months included updates + ~40% renewal for continued updates. Must land in checkout copy + EULA before the pricing flip. |
| 2   | Credit rollover / top-up policy undecided                                                              | **CLOSED** — ADR-0245 (2026-07-05)           | Pooled rollover, every grant expires 12 months from issue, FIFO burn; $49 top-up pack per ADR-0222.                                                              |
| 3   | Root CLAUDE.md embeds the full ADR-0001→0242 catalog inline instead of pointing at `docs/adr-index.md` | **IN PROGRESS** — this SOT-expansion session | Trim to ceiling number + pointer + one-line renumbering convention note. Tracked in `outputs/specs/sot-expansion/SPEC.md` §1.5.                                  |
| 4   | No package-manager catalog for shared deps (zod across 4 semver ranges, typescript across 5)           | **QUEUED** — Kickoff B hygiene wave          | One `catalog:` block in root `package.json`; zod v3-vs-v4 mini-audit runs first as a judgment call per package family.                                           |
| 5   | `build-vs-buy` page named in ADR-0079, never built                                                     | **QUEUED** — Kickoff B hygiene wave          | Pattern already designed; ships through the F7 draft→skeptic→gate copy pipeline.                                                                                 |
| 6   | Cloudflare Content-Signals header (ADR-0079 §5) not implemented                                        | **QUEUED** — Kickoff B hygiene wave          | One response header; completes an already-locked decision.                                                                                                       |
| 7   | No unused-dependency / unused-export gate                                                              | **QUEUED** — Kickoff B hygiene wave          | Add `knip` + one CI step.                                                                                                                                        |
| 8   | No automated dependency-update bot                                                                     | **QUEUED** — Kickoff B hygiene wave          | `renovate.json` or `dependabot.yml`; pairs with #4.                                                                                                              |
| 9   | No AI-citation tracking loop                                                                           | **TRIGGER-PARKED**                           | `gw-aeo-strategist` agent exists to consume this; wire a Peec/Ahrefs-Brand-Radar-style tracker when launch traffic exists to measure.                            |
| 10  | Changesets `ignore`/`privatePackages` policy undeclared                                                | **QUEUED** — Kickoff B hygiene wave          | One config block; codifies what `private: true` defaults already do correctly.                                                                                   |
| 11  | Support-bot escalation is binary (answer or ticket), not a 3-tier confidence gate                      | **TRIGGER-PARKED**                           | Revisit once the bot carries real support volume — best-practice RAG support is high→auto-answer / medium→suggest-to-staff / low→escalate.                       |
| 12  | No docs discover→quickstart→signup conversion instrumentation                                          | **TRIGGER-PARKED**                           | Fumadocs + ask-AI intent capture exist; attribution tracking waits for real traffic.                                                                             |
| 13  | No affiliate / recurring-commission program                                                            | **POST-LAUNCH**                              | Clean gap, substrate (Discord + subscriptions) already exists; needs traffic first.                                                                              |

## Do not copy (standing anti-decision list)

- **shadcn `registry.json` agent-install channel** — `registry.caisson.sh` (ADR-0223) already
  superset of this, plus commercial gating shadcn has no model for; an unauthed install channel
  would undercut the paywall.
- **Live phone-home license verification (Cal.com model)** — offline Ed25519 verification was a
  deliberate choice; Cal.com's own issue #23342 documents phone-home breaking customers after
  trial expiry. Do not "modernize" toward the network check.
- **ADR-injection / ADR-enforcement CI tooling** (adr-kit, adr-governance) — over-engineering at
  solo scale; append-only immutability + the hand-synthesized `docs/adr-index.md` already manage
  240+ ADRs. The one worthwhile ADR-adjacent fix is #3 above (deletion, not automation).
- **CI doc-code sync gate that auto-drafts doc PRs** (docs-gate, veritas) — a noise generator for
  an operator who narrates state docs in-session; the dated-banner + append-only discipline is
  already eyeball-verifiable.
- **`turbo --affected` on the required `check` gate** — would skip validation of a release-blocking
  gate; keep the full graph. (A shared remote cache is marginally worth it, low priority.)
- **Collapsing the 5-service Railway topology to one host** — the product's editions plus a Python
  support-bot are genuinely different runtimes, plus a Cloudflare Worker registry; a monolith
  fights the product shape.
- **Over-investing in llms.txt as an AI-visibility lever** — already shipped, correctly scoped as
  a coding-agent token-saver (ADR-0237 F8). 97% of llms.txt files get zero AI-bot traffic; don't
  expect ranking lift.

## Open fork (not decided here)

The R3 compliance-package-split price question was redirected into a catalog-doctrine research
round rather than decided directly. Direction under study: all editions become bundle options
over an individually-sellable package catalog, with explicit OSS/commercial-line and package-split
standards. Fork queue lands in `outputs/research/catalog-doctrine-2026-07.md`. Any pricing
structure work referencing this repo's editions should treat the catalog shape as **open**, not
decided, until that research round locks.
