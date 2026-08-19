# ADR-0412 — Name `@caisson/ds-manifest` on the public open-Base surfaces: the census is sixteen, not fifteen

- **Date:** 2026-08-19
- **Status:** Accepted (operator lock at the session picker, 2026-08-19)
- **Completes:** ADR-0410 §Consequences — the clause recording `@caisson/ds-manifest` as "served,
  Apache-2.0, and publicly unnamed… explicitly NOT decided here". This is that decision, and it
  closes the counsel disposition ADR-0410 only narrowed.
- **Parent:** ADR-0094/0097/0136 (the open-core Base boundary) · ADR-0345 (why `ds-manifest` is open
  in the first place) · ADR-0410 (the analytics retirement) · the counsel drafting memorandum
  (`docs/business/legal/counsel-drafting-memorandum.md`, 2026-07-11)

## Context

Counsel flagged one discrepancy in July: _"The live license page advertises 15 Apache-2.0 packages,
while anonymous registry metadata exposes 16, including `@caisson/analytics`."_ They asked for two
things — a named keep-or-remove decision for `analytics`, and a class-level reconciliation
_"before source publication"_, with the intended package set supplied into a blank in their memo.

ADR-0410 answered the first and assumed it had substantially addressed the second. **It had not.**
The arithmetic counsel cited is unchanged: the site still says 15 and the registry still serves 16.
Only the identity of the sixteenth package moved. `@caisson/ds-manifest` was first published
**2026-07-13** (`registry/ledger.jsonl` — `@caisson/ds-manifest@0.1.0`, `publishedAt`
`2026-07-13T00:00:00.000Z`), two days after counsel's memo, so counsel never saw it; retiring
`analytics` narrowed the cause and left the number alone.

A note on that date, because getting it wrong nearly shipped here: this ADR's first draft said
2026-07-17, read off `registry/index.json`, whose earliest surviving row for the package is `0.2.0`
— `0.1.0` was pruned by a delist on 2026-07-17 (CAISSON-125/ADR-0359, "superseded version pruned").
The index is a projection with holes; the append-only ledger is the record. **ADR-0402 already
locked this**: publish-state triage starts at `ledger.jsonl`, never `index.json`, and ADR-0399
shipped on a false premise for exactly this reason. The SHIP review caught the repeat.

Two exits from ADR-0410's own playbook are structurally unavailable here, which is what makes this
a different decision rather than a repeat:

- **Delisting is not available.** `@caisson/cli` and `@caisson/mcp-server` both declare
  `@caisson/ds-manifest` in `dependencies` in their **published registry manifests**, and a module
  delist makes the tarball answer 401/404 before R2 is reached (ADR-0410 §Consequences). Delisting
  it would break `bun add @caisson/cli` — a package named on the public fifteen-list. Retirement
  would first require folding its source into both consumers and republishing them.
- **Re-licensing it commercial is not available.** The standards-gate forbids an open package
  depending on a commercial one; `cli` and `mcp-server` are both open and both depend on it, so the
  flip trips the boundary check twice and cannot be fixed without also flipping the generator trio
  commercial, contradicting ADR-0136.

And on the merits it should be open regardless. ADR-0345 placed the doctor's static-check logic in
`@caisson/ds-manifest` deliberately, as Apache source gated at the MCP tool by runtime entitlement.
It is a real substrate library that buyers already resolve transitively today.

## Decision

**The public open-Base census is SIXTEEN packages, and `@caisson/ds-manifest` is named on every
surface that enumerates them.**

1. `ds-manifest` joins `BASE_SUBSTRATE_PACKAGES` in `apps/site/lib/base-substrate.ts` — the single
   const every public surface derives from — and joins the AI-config/MCP capability tile, whose body
   now states that the design-system contracts an agent reasons over are open too. The tiles must
   partition `BASE_PACKAGES`, so a new member requires a home; this is its honest one per ADR-0345.
2. The one hardcoded count that renders — `apps/site/app/(marketing)/page.tsx`, "15 base packages" —
   becomes 16. Every other rendered count was already `BASE_PACKAGES.length` and follows for free.
3. `scripts/mirror-assets/README.md` gains its row. The mirror exporter selects purely on the SPDX
   field and has been shipping this package since 2026-07-13 while its own front page omitted it.
