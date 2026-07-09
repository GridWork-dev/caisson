---
title: "SEO section-union PageSections renderer (deferred — new programmatic pages only)"
slug: seo-section-union-renderer
status: "draft - operator lock required"
tags: [ui, frontend]
supersedes_none: true
adr_ceiling_at_draft: 0217
---

# SPEC — SEO section-union `PageSections` renderer (deferred)

**Status: draft — operator lock required.** This is a DRAFT for review, not a build
authorization. It is the write-up of the `(c)` branch of the D8 SEO fork — a trigger-gated
deferral. **Nothing here is built until both (1) the operator locks this SPEC and (2) the
trigger condition below actually fires.** The default state of this item is "correctly
deferred, do nothing."

> **ponytail:** the strongest thing this SPEC says is _don't build this yet_. The Stream-D
> recon ran the numbers twice and both times concluded a union renderer is over-build at
> Caisson's current page count. This document exists so that when a real page-generation
> program appears, the shape is pre-decided — not so that anyone starts writing the union now.

## Goal (WHAT + WHY)

Give any FUTURE bulk programmatic/SEO page program (comparison pages, per-framework landing
pages, a glossary) a single typed section-union renderer — a discriminated `PageSection[]`
array supplied by a per-page data file — **built entirely from the primitives already in
`@caisson/ui`**, so "add an SEO page" becomes "add one data file" instead of "hand-author a
new JSX page."

**Why this is a `(c)`, not a `(b)`:** the D8 fork lock (`docs/state/decisions-and-forks.md:164`)
chose option `(a)` targeted wins for the ~6 EXISTING hand-crafted pages, and explicitly
rejected the `(b)` union renderer as over-build at N≈6 — the pages share no section sequence
and each carries irreducible custom artifacts. `(c)` is the surviving branch: a union renderer
**for new pages only**, adopted **iff** a large near-identical page program materializes. This
SPEC scopes `(c)` and nothing else. It does **not** reopen `(b)`, and it does **not** touch the
existing pages.

## Why now / trigger

**There is no "now."** This SPEC is a standing trigger definition, not an active build.

**Trigger condition (all must hold before this SPEC may be locked-to-build):**

