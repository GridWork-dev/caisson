# SPEC — Whole-repo improvement program (standards · hygiene · big-picture optimizations)

**Status:** disposition table authored 2026-07-05; each build-now row is spec-gated per the root
cadence (this SPEC is the program ledger; rows marked FORK need an operator lock first).
**Source:** `outputs/research/monorepo-bigpicture-2026-07.md` — the 5-angle exa research wave
(monorepo engineering · productized-library GTM · solo-operator ops · SEO/AEO devtools ·
agent-driven repo ops), synthesized against 2025–2026 reference practice. This SPEC is that
report's execution vehicle for the WHOLE repo — not a sub-item of the SOT doc-set program
(`outputs/specs/sot-expansion/SPEC.md`, which now only cross-references it).

## Verdict the program executes against

Caisson is **ahead** of reference practice on architecture and discipline (package-level open-core
split, the 3-layer standards-gate, estimate-reserve-reconcile AI metering, Paddle-MoR, offline
Ed25519), **at practice** on agent-repo conventions and content plumbing, and **behind** on
dependency hygiene, measurement loops, and two unmade revenue-policy decisions that are cheap now
and expensive after launch. The program closes the "behind" column and consciously refuses the
practices the research rejected.

## Disposition table — all 13 gaps (report §2, ranked impact-per-effort)

| #   | Gap                                                                                                                     | Disposition                                                                                                             | Vehicle / trigger                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Perpetual-license updates/renewal window unstated (AG-Grid pattern vs Tailwind-Plus lifetime trap)                      | **FORK — operator lock BEFORE the checkout flip** (trust-cost is one-way)                                               | SOT-session picker queue; lock → ADR + EULA/checkout copy                                                                                                |
| 2   | Credit rollover / top-up policy undecided (pooled-rollover + top-ups is the winning 2026 pattern)                       | **FORK — operator lock before the pricing page is load-bearing**                                                        | SOT-session picker queue; wallet plumbing already exists (ADR-0007/0024)                                                                                 |
| 3   | Root CLAUDE.md inline ADR catalog (~700-word run-on, appended every merge)                                              | **BUILD NOW**                                                                                                           | SOT spec §1.5 owns it (deletion, not automation)                                                                                                         |
| 4   | No shared-dependency catalog — zod across 4 ranges, typescript across 5, 51 packages                                    | **BUILD NOW**                                                                                                           | root `package.json` `catalog:` block + repo-wide repoint; the zod 3↔4 split is a live type-incompat landmine — resolve it deliberately, not mechanically |
| 5   | `build-vs-buy` comparison page named in ADR-0079, never built (~51% of B2B-SaaS AI citations are company-owned content) | **BUILD NOW**                                                                                                           | one page via the F7 draft→skeptic→gate copy pipeline                                                                                                     |
| 6   | Cloudflare Content-Signals header (ADR-0079 §5) unimplemented                                                           | **BUILD NOW**                                                                                                           | one response header in `apps/site` next.config/headers; completes an already-locked decision                                                             |
| 7   | No unused-dep / unused-export gate                                                                                      | **BUILD NOW (advisory)**                                                                                                | `knip` + one CI step, advisory lane first (same promotion rule as `sot`)                                                                                 |
| 8   | No dependency-update bot                                                                                                | **BUILD NOW**                                                                                                           | `renovate.json`, catalog-aware grouping, paired with #4; weekly cadence, no auto-merge                                                                   |
| 9   | No AI-citation tracking loop (`gw-aeo-strategist` exists with no feed)                                                  | **BUILD-ON-TRIGGER: post-launch** — pre-launch citation data is noise                                                   | wire a tracker feed to the existing agent once the site is public + indexed                                                                              |
| 10  | Changesets `privatePackages`/`ignore` policy undeclared (relies on `private:true` defaults)                             | **BUILD NOW**                                                                                                           | one `.changeset/config.json` block; codify before the public/private split grows                                                                         |
| 11  | Support-bot answers binary (no graded high/medium/low confidence gate)                                                  | **BUILD-ON-TRIGGER: first real support traffic** — tuning thresholds with zero users is guesswork                       | 3-tier gate in `services/support-bot` (auto-answer / suggest / silent-escalate to the ADR-0206 Linear sink)                                              |
| 12  | No docs-conversion instrumentation (discover→quickstart→signup)                                                         | **BUILD-ON-TRIGGER: launch flip** — needs public traffic; design the event names with the F8 split-analytics scheme now | Plausible funnel events on docs + dashboard signup as the conversion event                                                                               |
| 13  | No affiliate / recurring-commission program                                                                             | **PARKED: post-launch, needs traffic first**                                                                            | substrate exists (Discord + subscriptions); revisit at first organic-channel signal                                                                      |

**Build-now set = #3 #4 #5 #6 #7 #8 #10** (all S-effort). #3 rides the SOT session (it edits
CLAUDE.md, same tree); **#4–#8 + #10 are their own hygiene wave** — one branch, one PR, disjoint
from the SOT trees, runnable in parallel with the SOT workstreams. #4 is the only row needing real
judgment: unifying zod means choosing the v3-vs-v4 line per package family, so it leads the wave
with its own mini-audit (which packages pin which range and why) before the catalog block lands.

## Do-not-copy ledger (report §3 — recorded ANTI-decisions, do not re-propose)

- **shadcn `registry.json` agent-install channel** — undercuts the license-token paywall
  (`registry.caisson.sh` ADR-0223 is a superset). Revisit only as a deliberate free-tier teaser fork.
- **Phone-home license verification** — offline Ed25519 stays (Cal.com issue #23342 is the cautionary
  tale). Do not "modernize" toward a network check.
- **ADR-enforcement CI tooling** (adr-kit / adr-governance class) — over-engineering at solo scale;
  append-only + `docs/adr-index.md` + the `sot` ceiling-parity check cover it.
- **LLM doc-sync CI bots that auto-draft doc PRs** — noise generator for an operator who narrates
  state in-session; the `sot` command is deliberately detect-only.
- **`turbo --affected` on the required `check` gate** — keeps skipping validation off the
  release-blocking path (ci.yml's inline comment already reasons this; remote cache = low-priority).
- **Collapsing the 5-service Railway topology** — different runtimes (Bun fleet + Python bot + CF
  Worker) are a reasoned tradeoff (`providers.md` PF-7).
- **Over-investing in llms.txt for ranking** — shipped, correctly scoped as an agent token-saver;
  97% of llms.txt files see zero AI-bot traffic. Keep; expect no ranking lift.

## Reconciliation note (kept so nobody re-chases it)

The agent-ops angle flagged "no llms.txt"; the SEO angle found it live at `apps/site/app/llms.txt`
(+ `llms-full.txt`) — a dynamic Next route the grep missed. **Not a gap.**

## Verify (goal-backward)

1. Every report-§2 row has exactly one disposition here (13/13) and every FORK row reached the
   operator picker un-auto-decided.
2. The #4–#8/#10 hygiene wave: `bun install` clean after the catalog repoint · full gate green ·
   `knip` + renovate + changesets-config present · the Content-Signals header observable on a live
   response · build-vs-buy page shipped through the copy gate.
3. The do-not-copy ledger is referenced from the SOT spec (done) so future sessions don't re-propose
   rejected practices.
4. Trigger-parked rows (#9 #11 #12 #13) carry their trigger in `docs/state/opportunity-backlog.md`.

## Non-goals

No re-litigating locked architecture (open-core split, standards-gate, Railway topology, offline
licensing) — the research graded those AHEAD; the program only closes the behind-column gaps.