4. The counsel-facing corpus is reconciled **by document type, not uniformly** — there are four
   documents in the 2026-07-11 intake set and they are not one class:
   - Documents stating a **current** fact are updated: `caisson-internal-master-map.md` (including
     the three pre-sale legal-gate rows at §Open Base packages / §Open-source boundary /
     §Open-source release boundary, which a first pass left at 15 in a file it had re-dated as
     current — worse than not touching it, because the new date warrants the stale rows),
     `caisson-exhibit-index.md`, and `caisson-confidential-lawyer-packet.md`'s CONFIRMED RECORD of
     the product.
   - Documents recording a **dated observation** are NOT rewritten: `draft-instrument-set.md`'s
     numbered "On July 11, 2026…" findings and its Schedule 9-B are the evidentiary record of what
     the public surfaces showed that day. Editing the numbers there would destroy the record of the
     discrepancy counsel actually observed. Only the two rows carrying a live ACTION are annotated
     with their resolution in place, and an explicit note says why the rest stands.
     `caisson-internal-master-map.md` now supplies **the intended set** counsel's memo left as a blank
     placeholder — sixteen, enumerated.

## Consequences

- **Counsel's disposition can now be closed rather than re-narrowed.** The remaining ask was a set,
  not a subtraction.
- **The `/legal/license` non-exhaustiveness hedge is DELETED, because this change makes it false.**
  It read "a handful of modules outside the Base set are nonetheless Apache-2.0 — the `license`
  field in each package's own manifest is what binds." After this change that set is **empty**: no
  first-party manifest outside `BASE_PACKAGES` carries an Apache-2.0 SPDX field, and the new
  converse guard now _enforces_ that it stays empty, so CI is red the moment the sentence could
  become true again. A first pass through this decision reasoned about the hedge and concluded it
  was "accurate by being unnecessary" — that was wrong in the direction that matters: shipping code
  which guarantees a rendered legal sentence is false is the inverse of the defect this ADR exists
  to close, on the exact URL counsel cited. The surviving clause ("the `license` field in each
  package's own manifest is what binds, not this summary") is true and stays.
- **The structural cause is fixed, and it was mine as much as anyone's.** Both public-list guards
  asserted only one direction — `BASE_PACKAGES ⊆ Apache-on-disk` and `advertised ⊆ exported` — so
  "shipped but unnamed" was invisible to CI by construction. The mirror guard was written **one day
  before this ADR**, in the ADR-0410 PR, specifically to catch the stale-row class, and was written
  one-directional again. Both now assert the converse, both are mutation-verified (removing
  `ds-manifest` turns each red), and both carry a non-vacuity floor so a silently-stopped regex
  cannot make them pass on an empty scan. **A one-directional set guard on a public census is not a
  guard**; it is the mechanism by which the census stays wrong while every gate is green.
- **Two guards were not the whole structural cause, and the proof is that one got past them.** Both
  compare CODE to DISK. `apps/site/content/**` is neither: it is hand-written MDX that enumerates
  the set in prose, and `docs/cli/create-caisson.mdx` was still rendering the pre-`ds-manifest`
  fifteen _after_ the set guards landed — a buyer-facing page stating affirmatively what is free to
  install, and one the docs RAG corpus is assembled from (`services/docs/src/corpus.ts`), so the
  support-bot answered "what's free?" from it and `/llms.txt` re-emitted it. A third guard now
  covers the prose: any paragraph under `apps/site/content/**` naming eight or more base packages
  is treated as enumerating the set and must be complete against the substrate set or the full set.
  Mutation-verified on both files it protects. The list stays literal rather than becoming a
  rendered `{baseSubstrateList()}` component **because the RAG corpus indexes the raw MDX** — a
  component would be invisible to it and would make the bot's answer worse, not better.
- No registry, ledger, index, entitlement, or workspace change: the package was already served,
  already Apache-2.0, already in `OPEN_BASE_NAMES`, and already exported. The `sot` SUMMARY_CLAIMS
  totals were already 16 — **the internal docs were right and only the public surfaces were wrong**,
  which is the inverse of the usual drift direction and the reason no existing gate caught it.
- **Known residue, deliberately not fixed here:** `apps/site/public/demo-preview/preview.json` — the
  captured install log the `/demo` page renders — still lists `@caisson/analytics@0.2.1`, a package
  ADR-0410 deleted, and a stale `eslint@9.39.5` from before the oxc adoption. It is a GENERATED
  artifact (`tools/demo-preview/generate.ts`, with a committed-artifact contract test), so
  hand-editing it would desync it from its generator and is the wrong fix; it needs a regeneration
  run. Recorded here rather than patched, and carried into the work tracker at the wave reconcile.
- The `@caisson/analytics` precedent does not generalize to "an unnamed open package gets retired".
  It generalizes to "an unnamed open package gets a decision". This one had dependents; that
  changed the answer.
