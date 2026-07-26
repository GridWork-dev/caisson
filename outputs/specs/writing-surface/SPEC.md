---
status: locked (ready to build)
owner: operator
---

# SPEC — The `/writing` surface, and correcting the live Article 50 copy

- **Repo:** caisson · **Tags:** `ui`, `frontend` · **Status:** LOCKED, not started
- **Lock:** **ADR-0391** (2026-07-26) — board fork D11 locked as _verify now, publish by
  2026-08-01, on a new `/writing` collection_, then reshaped the same day by three further
  operator locks after the existing live surface was discovered:
  1. **Correct the live surfaces AND build `/writing`** — both, not either.
  2. **Full primary-source regrounding** of the corrected copy, not a minimal amendment.
  3. **Add a regulatory-claim watch** modelled on `nist-catalog-watch.yml`.
- **Parents:** ADR-0079 (site SEO) · ADR-0080 (copy laws, the honesty floor) · ADR-0082 +
  ADR-0237 rider 2 (full V1-live posture: no roadmap labels, no "coming soon", no future
  framing) · ADR-0364 (the `nist-catalog-watch` advisory-watch precedent) · ADR-0237 F1/F2
  (the hub-and-spoke registry pattern this reuses).
- **Grounding artifact:** this SPEC does not invent the article's facts. The verified claim
  table, the draft, and the live-copy audit are produced by the parallel
  `feature/ai-act-article-50` lane into `outputs/research/` and `outputs/drafts/`. **This
  build is gated on that lane landing.** Copy that is not traceable to that verification does
  not ship.
- **Explicitly NOT opened:** an RSS or Atom feed; a second Fumadocs MDX collection; author
  bylines or multi-author attribution; comments; a newsletter; any content cadence commitment
  beyond the first piece; the `/frameworks` information architecture itself.

## Goal (why now)

Two things are true at once, and the wave has to hold both.

**The live site is factually incomplete on a regulation we sell into.** Three surfaces —
`apps/site/app/frameworks/eu-ai-act/article-50/page.tsx` (294 lines, shipped 2026-07-10 under
CAISSON-79), the enforcement section of `apps/site/app/frameworks/eu-ai-act/page.tsx`, and the
`eu-ai-act-article-50` record in `apps/site/lib/glossary.ts` — ground their most consequential
claim on _"independent reporting through 2026-07-07."_ The European Commission published final
Article 50 transparency guidelines on **2026-07-20**, thirteen days after that cutoff. Verified
against the Commission's own quick-facts page on 2026-07-26: Article 50 applies from
**2026-08-02**, and a **narrow transition covers only the Article 50(2) obligation, for
generative AI systems placed on the EU market before 2026-08-02, running to 2026-12-02** —
sourced to the Digital Omnibus provisional agreement of 2026-05-07. Separately, deepfakes
generated before 2026-08-02 carry no mandatory retroactive labelling.

Two refinements the parallel verification lane surfaced from the authentic OJ text and the
final 51-page guidance, and which this SPEC adopts: the quick-facts page's "marking
obligation" is shorthand — the final guidance frames Article 50(2) as a combined
**marking-and-detectability** duty — and the transition ends on the exact date **2 December
2026**, not merely "in December". Use the guidance's framing, not the shorthand.

The live FAQ answer names the Digital Omnibus and states it changed nothing:

> "Was the August 2, 2026 date delayed?" → "No. Independent reporting through 2026-07-07
> confirmed the Article 50 application date was not extended by the Digital Omnibus amendment.
> From August 2, 2026 the transparency obligations are enforceable law across the EU."

The first clause is defensible — the _application date_ genuinely did not move. The closing
sentence is what fails: it omits the carve-out the Digital Omnibus did create. For a vendor
selling compliance evidence, being publicly incomplete about the rule is the expensive failure
mode, and it is the exact risk D11's own reasoning was argued on.

**And there is no surface for dated commentary.** The site has hub-and-spoke reference pages
and an evergreen framework tree, but no place to publish "here is what changed on this date."
The operator locked building one, having seen and accepted the cost: a new public marketing
surface inside six days, and a first piece that competes for query space with a page the site
already ranks for.

## The differentiation rule (the load-bearing constraint)

Because both surfaces now cover Article 50, **the boundary between them is the single thing
most likely to go wrong**, and it is a hard requirement, not a style preference.

|                 | `/frameworks/eu-ai-act/article-50`                                                 | `/writing/<slug>`                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Job             | Evergreen reference: **what the rule requires**, who is covered, what a team ships | Dated commentary: **what the 2026-07-20 final guidance settled**, and what the December carve-out does and does not cover |
| Reads correctly | Before and after 2026-08-02, indefinitely                                          | As of its stated date, with the date visible                                                                              |
| Tense           | Present, durable                                                                   | Dated, situated                                                                                                           |
| Canonical for   | "what is EU AI Act Article 50"                                                     | "did the August 2 date move / what did the July 2026 guidance change"                                                     |
| Must NOT        | Carry dated commentary framing                                                     | Restate the obligations table as its own reference content                                                                |

Both pages cross-link explicitly, each naming what the other is for. Neither sets a canonical
URL pointing at the other — they are distinct pages answering distinct queries, and a canonical
collapse would throw away the ranking the framework page already has.

**If the writing piece cannot be written without restating the obligations table, that is the
signal it should not exist as a separate page.** Say so rather than shipping a near-duplicate.

## Architecture — a third instance of a pattern the repo already runs twice

Nothing here is new machinery. `GLOSSARY_TERMS` → `/glossary/[slug]` and `MODULE_PAGES` →
`/marketplace/modules/[slug]` are both registries whose records emit a `PageSpec` rendered
generically by `<PageSections>` (`apps/site/components/page-sections.tsx`), with the union's
`never` default arm making an unhandled section kind a compile error rather than a blank.
`/writing` is the third instance.