1. A concrete, committed initiative proposes **N ≈ 20+ near-identical pages** that share one
   section grammar — matching the bar the Stream-D SPEC itself set
   (`outputs/specs/stream-d-base-golive/SPEC.md:212-213`: "adopt a union iff an N≈20+
   keyword-page program appears; Wardfile's ladder pays off at N≈50").
2. That initiative is a **single committed program**, not a speculative sum of several
   "someday" candidates.
3. The pages genuinely reduce to typed data + a small set of section variants (verified by
   sketching 2–3 of them against the section vocabulary below before locking).

**Candidate programs and why none clears the bar alone today** (evidence, not a build list):

| Candidate program                                                                                                                    | Plausible N | Clears N≈20 alone?               |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------- |
| Additional compliance-framework landing pages beyond the one shipped EU AI Act page (SOC 2 / HIPAA / ISO 27001 / GDPR / PCI-DSS)     | ~5          | No                               |
| "Caisson vs X" comparison pages                                                                                                      | ~5–10       | No                               |
| Per-integration adapter landing pages for the six D5-locked driver families (email · KMS · SSO · jobs · DB · billing; ADR-0170–0175) | ~6          | No                               |
| Bulk glossary / definition-term program                                                                                              | ~20–50      | **Only this one plausibly does** |

Until one program clears the bar (most plausibly a glossary), the answer stays: defer.

## Non-goals

- **Do NOT respec the rigid Wardfile-style `IntentLadder`.** It was rejected for Caisson
  specifically because Caisson's pages share no fixed section sequence
  (`docs/state/decisions-and-forks.md:286`). Even when this SPEC triggers, the renderer must be
  an **ordered array of typed variants per page**, never a fixed-slot template — see Design.
- **Do NOT retrofit or migrate the existing hand-crafted pages** (compliance, ai-kit,
  local-first, agentic-dev, procurement, `frameworks/eu-ai-act`, `security`). They stay
  hand-authored JSX indefinitely. Forcing already-SEO-complete, structurally-divergent pages
  into a shared scaffold is fidelity loss for zero SEO gain — the exact reasoning that killed
  `(b)`.
- **Do NOT build option `(b)` at the current page count.** Building "ahead of need" reproduces
  the YAGNI finding the recon reached twice.
- **This is NOT the D8(a) SWEEP tail.** Adopting `<Faq>` / `<FeatureGrid>` at
  agentic-dev/procurement/security + the remaining `cs-grid` sites
  (`outputs/specs/stream-d-base-golive/VERIFY-SWEEP.md:17,42`) is a separate, already-decided,
  lower-risk cleanup. It must not be conflated with or bundled into this item.
- **No new visual components / no new design language.** The renderer composes existing
  `@caisson/ui` primitives only (single-implementation kit, ADR-0099).
- **No CMS, no runtime content editing.** Page data files are compile-time-typed TS source,
  committed to the repo — not a runtime boundary, so no Zod parse layer (see Design note).

## Current state (cite real files)

**The fork and its resolution (verified):**

- `docs/state/decisions-and-forks.md:164` — D8 SEO scaffold lock: option `(a)` chosen; `(b)/(c)`
  union renderer "rejected as over-build at ~6 hand-crafted pages"; "No new ADR."
- `docs/state/decisions-and-forks.md:286` — the fuller D8 entry: the forward options `(a)/(b)/(c)`
  in full, the "no two share a section sequence" finding, and "Recon: workflow `wf_3045febd-43a`."
- `outputs/specs/stream-d-base-golive/SPEC.md:200-214` — the D8 fork with the twice-run recon
  verdict on `(b)` ("a config system for a value that barely repeats. YAGNI") and the `(c)`
  deferral wording at `:212-213`.
- `outputs/specs/stream-d-base-golive/SPEC.md:235` — the **stale** provisional ADR-0178 slot
  ("D8 resolution (only if a union is adopted)"). That number is now consumed — see ADR
  interactions.

**Option `(a)` shipped (do NOT touch — this is done):**

- `packages/ui/src/components/faq.tsx`, `packages/ui/src/components/feature-grid.tsx` — the two
  primitives built for `(a)`, re-exported through `apps/site/components/index.ts`.
- `outputs/specs/stream-d-base-golive/VERIFY-SWEEP.md:17,42` — the still-open `(a)` adoption
  SWEEP tail (separate item, out of scope here).

**The existing hand-crafted pages (the scope wall — NOT migrated):**

- `apps/site/app/(marketing)/{compliance,ai-kit,local-first,agentic-dev,procurement}/page.tsx`
- `apps/site/app/frameworks/eu-ai-act/page.tsx` (~475 lines) — the single most union-shaped page
  in the repo today: Hero → honesty-boundary Card → data-driven `ANNEX_CONTROLS` control-map →
  evidence-bundle CodeBlock → why-now Card → CTA+Terminal. Even this page carries 2–4 irreducible
  hand-authored `cs-tok-*`-colorized Terminal/CodeBlock artifacts that do not reduce to flat
  data — the precedent proving the `custom` escape hatch is mandatory (see Design).
- `apps/site/app/security/page.tsx` (~359 lines).

**SEO + route infrastructure (reused as-is, unchanged):**

- `apps/site/lib/routes.ts` — `MARKETING_ROUTES`, the single route SOT feeding `sitemap.ts`, nav,
  and footer. A triggered program's new routes register here.
- `apps/site/lib/metadata.ts` — `buildMetadata` (`PageMeta` → Next `Metadata`); every marketing
  page imports it as `import { buildMetadata } from "@/lib/metadata"`. The union renderer reuses
  it; it introduces **no** new SEO contract.
- `apps/site/lib/jsonld.ts` — root `@graph` + the per-page JSON-LD builders (`serializeJsonLd`,
  `softwareApplication`, `moduleItemList`, `breadcrumb`, `techArticle`, `faqPage`). Reused as-is;
  no new JSON-LD contract. **Note:** `buildMetadata` is NOT here — it lives in `metadata.ts` above.

**Component vocabulary already available (verified barrel `apps/site/components/index.ts`):**
`Hero`, `Section`, `Card`, `CodeBlock`, `Terminal`, `Faq`, `FeatureGrid`, `CredentialStrip`,
`StatusChip`, `Icon`, `Glyph`, `Reveal`, `SkuMatrix`, `EditionCard`, `Button` — all
single-implementation kit primitives (ADR-0099). `packages/ui/src/components/sku-matrix.tsx` is
already a generic `columns`/`rows` comparison table (edition-agnostic in its type signature),
directly reusable for a comparison-page program with zero new component work. **The repo already
has everything a union would need except the union type itself.**

**Precedent it derives from (read directly — `~/lab/Wardfile` is local):**

- `~/lab/Wardfile/app/(marketing)/_intent-page.tsx` (~264 lines) — a single server component with
  a **fixed, hard-ordered scaffold** (hero → optional proof → stats band → category grid →
  product grid → `<details>` FAQ → CTA). It is NOT a discriminated union of interchangeable
  sections; order is locked, only the `IntentContent` data varies.
- `outputs/research/wardfile-frontend-playbook.md:104-110` — Wardfile's "programmatic SEO = one
  template (`IntentLadder`) + N data files" pattern: each of N near-identical keyword pages
  reduces to a `metadata` call + a typed content object + `<IntentLadder content={content}/>`.
  (The excerpt describes the _pattern_; it states no page count.)
- `~/lab/Wardfile/app/(marketing)/` — a live count of pages actually on that template
  (`grep -rl 'IntentLadder|_intent-page' app`, excluding the `_intent-page.tsx` template itself)
  finds **7 real keyword-landing pages** today. Even at N=7 Wardfile chose the ladder because its
  pages are **genuinely near-identical**; Caisson's are not — which is why the recon rejected a
  fixed ladder here. **A triggered Caisson renderer must NOT copy Wardfile's fixed-slot template**
  — it needs a true ordered array of typed variants per page.

## Design

**IF AND ONLY IF the trigger fires, build this. Not before.**

### 1. Trigger gate (first, human)

The build does not begin until a committed initiative doc names ≥ 20 pages that share one
section grammar and 2–3 of them have been sketched against the vocabulary below. This gate is a
document check, not code (see Task 0).

### 2. The section union

A discriminated union keyed on `kind`, every variant backed by an existing `@caisson/ui`
primitive — **no new visual components:**

```ts
// apps/site/lib/page-sections.ts (new, only when triggered)
type PageSection =
  | { kind: "hero"; /* HeroProps subset */ }
  | { kind: "section"; /* SectionProps: eyebrow/title/lede/band */ }
  | { kind: "featureGrid"; cols: 2 | 3; /* FeatureGridProps */ }
  | { kind: "controlMap"; /* array of Card+CodeBlock evidence rows, e.g. ANNEX_CONTROLS shape */ }
  | { kind: "codeArtifact"; /* CodeBlock / Terminal: label/frame/status */ }
  | { kind: "comparison"; /* SkuMatrix: columns/rows — reuses the generic table as-is */ }
  | { kind: "faq"; /* FaqItem[] — native <details> */ }
  | { kind: "cta"; /* closing CTA */ }
  | { kind: "custom"; node: ReactNode }; // MANDATORY escape hatch — see below

interface PageSpec {
  meta: /* PageMeta fields buildMetadata (lib/metadata.ts) + the JSON-LD builders (lib/jsonld.ts) already consume */;
  sections: PageSection[]; // ORDERED ARRAY the data file supplies
}
```

- **Ordered array, per-page — not a fixed-slot template.** The whole reason `(a)` beat `(b)` is
  that Caisson pages share no sequence; the data file dictates order and composition per page.
- **The `custom` / JSX escape hatch is non-negotiable from day one.** Every page examined —
  including the closest precedent, `frameworks/eu-ai-act` — carries 2–4 irreducible
  `cs-tok`-colorized Terminal/CodeBlock artifacts that don't reduce to flat data. Omitting the
  escape hatch is exactly what sank `(b)` at the N=6 recon. `custom` renders its `node` verbatim.

### 3. The renderer

One server component, `<PageSections sections={spec.sections} />`, whose body is a single
**exhaustive** `switch (section.kind)` mapping each variant to its existing primitive (`custom`
→ `section.node`). The exhaustiveness is compiler-enforced (a `never` default arm) so adding a
`kind` without a render arm is a type error, not a silent blank.

> **ponytail:** the renderer is a `switch` over primitives, not a framework. If it grows a
> plugin registry, a config loader, or per-section theming config, someone has smuggled `(b)`'s
> over-build back in. Keep it a switch.

### 4. Per-page data files + routing

Each triggered page is one typed `PageSpec` data file; its route registers in `MARKETING_ROUTES`
(`apps/site/lib/routes.ts`) so `sitemap.ts`/nav/footer pick it up automatically. SEO is unchanged:
`buildMetadata` (`apps/site/lib/metadata.ts`) + the JSON-LD builders (`apps/site/lib/jsonld.ts`)
consume `spec.meta` exactly as the hand-crafted pages do today.

**Data files are compile-time TS, not a runtime boundary — no Zod.** ADR-0002 mandates Zod
`.strict()` at _boundaries_; a static data file authored in-repo and type-checked at build has no
untrusted input to validate. Adding a runtime parse layer here would be ceremony for zero safety
gain. (Contrast: any genuinely external content source would reintroduce the boundary and its
Zod requirement — out of scope for this SPEC.)

### 5. Scope wall

The renderer applies ONLY to the new pages the triggering program creates. The 6–7 existing
hand-crafted pages are not imported into, wrapped by, or migrated onto the union. Their files are
untouched (enforced as a verify check — Task 5).

## Tasks

Atomic, each bounded, each with a verify command. **Task 0 gates all the rest** — Tasks 1–5 do
not begin until Task 0 passes.

0. **Trigger gate (human, blocking).** Confirm a committed initiative doc names ≥ 20 near-identical
   pages sharing one section grammar, and sketch 2–3 of them against the §2 vocabulary. If no such
   program is committed, **stop — this SPEC stays deferred.**
   _Verify:_ the initiative SPEC/board entry enumerates ≥ 20 pages and a section-grammar sketch
   exists; recorded in `docs/state/decisions-and-forks.md`.

1. **`apps/site/lib/page-sections.ts` (new):** the `PageSection` discriminated union + `PageSpec`
   type + the mandatory `custom` variant. No renderer yet.
   _Verify:_ `bun run check` inside `apps/site`; a type test that a mixed-`kind` sample array
   (including `custom`) compiles.

2. **`<PageSections>` renderer:** exhaustive `switch (kind)` mapping each variant to its existing
   `@caisson/ui` primitive; `never` default arm; `custom` renders `node`.
   _Verify:_ `bun test apps/site` — each `kind` renders its primitive; a render smoke test; the
   `never` arm makes an unmapped `kind` a compile error (assert via a type-level check).

3. **Pilot page:** wire ONE page from the triggering program through a `PageSpec` data file + the
   renderer; register its route in `MARKETING_ROUTES`; confirm metadata + JSON-LD emit unchanged.
   _Verify:_ `bun run build` (Next build) green in `apps/site`; the pilot route appears in the
   generated `sitemap.xml`; JSON-LD present on the rendered page.

4. **Author the remaining program pages** as data files (mechanical — one file each), all through
   the same renderer.
   _Verify:_ `bun run build` green; `MARKETING_ROUTES` count increases by exactly N; every new
   route present in `sitemap.xml`.

5. **Scope-wall + changeset check.** Confirm zero edits to the existing 6–7 hand-crafted page
   files; add the changeset.
   _Verify:_ `git diff --name-only origin/main` shows no change under
   `apps/site/app/(marketing)/{compliance,ai-kit,local-first,agentic-dev,procurement}/`,
   `apps/site/app/frameworks/eu-ai-act/`, or `apps/site/app/security/`; `bunx changeset status
--since=origin/main` passes.

## Verification (goal-backward)

Re-ask the goal, not the checklist: _did we build a union renderer for NEW pages driven by real
N ≈ 20+ demand, without touching the existing pages, with a working escape hatch — and did we
avoid rebuilding rejected option `(b)`?_

- **Trigger was real, not speculative:** a committed initiative of ≥ 20 near-identical pages
  existed before any renderer code was written (Task 0 artifact). If this can't be shown, the
  build should not have started.
- **Ordered-array, not fixed-slot:** the union is a per-page `PageSection[]` the data file
  orders — not a Wardfile-style locked template. Two pilot pages with different section orders
  both render correctly.
- **Escape hatch works:** a page carrying a `custom` section with a hand-authored
  `cs-tok`-colorized Terminal/CodeBlock artifact renders it verbatim, unflattened.
- **Existing pages untouched:** `git diff` shows zero changes to the 6–7 hand-crafted page files;
  their JSX, metadata, and JSON-LD are byte-identical to pre-SPEC.
- **SEO contract intact:** new routes flow through the same `MARKETING_ROUTES` SOT and
  `buildMetadata` (`lib/metadata.ts`) / JSON-LD builders (`lib/jsonld.ts`); `sitemap.xml` includes
  all N; no new SEO mechanism was invented.
- **No over-build:** the renderer is a `switch` over existing primitives — no new visual
  component, no plugin registry, no config loader, no Zod parse layer on static data. `bun run
check` + `bun run build` green in `apps/site`.

## Risks

- **(Primary) Scope creep back to rejected option `(b)`.** The recon reached the YAGNI verdict
  twice at N=6. The single largest risk to any future implementer is starting the union _before_
  a real N ≈ 20+ program is committed — that reproduces exactly the over-build finding that killed
  `(b)`. Mitigation: Task 0 is a hard, blocking gate; this SPEC is inert without it.
- **Conflation with the D8(a) SWEEP tail.** The still-open `<Faq>`/`<FeatureGrid>` adoption at
  agentic-dev/procurement/security (`VERIFY-SWEEP.md:17,42`) is a separate, already-decided,
  lower-risk cleanup. Bundling it into this item muddies both. Mitigation: named as a Non-goal.
- **Copying Wardfile's fixed-slot shape.** Wardfile's `_intent-page.tsx` is a locked-order
  template — a poor fit for Caisson's divergent pages. A future implementer reaching for the
  Wardfile precedent must take its _N-data-files-one-renderer_ economics, **not** its
  fixed-scaffold composition. Mitigation: the ordered-array requirement is a locked design
  invariant, re-checked in Verification.
- **Fidelity loss if the scope wall is breached.** Retrofitting the existing SEO-complete pages
  onto the union loses hand-tuned fidelity for zero SEO gain. Mitigation: Task 5's `git diff`
  scope-wall check.
- **Stale ADR-0178 reuse.** The provisional ADR-0178 slot in `SPEC.md:235` is already consumed —
  citing it at lock time would collide. Mitigation: see ADR interactions.

## ADR interactions

- **D8 board lock (`docs/state/decisions-and-forks.md:164`, `:286`) — complements, does NOT
  supersede.** That lock chose `(a)` targeted wins for the EXISTING pages and rejected `(b)`.
  This SPEC realizes the _disjoint_ `(c)` branch (a union for NEW pages only) — it neither
  reverses nor reopens the `(a)` decision. The board row needs **no edit** unless the operator
  wants to sharpen the trigger wording; the current phrasing ("adopt a union iff an N≈20+
  keyword-page program appears") already matches this SPEC (see open Fork B).
- **ADR-0079 (SEO scaffold) — extends.** The renderer reuses `buildMetadata`
  (`apps/site/lib/metadata.ts`), the JSON-LD builders (`apps/site/lib/jsonld.ts`), and
  `MARKETING_ROUTES` (`apps/site/lib/routes.ts`); no new SEO contract.
- **ADR-0099 (kit-first, single-implementation) + ADR-0101 (contrast gate) — extends.** Every
  section variant maps to an existing `@caisson/ui` primitive; no new visual component, no new
  design language.
- **ADR-0189 (≤10% single-accent lock) — holds unchanged.** Composing existing primitives inherits
  their token discipline; the renderer introduces no new color/accent surface.
- **ADR-0002 (engineering invariants) — applies, with one explicit carve-out.** TS-strict, no
  `any`, `crypto.randomUUID()` where IDs are minted, changeset gate. **Zod `.strict()` is NOT
  required on the page data files** — they are compile-time-static in-repo source, not a runtime
  boundary (documented in Design §4). Any future _external_ content source would reintroduce the
  boundary and its Zod requirement.
- **ADR-0178 numbering — REQUIRES A FRESH ADR AT LOCK (do NOT reuse the stale slot).** The
  Stream-D SPEC provisionally reserved ADR-0178 for "D8 resolution (only if a union is adopted)"
  (`SPEC.md:235`). That number is now consumed by an unrelated lock —
  `knowledge/decisions/ADR-0178-edition-members-fold.md` (`docs/adr-index.md:463`). Per the
  ADR-0088 append-only / renumber-by-meaning convention, a future D8-union lock MUST draw a fresh
  number off the then-current ceiling (**0217 today → 0218+ at lock**) — never cite the stale 0178
  placeholder in the SPEC text or the ADR.

## Open forks (operator-owned — do not auto-decide)

Presented per the caisson one-operator rule: recommendation labeled with confidence + evidence,
then wait for the lock.

- **Fork A — Trigger threshold N.**
  - **Options:** (A1) keep **N ≈ 20+** committed near-identical pages · (A2) lower to N ≈ 12 ·
    (A3) require a program regardless of exact N (qualitative "clearly repetitive" bar).
  - **Recommendation: A1 (keep N ≈ 20+).** _Confidence: high._ It is the bar the Stream-D SPEC
    itself set (`SPEC.md:212-213`), sitting below the **N≈50 payoff point that same line cites for
    a Wardfile-style ladder**. For scale, Wardfile actually runs its ladder at just **N=7** real
    pages today (live grep of `~/lab/Wardfile/app`) — and those pages are _genuinely
    near-identical_, which Caisson's divergent pages are not — so an N≈20 bar is already generous
    headroom before a union earns its keep here. Lowering the bar invites the build-ahead-of-need
    failure the recon warned against twice.

- **Fork B — What counts as "one program."**
  - **Options:** (B1) a **single committed initiative** of ≥ 20 near-identical pages · (B2) allow
    an **aggregate** of several smaller candidate programs (framework + comparison + adapter pages)
    to sum to the bar.
  - **Recommendation: B1 (single committed initiative).** _Confidence: high._ B2 is
    death-by-a-thousand-cuts — summing "somedays" into a speculative build is precisely the YAGNI
    trap. A genuine glossary program is the one candidate that clears N≈20 on its own.

- **Fork C — First triggering program (product scope, may be deferred entirely).**
  - **Options:** (C1) **wait for organic demand** — build nothing, this SPEC stays inert · (C2)
    pre-commit a bulk **glossary/definition-term** program now (the one candidate that plausibly
    clears N≈20 alone) · (C3) pre-commit a comparison-pages or adapter-pages program (each < 20 —
    would only qualify under Fork B2).
  - **Recommendation: C1 (wait).** _Confidence: high._ None of the smaller candidates clears the
    bar alone today; committing one just to justify the renderer inverts the cause and effect. If
    the operator _does_ want a glossary program on the roadmap, that is its own product SPEC — this
    renderer becomes its implementation detail, locked together at that time.

- **Fork D — Fork-board wording.**
  - **Options:** (D1) leave `docs/state/decisions-and-forks.md`'s open-item row **as-is** (research
    found the current wording already matches this SPEC) · (D2) edit the row to reference this SPEC
    id + sharpen the trigger language.
  - **Recommendation: D1 (leave as-is).** _Confidence: medium-high._ The existing phrasing needs no
    change; D2 is optional housekeeping the operator may want only if they prefer the board to point
    at this drafted SPEC by name.

## Effort: N/A — inert until triggered (Tasks 1–5 ≈ 1–2 days of mechanical work once Task 0's gate fires). Value: HIGH-when-triggered — turns "add an SEO page" into "add one data file" for a real N≈20+ bulk program; ZERO until such a program is committed (building sooner reproduces the twice-rejected `(b)` over-build).
