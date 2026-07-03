# ADR-0235 — Glossary program: five fork locks (term list · authoring · rollout · linking · nav)

**Status:** accepted · 2026-07-03 (fifth picker round). Locks all five operator forks of
`outputs/specs/glossary-program/SPEC-glossary-program.md`, unblocking the build ADR-0232 Fork C
pre-committed. Realizes ADR-0232 (program pre-commit + renderer trigger); extends ADR-0079 §2
(the `/glossary/{term}` taxonomy) and ADR-0080 (copy laws govern every page). **One pick is an
operator OVERRIDE of the tabled recommendation** (Fork B — the review cadence is replaced by an
adversarially-verified agent workflow). Append-only; supersede with a later ADR, never edit.
**Tags:** (none — marketing/SEO surface; REVIEW-only at SHIP).

## Decision

| Fork                           | Lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fork A — term list**         | **Lock the 32 terms as listed** in the SPEC's §Term list. Every row maps to a shipped surface (`docs/build-state.md`); the operator may still strike a row at content review, never add without a new lock.                                                                                                                                                                                                                                                                                  |
| **Fork B — authoring**         | **OVERRIDE: agent-authored via a multi-agent workflow with research grounding + adversarial verification** — not the tabled operator-review cadence. Each page is drafted by the GTM-copy lane grounded in cited research (exa; claims dated), then adversarially verified by independent skeptic passes (copy-law compliance per ADR-0080, honesty-boundary/over-claim hunting — heaviest on the compliance cluster, terms 1–10). The operator's gate is the PR merge, not per-page review. |
| **Fork B rider**               | The compliance cluster (terms 1–10) gets the strictest adversarial pass (YMYL/legal risk): claim-by-claim refutation prompts, ADR-0080 §3 honesty boundary enforced; any claim a skeptic cannot verify against a shipped artifact is cut, never softened.                                                                                                                                                                                                                                    |
| **Fork C — rollout**           | **Cluster batches.** Batch 1 = renderer + hub + `DefinedTerm` JSON-LD + the compliance cluster (the one-time build cost); later batches are pure data records (security → licensing → ai-infra), measuring indexation between.                                                                                                                                                                                                                                                               |
| **Fork D — internal linking**  | **Curated related-terms** — 2–4 hand-picked same-cluster `related` slugs per term + the `sells` CTA + the hub link. No auto-linking (the manufactured-density risk ADR-0080 warns against).                                                                                                                                                                                                                                                                                                  |
| **Fork D-nav — hub placement** | **Footer only** (+ sitemap). The primary nav stays lean per ADR-0079 §4 crawl hygiene; agentic-dev is the precedent.                                                                                                                                                                                                                                                                                                                                                                         |

## Consequences

- The build is fully unblocked: SPEC Tasks 1–4 (renderer + glossary scaffold + hub + JSON-LD,
  ~1–2 days mechanical) proceed; Task 5 (the 32 term records) ships in the Fork-C cluster batches,
  authored per the Fork-B workflow.
- The Fork-B workflow shape (research → draft → adversarial verify → operator merges the PR) is a
  Workflow-tool program: finder/skeptic lanes per the doctrine routing (sonnet drafts, opus/PAL
  skeptics on compliance claims); never fable for fan-out.
- Verification greps for the ADR-0080 banned phrasings stay in the build's test set regardless of
  authoring lane.