| Need            | Reuse — do not build a parallel mechanism                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page data       | `WRITING_PIECES` registry in `apps/site/lib/writing.ts`, one record per piece; a record IS the page                                                              |
| Rendering       | `PageSpec` + `PageSection` from `apps/site/lib/page-sections.ts`, via `<PageSections>`                                                                           |
| SEO meta        | `buildMetadata` + `PageMeta` from `apps/site/lib/metadata.ts`                                                                                                    |
| Structured data | `techArticle` and `breadcrumb`, both already exported from `apps/site/lib/jsonld.ts`                                                                             |
| Hub route       | one `MARKETING_ROUTES` entry in `apps/site/lib/routes.ts` — nav and footer derive from it automatically                                                          |
| Spoke routes    | derived into `apps/site/app/sitemap.ts` from `WRITING_PIECES`, exactly as the glossary, module and comparison spokes are — spokes never enter `MARKETING_ROUTES` |
| Code samples    | the existing `CodeArtifactSection` kind, on the Caisson Shiki theme pair                                                                                         |

**Verified as conflict-free**: `apps/site/lib/routes.ts`, `apps/site/app/sitemap.ts`,
`apps/site/lib/glossary.ts` and the whole `apps/site/app/frameworks/` tree are untouched by the
concurrently-running `feature/oscal-spine-wave`, which lives in marketplace, pricing, catalog
and poke territory.

### The record contract

A `WritingPiece` carries, at minimum:

- `slug`, `title`, `dek` (one-sentence standfirst), `meta: PageMeta`
- `publishedOn` and `verifiedOn` — both ISO dates, `verifiedOn` never in the future
- `sources: readonly { label: string; url: string; locator: string }[]` — **every source is a
  primary source with a specific locator** (article number, section, or page — never a bare
  domain). Minimum one; a piece making regulatory claims cites the regulation, not coverage of
  it.
- `sections: readonly PageSection[]`
- `related: readonly string[]` — cross-links, which for the first piece MUST include the
  framework page per the differentiation rule.

`verifiedOn` + `sources` is not decoration: **it is the seam the regulatory-claim watch reads.**
Design it as a machine-readable contract first and a display field second.

Prose lives in the record as section bodies, matching how `glossary.ts` (3,403 lines) and
`comparisons.ts` (2,014 lines) already carry substantial prose. Do not add a second Fumadocs
MDX collection — if the cadence ever justifies one, that is a later ADR, and the registry
shape migrates to it cleanly.

## Tasks

1. **Reground the three live surfaces** on primary sources, using the parallel lane's verified
   claim table and proposed wording. Replace every "independent reporting through 2026-07-07"
   citation with the Commission guidance and EUR-Lex directly. Answer the "was the date
   delayed?" FAQ completely rather than with a bare "No" — the application date did not move,
   _and_ the marking obligation for pre-2026-08-02 generative systems runs to December 2026.
   Add the retroactive-deepfake position. Restamp every "facts verified <date>" label. Files:
   `apps/site/app/frameworks/eu-ai-act/article-50/page.tsx`,
   `apps/site/app/frameworks/eu-ai-act/page.tsx`, `apps/site/lib/glossary.ts`.

2. **Build the `/writing` surface** — the registry, the hub, the spoke template, the
   `MARKETING_ROUTES` entry, and the sitemap derivation, per the reuse table above.

3. **Author the first piece** from the parallel lane's draft, inside the differentiation rule.

4. **Add the regulatory-claim watch** — a report-only weekly workflow modelled on
   `.github/workflows/nist-catalog-watch.yml`: re-check the dated regulatory claims carried by
   the framework pages and `WRITING_PIECES` against their declared primary sources, and report
   drift. Report-only, always exits 0, never a required check, no credential beyond an
   unauthenticated public read. It is an advisory lane, not a gate.

5. **Tests**, mirroring `routes.test.ts` and `glossary.test.ts`: slug uniqueness; every piece
   reachable from the hub; every spoke present in the sitemap; every source URL `https`;
   every piece carrying at least one source with a non-empty locator; `verifiedOn` a valid ISO
   date and not in the future; and a differentiation guard asserting the first piece links to
   the framework page.

## Verification (goal-backward)

- A reader who checks the corrected pages' sources lands on the Commission guidance or EUR-Lex,
  not trade press.
- The "was the date delayed?" answer is complete: date unmoved, marking carve-out to December
  2026 for pre-2026-08-02 generative systems, everything else from 2026-08-02.
- `/writing` and its first spoke render, appear in the sitemap, and carry valid `techArticle`
  and `breadcrumb` structured data.
- The two Article 50 surfaces are distinguishable on the differentiation table, cross-link
  both ways, and neither is a near-duplicate of the other.
- The watch runs, reports, and cannot block a merge.
- No roadmap label, no "coming soon", no future framing anywhere in the new copy (ADR-0237
  rider 2). No claim about a Caisson capability that is not built.

## Failure modes to refuse

- **Shipping the writing piece as a second obligations reference.** That is the cannibalisation
  the operator accepted a _risk_ of, not a licence to publish a duplicate.
- **Correcting the copy from this SPEC's summary instead of the lane's verified table.** This
  SPEC's regulatory statements were verified on 2026-07-26 against one primary page; the lane's
  pass is the authority, and if it contradicts this SPEC, **the lane wins and this SPEC is
  wrong**.
- **Making the watch a required check.** An advisory lane that can block a merge on an external
  source's availability is an outage waiting to happen.
- **Giving legal advice.** State what the rule says, cite it, stop.
