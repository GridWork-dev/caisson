---
title: "Glossary / definition-term SEO program — 32 answer-first term pages on the section-union renderer"
status: FORKS LOCKED — ADR-0235 (2026-07-03 fifth picker round); build unblocked. See the LOCKED addendum at the end of this doc; the fork sections below are kept verbatim as the decision record.
tags: [ui, frontend]
proposed-adr: "LOCKED as ADR-0235 (fifth picker round, 2026-07-03)."
adr-interactions: realizes ADR-0232 Fork C (glossary pre-commit; renderer is this program's implementation detail) · folds in outputs/specs/deferred-respec/SPEC-seo-section-union-renderer.md Tasks 1–5 as this SPEC's build tasks (its Task 0 trigger gate is CLEARED by §Term list) · extends ADR-0079 §2 (the `/glossary/{term}` taxonomy — scaled past the original 6–10 pilot per the 0232 override, decoupled from the SOC2/HIPAA framework-pilot gate) · reuses ADR-0079 §4 (buildMetadata, root @graph, breadcrumb, self-canonical) + one net-new `DefinedTerm` JSON-LD builder · governed by ADR-0080 (copy laws — precise-scope, owned-vocab, committed-claims, answer-first, competitor-ban) · ADR-0082 (artifacts true-to-built) · ADR-0099 (kit-first, no new visual component) · ADR-0002 Zod carve-out (compile-time-static data, no runtime boundary — same as the renderer SPEC §4)
linear: "(none yet — file a CAISSON issue in project 'Site & Buyer Dashboard' at PLAN, gitBranchName → feature/glossary-program)"
originating: ADR-0232 (SEO section-union renderer trigger + glossary program pre-commit, Fork C operator OVERRIDE)
---

# SPEC — Glossary / definition-term SEO program

## Goal (WHAT + WHY)

**WHAT:** A committed program of **32 answer-first `/glossary/<slug>` definition pages** for the
technical vocabulary a Caisson prospect actually searches — WORM audit log, Row-Level Security,
OSCAL, field-level encryption, offline license verification, token metering, governed agents,
on-device vector search, and 24 more — each page defining the term, showing the **real Caisson code
that implements it**, and routing to the product surface that sells it. The pages are driven by a
per-term typed data record through the **section-union `<PageSections>` renderer**
(`outputs/specs/deferred-respec/SPEC-seo-section-union-renderer.md`), whose Tasks 1–5 are folded into
this SPEC — the renderer ships as this program's implementation vehicle, nothing more.

**WHY now:** ADR-0232 Fork C is an operator OVERRIDE of the renderer SPEC's "wait for organic
demand" recommendation: the glossary is the one candidate program that plausibly clears the
**N ≈ 20+ single-initiative bar** alone (renderer SPEC §"Why now" table), and pre-committing it both
fires the renderer trigger and lands the SEO surface ADR-0079 §2 always slated (`/glossary/{term}`
in the hub/spoke taxonomy). The program exploits the ADR-0040 picks-and-shovels gap: compliance +
dev-infra long-tail terms are near-zero-competition technical content for a zero-DA domain, and a
glossary term mapped to running code meets the unique-content floor **by construction** — the exact
"every programmatic page carries a real code artifact" mandate of ADR-0079 §2.

**Why a glossary is the RIGHT trigger (not a stretch to hit N):** unlike Caisson's 6–7 divergent
hand-crafted marketing pages, glossary pages are **genuinely near-identical** — one section grammar
(definition → code artifact → properties → FAQ → CTA) repeated across N terms. That near-identity is
precisely what earns the union renderer its keep (renderer SPEC Fork A/B), and precisely what the
divergent existing pages lacked when option `(b)` was rejected twice at N≈6.

## Trigger gate (renderer SPEC Task 0) — CLEARED by this SPEC

The renderer SPEC's blocking Task 0 requires "a committed initiative doc names ≥ 20 near-identical
pages sharing one section grammar, and 2–3 sketched against the §2 vocabulary." **This SPEC is that
document.** §Term list names **32** committed pages; §Per-page data shape sketches the shared section
grammar; §Term list's cluster A/B/D rows are the 2–3 grammar sketches (WORM audit log, Row-Level
Security, token metering all reduce to the same ordered `PageSection[]`). The gate is satisfied — the
renderer is unblocked to build **as part of this program**, and only this program.

## Non-goals

- **Do NOT reopen the renderer SPEC forks A–D.** ADR-0232 already locked them (N≈20+ · single
  initiative · glossary first · board wording). This SPEC consumes those locks; it does not relitigate them.
- **Do NOT retrofit or touch the 6–7 hand-crafted pages** (`compliance`, `ai-kit`, `local-first`,
  `agentic-dev`, `procurement`, `frameworks/eu-ai-act`, `security`). The renderer's scope wall
  (renderer SPEC §5, Task 5) is inherited verbatim — glossary routes only.
- **Do NOT compete for ceded head terms.** ADR-0079 §1 cedes `[framework] compliance` head terms.
  Glossary terms are the **dev-kit long-tail** ("worm audit log", "postgres row level security"),
  never "SOC 2 compliance software". The term is fair game on a free page; the paid hero is never
  discounted (ADR-0040 firewall).
- **No head-to-head comparison content.** No "Caisson vs Vanta" glossary entries (ADR-0079 rejected
  kit-vs-kit; ADR-0080 competitor-term ban). Contrast lines are allowed only in the owned-vocabulary
  register ("a scanner is a smoke detector" — ADR-0080 §4), never a comparison table.
- **No CMS, no runtime content editing, no MDX.** Term records are compile-time-typed TS source
  committed to the repo (renderer SPEC §4 — no Zod parse layer on static data).
- **No new visual component / no new design language.** Sections map to existing `@caisson/ui`
  primitives only (ADR-0099).
- **This is NOT the D8(a) SWEEP tail** (`<Faq>`/`<FeatureGrid>` adoption on the existing pages) —
  separate, already-decided cleanup (renderer SPEC Non-goals).

## Current state (cite real files — reuse, don't rebuild)

**Renderer (this program builds it — folded from the renderer SPEC):**

- `outputs/specs/deferred-respec/SPEC-seo-section-union-renderer.md` — the `PageSection` union +
  `PageSpec` + `<PageSections>` switch design (its §2/§3). Locked to build by ADR-0232. **Not yet
  written** — Tasks 1–2 below create it.

**SEO + route infrastructure (reused as-is, unchanged):**

- `apps/site/lib/routes.ts` — `MARKETING_ROUTES` (the nav/footer/sitemap SOT). The `/glossary` **hub**
  registers here; the 32 **spokes** go through the sitemap's separate programmatic block (see §IA).
- `apps/site/lib/metadata.ts` — `buildMetadata` (`PageMeta` → `Metadata`); every term page reuses it,
  no new SEO contract.
- `apps/site/lib/jsonld.ts` — `serializeJsonLd`, `breadcrumb`, `techArticle`, `faqPage`, `rootGraph`.
  Reused as-is. The **one net-new builder** is `definedTerm()` / `definedTermSet()` (schema.org
  `DefinedTerm` is the correct type for a glossary — small pure functions, consistent with the existing
  builders).
- `apps/site/app/sitemap.ts` — derives marketing 1:1 from `MARKETING_ROUTES` **and already
  special-cases** Fumadocs pages via `source.getPages()` (`sitemap.ts:25-30`). The 32 glossary spokes
  append the same way — a `GLOSSARY_TERMS.map(...)` block — so the bulk program never pollutes the
  hand-curated nav/footer list.
- `apps/site/app/frameworks/layout.tsx` — the exact hub-layout precedent: a top-level route outside
  `(marketing)` that re-adds `<SiteNav>` + `<SiteFooter>`. `app/glossary/layout.tsx` mirrors it.

**Component vocabulary (verified barrel `apps/site/components/index.ts`):** `Hero`, `Section`,
`Card`, `CodeBlock`, `Terminal`, `Faq`, `FeatureGrid`, `CredentialStrip`, `StatusChip`, `Icon`,
`Reveal`, `Button` — every glossary section maps to one of these. Nothing new needed.

**The shape a term reduces to (verified precedent):** `apps/site/app/frameworks/eu-ai-act/page.tsx`'s
`ANNEX_CONTROLS` array (`:31-119`) is already "typed data → Card + CodeBlock + clause footnote" — the
exact data-driven grammar a glossary control-artifact section uses. The precedent that the shape
reduces to flat data is in-repo.

## IA + routing (ADR-0079 §2/§4)

**Route tree** (mirrors `/frameworks`, outside `(marketing)`):

```
app/glossary/
  layout.tsx          # <SiteNav> + <main> + <SiteFooter> — copy of frameworks/layout.tsx
  page.tsx            # the HUB: A–Z / clustered index of all 32 terms + DefinedTermSet JSON-LD
  [slug]/page.tsx     # ONE dynamic spoke file; generateStaticParams() from GLOSSARY_TERMS →
                      # renders <PageSections sections={glossaryPageSpec(term).sections} />
```

- **One dynamic route file, not 32 page.tsx** — `generateStaticParams()` pre-renders all 32 at build
  (the site is a Next standalone app, ADR-0114, but per-route static rendering is unchanged). Adding a
  term = adding a record to `GLOSSARY_TERMS`, never a new route file. This is the whole economics of the
  program (renderer SPEC goal: "add an SEO page" → "add one data file").
- **Hub in the registry, spokes in the sitemap block.** `{ path: "/glossary", label: "Glossary",
group: "product", ... }` joins `MARKETING_ROUTES`. The 32 spokes enter `sitemap.xml` via a new
  `GLOSSARY_TERMS`-derived block in `sitemap.ts` (mirroring the docs block) — keeping the nav/footer
  source clean.
- **Nav placement:** hub in the **footer**, not primary nav (ADR-0079 §4 crawl-hygiene — keep nav lean,
  as agentic-dev already is). See Fork D-nav.
- **Breadcrumb:** `Home → Glossary → <Term>` on every spoke (`breadcrumb()` from `jsonld.ts`), plus
  `BreadcrumbList` JSON-LD — hub/spoke crawl paths per ADR-0079 §2.
- **Per-page SEO is unchanged:** `buildMetadata({ title: "<Term>", description: <40–60-word def>,
path: "/glossary/<slug>", type: "article" })` → self-canonical + OG + Twitter, exactly as the
  hand-crafted pages do. Default OG card (per-term satori OG is out of scope — a fast-follow, not this
  program).

## Per-page data shape (feeds the `PageSections` union)

A term is a **terse content record**; a small glossary-specific builder stamps the shared grammar and
emits the generic `PageSpec { meta, sections }` the renderer consumes. The builder is one _caller_ of
the renderer — it does **not** push a fixed-slot template into the renderer (which stays a generic
`switch`, renderer SPEC §3). This is Wardfile's "typed content → one call" economics _without_
Wardfile's locked scaffold.

```ts
// apps/site/lib/glossary.ts  (new — Task 3)
type GlossaryCluster = "compliance" | "security" | "licensing" | "ai-infra";

interface GlossaryTerm {
  slug: string; // "worm-audit-log"  → /glossary/worm-audit-log
  term: string; // "WORM audit log"   → H1 + <title> + DefinedTerm.name
  cluster: GlossaryCluster; // hub grouping + related-term scoping
  // Answer-first definition: 40–60 words, keyword in the first clause (ADR-0079 §5, ADR-0080 §6).
  // Renders as the lede AND feeds DefinedTerm.description — RAG retrieves openings.
  definition: string;
  // The real Caisson code that implements the term (ADR-0079 §2 mandate; true-to-built, ADR-0082).
  artifact: {
    label: string;
    lang: "ts" | "sql" | "toml" | "bash";
    code: string;
    clause?: string;
  };
  // 2–4 key properties (→ FeatureGrid) — how it works / why it holds.
  properties: { title: string; body: string }[];
  // 2–4 answer-first related questions (→ Faq, real questions only — ADR-0080 §6, no manufactured schema).
  faq: { question: string; answer: string }[];
  // The product surface this term SELLS — intent-matched CTA (ADR-0080 §5).
  sells: { edition?: string; ctaLabel: string; ctaHref: string };
  // Curated cross-links (2–4 slugs) — internal-linking policy is Fork D.
  related?: string[];
}

// Builder: GlossaryTerm → the standard ordered PageSection[] + PageMeta.
function glossaryPageSpec(t: GlossaryTerm): PageSpec {
  // Emits, in order:  hero → section(answer-first def) → codeArtifact → featureGrid(properties)
  //                   → faq → related-terms(custom or section) → cta
  // meta = buildMetadata({ title: t.term, description: t.definition, path: `/glossary/${t.slug}`, type: "article" })
}
```

- **Zod carve-out (ADR-0002, per renderer SPEC §4):** `GLOSSARY_TERMS` is compile-time-static in-repo
  source, type-checked at build — no untrusted input, so no runtime parse layer. `generateStaticParams`
  reading a static array is not a boundary.
- **The `custom` escape hatch stays available** but a glossary page should rarely need it — near-identity
  is the point. If a term needs a hand-authored `cs-tok`-colorized Terminal, it uses `{ kind: "custom" }`
  (renderer SPEC §2, mandatory).

## Content sourcing + tone (ADR-0080 copy laws — binding)

- **Answer-first definitions** — 40–60 words, keyword in the first clause, no wind-up (ADR-0079 §5,
  ADR-0080 §6). RAG retrieves openings; the definition doubles as `DefinedTerm.description`.
- **Committed claims, no hedging** — evidence over adjectives (ADR-0080 §2); no "indicative /
  subject-to-change" frame (ADR-0082). State what the code does, plainly.
- **Honesty boundary is NON-NEGOTIABLE on the compliance cluster** (ADR-0080 §3): precise-scope —
  "Caisson ships the technical controls CC6.x / §164.312 require" and "generates the evidence", **never**
  "Caisson makes you SOC 2 / HIPAA compliant." Over-claim is a trust _and_ YMYL legal risk. This governs
  every framework/control term (WORM, OSCAL, HIPAA safeguards, SOC 2 audit log, evidence bundle,
  retention policy).
- **Every page carries a real code artifact drawn from BUILT packages** (ADR-0079 §2 + ADR-0082
  artifacts-true-to-built): no fabricated CLI/output for unbuilt features. Source artifacts from the
  actual package (`@caisson/kernel` `verifyChain`, `tenancy-rls` policies, `field-crypto` HKDF,
  `ai-meter`, `license-verify`, …) — the eu-ai-act `ANNEX_CONTROLS` artifacts are the fidelity bar.
- **Owned vocabulary, consistently** (ADR-0080 §6): fail-closed, load-bearing, watertight-under-audit,
  evidence pack, holds under load. **Competitor-term ban**: never "platform", "automate compliance",
  "scanner", "detective control" — except in explicit owned contrast (ADR-0080 §1/§4).
- **Intent-matched CTA** (ADR-0080 §5): every term ends routing to the surface it sells —
  "See how the Compliance edition ships WORM →", "Read the RLS docs →". Never a generic "Request access".
- **Drafting source is the repo, not the open web** — definitions grounded in the ADRs + the term's real
  implementation, so each claim is repo-citable (the gw-gtm-copywriter discipline: claims dated +
  PAL-challenged). Who drafts + how much review is Fork B.

## Term list (32 — clears N≈20+ with headroom, sits in the 25–40 target)

Each row: **search intent** (what a prospect types) → **sells** (the product surface). All compliance-
cluster rows are precise-scope-governed (ADR-0080 §3).

### Cluster A — Compliance & audit (10)

| #   | Term (slug)                                               | Search intent                                                          | Sells                                      |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| 1   | WORM audit log (`worm-audit-log`)                         | "worm audit log", "write once read many logging"                       | audit-worm · Compliance edition            |
| 2   | Append-only audit log (`append-only-audit-log`)           | "append only audit log postgres", "immutable audit trail"              | kernel `verifyChain` · audit-worm          |
| 3   | Tamper-evident hash chain (`hash-chain-audit-trail`)      | "tamper evident log", "cryptographic audit trail", "hash-chained logs" | kernel `verifyChain`                       |
| 4   | S3 Object Lock (`s3-object-lock`)                         | "s3 object lock retention", "object lock compliance mode"              | audit-worm live WORM transport (ADR-0201)  |
| 5   | OSCAL (`oscal`)                                           | "what is OSCAL", "OSCAL assessment plan", "OSCAL SSP"                  | Compliance OSCAL converter (ADR-0179/0231) |
| 6   | Control-to-code mapping (`control-to-code-mapping`)       | "SOC 2 control mapping", "map controls to code"                        | Compliance control map                     |
| 7   | Audit evidence bundle (`audit-evidence-bundle`)           | "audit evidence collection", "compliance evidence bundle"              | Compliance evidence bundle                 |
| 8   | WORM retention policy (`worm-retention-policy`)           | "worm retention mode", "governance vs compliance retention"            | retention-runner (ADR-0230)                |
| 9   | HIPAA technical safeguards (`hipaa-technical-safeguards`) | "HIPAA technical safeguards 164.312", "HIPAA audit controls"           | Compliance HIPAA (ADR-0160)                |
| 10  | SOC 2 audit log (`soc2-audit-log`)                        | "SOC 2 audit log requirements", "SOC 2 logging"                        | audit-worm · Compliance                    |

### Cluster B — Multi-tenancy & security (8)

| #   | Term (slug)                                                     | Search intent                                                    | Sells                                  |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| 11  | Row-Level Security / RLS (`row-level-security`)                 | "postgres row level security", "what is RLS", "multi-tenant RLS" | tenancy-rls                            |
| 12  | Fail-closed (`fail-closed`)                                     | "fail closed vs fail open", "fail-closed security design"        | tenancy-rls · the brand differentiator |
| 13  | Multi-tenant isolation (`multi-tenant-isolation`)               | "multi tenant data isolation", "tenant isolation postgres"       | tenancy-rls                            |
| 14  | Field-level encryption (`field-level-encryption`)               | "field level encryption postgres", "column-level encryption"     | field-crypto                           |
| 15  | Envelope encryption / DEK-KEK (`envelope-encryption`)           | "envelope encryption explained", "DEK KEK"                       | field-crypto                           |
| 16  | Crypto-shredding (`crypto-shredding`)                           | "crypto shredding GDPR", "cryptographic erasure"                 | field-crypto per-tenant CMK (ADR-0197) |
| 17  | BYOK — bring your own key (`byok`)                              | "what is BYOK", "bring your own key encryption"                  | field-crypto BYOK (ADR-0162/0208)      |
| 18  | Per-tenant key derivation / HKDF (`per-tenant-encryption-keys`) | "per tenant encryption key", "HKDF key derivation"               | field-crypto                           |

### Cluster C — Licensing & commerce (5)

| #   | Term (slug)                                                   | Search intent                                                       | Sells                           |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------- |
| 19  | Offline license verification (`offline-license-verification`) | "offline license key verification", "verify license without server" | license-verify · license        |
| 20  | Ed25519 license keys (`ed25519-license-keys`)                 | "ed25519 license key", "sign a software license"                    | license issuer (ADR-0110)       |
| 21  | Software entitlement (`software-entitlement`)                 | "entitlement management SaaS", "license entitlement"                | entitlement resolver (ADR-0113) |
| 22  | Credit-based billing (`credit-based-billing`)                 | "usage based billing credits", "prepaid credits SaaS"               | credits · billing               |
| 23  | Self-hosted npm registry (`self-hosted-npm-registry`)         | "private npm registry", "self-hosted package registry"              | registry service (ADR-0223)     |

### Cluster D — AI & agent infrastructure (7)

| #   | Term (slug)                                            | Search intent                                                        | Sells                                    |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------- |
| 24  | LLM cost control (`llm-cost-control`)                  | "LLM cost control", "control OpenAI spend"                           | ai-kit · ai-meter                        |
| 25  | Token metering (`token-metering`)                      | "LLM token metering", "meter token usage"                            | ai-meter (ADR-0217)                      |
| 26  | AI spend circuit breaker (`ai-spend-circuit-breaker`)  | "LLM spend cap", "AI budget circuit breaker"                         | billing spend cap · guardrails           |
| 27  | LLM eval gate / golden-file eval (`llm-eval-gate`)     | "LLM eval CI", "golden-file eval", "eval gate pull request"          | ai-evals (ADR-0214)                      |
| 28  | AI guardrails / egress gate (`ai-guardrails`)          | "LLM guardrails", "AI egress filtering"                              | guardrails (ADR-0215)                    |
| 29  | Governed agents / agent sandboxing (`governed-agents`) | "governed AI agents", "sandbox an AI agent", "agent tool governance" | agent-runner · tool-exec (ADR-0186/0199) |
| 30  | On-device vector search (`on-device-vector-search`)    | "on device vector search", "local embeddings", "offline RAG"         | Local-first AI (local-store)             |

### Cluster E — Cross-cutting concepts (2)

| #   | Term (slug)                                        | Search intent                                         | Sells                           |
| --- | -------------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| 31  | Compliance-as-code (`compliance-as-code`)          | "compliance as code", "compliance automation in code" | the Caisson thesis · Compliance |
| 32  | MCP server / Model Context Protocol (`mcp-server`) | "what is an MCP server", "model context protocol"     | mcp-server package              |

**Curated out (discipline note):** "Merchant of Record" — how Caisson _sells_ (Paddle, ADR-0106), not
what it sells; maps to no product surface, so excluded. Kept as a candidate for a future commerce batch,
not this program.

## Tasks

Atomic, each with a verify command. Tasks 1–2 are the renderer (renderer SPEC Tasks 1–2, verbatim);
Tasks 3–6 build the glossary on it. **Task 0 (trigger gate) is already CLEARED** by §Term list — no
separate task.

1. **`apps/site/lib/page-sections.ts` (new — renderer SPEC Task 1):** the `PageSection` discriminated
   union (`hero`/`section`/`featureGrid`/`controlMap`/`codeArtifact`/`comparison`/`faq`/`cta`/`custom`)
   - `PageSpec`. No renderer yet.
     _Verify:_ `bun run check` in `apps/site`; a type test that a mixed-`kind` array incl. `custom` compiles.

2. **`<PageSections>` renderer (renderer SPEC Task 2):** one server component, exhaustive
   `switch (section.kind)` mapping each variant to its `@caisson/ui` primitive, `never` default arm,
   `custom` → `section.node`.
   _Verify:_ `bun test apps/site` — each `kind` renders its primitive; the `never` arm makes an unmapped
   `kind` a compile error (type-level assert).

3. **`apps/site/lib/glossary.ts` (new):** the `GlossaryTerm` record type + `glossaryPageSpec(term)`
   builder (emits the standard ordered `PageSection[]`) + the net-new `definedTerm()`/`definedTermSet()`
   builders in `lib/jsonld.ts`. Seed `GLOSSARY_TERMS` with the **first 3 terms** (one per grammar sketch:
   WORM audit log, Row-Level Security, token metering) as a vertical slice.
   _Verify:_ `bun run check`; a builder test — a seed term → `PageSpec` with the expected section
   `kind`s in order and a `meta.path` of `/glossary/<slug>`.

4. **Glossary routing + hub (renderer SPEC Task 3, pilot):** `app/glossary/layout.tsx` (copy
   frameworks/layout), `app/glossary/[slug]/page.tsx` (`generateStaticParams` from `GLOSSARY_TERMS` →
   `<PageSections>` + breadcrumb + DefinedTerm + FAQ JSON-LD), `app/glossary/page.tsx` (hub index +
   `DefinedTermSet` JSON-LD). Register `/glossary` in `MARKETING_ROUTES` (footer); extend `sitemap.ts`
   with the `GLOSSARY_TERMS` block.
   _Verify:_ `bun run build` green in `apps/site`; `/glossary` + the 3 seed slugs appear in the generated
   `sitemap.xml`; breadcrumb + DefinedTerm JSON-LD present on a rendered spoke; `buildMetadata` canonical
   is `/glossary/<slug>`.

5. **Author the remaining 29 terms (renderer SPEC Task 4):** one `GlossaryTerm` record each, all through
   the builder + renderer. Content per §Content sourcing (answer-first, precise-scope on the compliance
   cluster, real code artifact, intent-matched CTA). Mechanical after Task 4.
   _Verify:_ `bun run build` green; `GLOSSARY_TERMS.length === 32`; every term route in `sitemap.xml`; a
   data-lint (a small test in `glossary.test.ts`) asserts every term has a code artifact, a `sells.ctaHref`,
   a 40–60-word definition, and a unique slug.

6. **Scope-wall + a11y + changeset (renderer SPEC Task 5 + ADR-0079 §6):** confirm zero edits to the 6–7
   hand-crafted pages; run the Lighthouse a11y/contrast gate on one glossary spoke; add the changeset.
   _Verify:_ `git diff --name-only origin/main` shows no change under
   `apps/site/app/(marketing)/{compliance,ai-kit,local-first,agentic-dev,procurement}/`,
   `apps/site/app/frameworks/eu-ai-act/`, `apps/site/app/security/`; the contrast/a11y gate is green;
   `bunx changeset status --since=origin/main` passes.

## Verification (goal-backward)

Re-ask the goal, not the checklist: _did we ship 32 answer-first glossary pages for real
prospect-searched terms, each mapped to running Caisson code and the surface it sells, on a generic
section-union renderer — without touching the existing pages, without over-claiming compliance, and
without rebuilding the rejected fixed-slot template?_

- **The program is real, not padding to hit N:** 32 committed terms exist as `GlossaryTerm` records,
  each a term a prospect plausibly searches (§Term list intent column) — not filler slugs. `≥ 25` (in the
  25–40 target); the 32 clear N≈20+ with headroom.
- **Renderer stays generic:** `page-sections.ts` is a discriminated union + `<PageSections>` is a
  `switch` with a `never` arm — no plugin registry, no config loader, no per-section theming. The
  glossary builder is one _caller_, not a fixed-slot template pushed into the renderer.
- **Every page earns its unique-content floor:** each rendered spoke shows a real code artifact from a
  built package (ADR-0079 §2), true-to-built (ADR-0082) — no fabricated output. Spot-check 3 spokes.
- **Honesty boundary held:** every compliance-cluster page reads "ships the technical controls / generates
  the evidence", never "makes you compliant" (ADR-0080 §3). Grep the compliance-cluster copy for the
  banned over-claim phrasings; zero hits.
- **SEO contract intact:** spokes flow through `buildMetadata` + the JSON-LD builders + a
  `GLOSSARY_TERMS`-derived sitemap block; `/glossary` hub + all 32 spokes are in `sitemap.xml`; every
  spoke has a self-canonical, a `BreadcrumbList`, and a `DefinedTerm`. No new SEO mechanism invented.
- **Existing pages untouched:** `git diff` shows zero changes to the 6–7 hand-crafted page files.
- **Add-a-term is add-a-record:** demonstrably, a 33rd term would be one record in `GLOSSARY_TERMS` — no
  new route file, no renderer change. That is the program's whole payoff.

## Risks

- **(Primary) Compliance over-claim / YMYL legal exposure.** A glossary at scale multiplies the surface
  where a careless "Caisson makes you SOC 2 compliant" could slip in (ADR-0080 §3 — trust + legal risk).
  Mitigation: precise-scope is a copy law, the compliance cluster gets 100% honesty-boundary review
  (Fork B), and Verification greps for the banned phrasings.
- **Thin / duplicate content penalty.** 32 near-identical pages risk reading as doorway pages if the
  definition or code artifact is boilerplate across terms. Mitigation: each page carries a _distinct_ real
  code artifact (ADR-0079 §2, the unique-content floor by construction) + a term-specific answer-first
  definition; the data-lint (Task 5) enforces the artifact + definition per term.
- **Scope creep back to the rejected renderer option `(b)`.** Building the renderer richer than a
  `switch` reintroduces the twice-rejected over-build. Mitigation: the renderer is copied verbatim from
  its locked SPEC (§3, a `switch`); the glossary builder — not the renderer — holds the standard order.
- **Fabricated artifacts for unbuilt features.** A term mapping to an edition feature that isn't built
  would tempt an invented CLI/output (ADR-0082 violation). Mitigation: artifacts sourced from built
  packages only; every term in §Term list maps to a shipped surface (build-state truth:
  `docs/build-state.md`).
- **Auto-linking over-optimization** (if Fork D picks aggressive interlinking): first-mention
  auto-linking every term everywhere risks keyword-stuffed-link signals. Mitigation: Fork D recommends
  curated related-terms, not auto-linking.

## ADR interactions

- **ADR-0232 (this program's trigger + pre-commit) — realizes.** Fork C pre-committed the glossary and
  locked the renderer as its implementation detail; this SPEC is the product SPEC ADR-0232 called for.
  The renderer SPEC forks A–D are consumed, not reopened.
- **Renderer SPEC (`SPEC-seo-section-union-renderer.md`) — folds in.** Its Tasks 1–5 are this SPEC's
  Tasks 1, 2, 4, 5, 6; its Task 0 trigger gate is cleared by §Term list. The renderer never ships ahead
  of a program (it doesn't — it ships _inside_ this one).
- **ADR-0079 §2 (glossary taxonomy) — extends + scales.** `/glossary/{term}` was always in the hub/spoke
  plan (originally "6–10 answer-first glossary pages" gated on the SOC2/HIPAA framework pilot). ADR-0232's
  override scales it to 32 and **decouples it from that pilot gate** — the glossary stands on its own N.
- **ADR-0079 §4 (technical SEO floor) — reuses + one addition.** Reuses `buildMetadata`, root `@graph`,
  `breadcrumb`, self-canonical. Adds `definedTerm()`/`definedTermSet()` — the correct schema.org type for
  a glossary, a small pure builder consistent with the file.
- **ADR-0080 (copy laws) — governs, non-negotiable.** Precise-scope on the compliance cluster, owned
  vocabulary, committed claims, answer-first openings, competitor-term ban. See §Content sourcing.
- **ADR-0082 (go-live posture) — binds artifacts.** Glossary code artifacts are true-to-built; no
  fabricated CLI/output.
- **ADR-0099 (kit-first) + ADR-0189 (≤10% single-accent) — hold.** Sections map to existing `@caisson/ui`
  primitives; no new visual component, no new accent surface.
- **ADR-0002 (engineering invariants) — applies, with the renderer's Zod carve-out.** TS-strict, no
  `any`, changeset gate. `GLOSSARY_TERMS` is compile-time-static in-repo data, not a runtime boundary — no
  Zod parse (renderer SPEC §4). A future _external_ content source would reintroduce the boundary.
- **ADR numbering — fresh number at lock.** Ceiling is **0233** (fourth picker round). A lock filing draws
  **0234+**, re-verified against `main` per ADR-0088. ADR-0232 already holds the program-level decision;
  this SPEC's four forks lock at the new ADR.

## Open forks (operator-owned — do not auto-decide)

Per the caisson one-operator rule: recommendation labeled with confidence + evidence, then wait for the
lock. (The program _itself_ is already committed by ADR-0232 Fork C — these forks shape _how_ it ships,
not _whether_.)

- **Fork A — Final term-list sign-off.**
  - **Options:** (A1) lock the **32 terms as listed** · (A2) trim to a tighter **~25** (drop the weakest-
    intent rows, e.g. `soc2-audit-log`, `compliance-as-code`, `mcp-server`) · (A3) expand toward **40** with
    a second commerce/infra batch (add Merchant of Record, legal hold, prompt-injection defense, …).
  - **Recommendation: A1 (lock the 32).** _Confidence: high._ 32 clears the N≈20+ bar with real headroom,
    sits mid-band of the 25–40 target, and every row maps to a **shipped** surface (`docs/build-state.md`) —
    no filler. A2 gives up cheap long-tail wins for no cost saving (the renderer/hub cost is fixed); A3 risks
    reaching for weaker-intent terms to pad. Operator strikes any row they judge off-brand before lock.

- **Fork B — Content author + review cadence.**
  - **Options:** (B1) **agent-drafted** (`gw-gtm-copywriter` — claims dated + PAL-challenged) → operator
    **sampled** review, batch-approve · (B2) agent-drafted → operator reviews **every** page pre-publish ·
    (B3) operator writes all copy.
  - **Recommendation: B1 with a mandatory carve-out — 100% operator review of the compliance cluster
    (terms 1–10), sampled review of clusters B–E.** _Confidence: medium-high._ The compliance copy is
    YMYL + honesty-boundary (ADR-0080 §3) and is **not** spot-check-able — one over-claim is a legal risk;
    the security/AI/licensing clusters are lower-stakes technical definitions where sampled review catches
    drift. B2 is safe but slow across 32 pages; B3 spends operator time the agent lane is built to save.

- **Fork C — Rollout shape.**
  - **Options:** (C1) ship **all 32 in one PR** · (C2) ship in **cluster batches** (renderer+hub+compliance
    first, then security → licensing → ai-infra), measuring indexation between · (C3) **pilot 3 → measure
    90 days → scale** (the original ADR-0079 §2 pilot-gate instinct).
  - **Recommendation: C2 (cluster batches).** _Confidence: medium._ The renderer + hub + `definedTerm`
    JSON-LD are a **one-time** cost that lands in batch 1 (with the compliance cluster); every later batch is
    pure data (add records). Batches give the ADR-0079 "measure indexation before scaling" signal without
    re-litigating the pre-commit (ADR-0232 already settled _whether_). C3 re-imposes a 90-day gate ADR-0232's
    override was meant to remove; C1 forgoes the indexation-learning between batches for marginal speed.

- **Fork D — Internal-linking policy.**
  - **Options:** (D1) **minimal** — each spoke links only to its `sells` CTA + the hub · (D2) **curated
    related-terms** — 2–4 hand-picked `related` slugs per term (same-cluster) + CTA + hub · (D3)
    **auto-linked** — first mention of any glossary term anywhere in marketing/docs body auto-links to its page.
  - **Recommendation: D2 (curated related-terms).** _Confidence: medium-high._ D2 builds the term-cluster
    interlink SEO value (topical authority, crawl depth) with a bounded, reviewable link set — the `related`
    field is already in the `GlossaryTerm` shape. D3's automatic density risks keyword-stuffed-link signals
    and the "manufactured density" ADR-0080 warns against; D1 leaves the cluster-authority SEO value on the table.

- **Fork D-nav — Hub nav placement (low-stakes).**
  - **Options:** (N1) `/glossary` in the **footer only** · (N2) in the **primary nav** too.
  - **Recommendation: N1 (footer only).** _Confidence: high._ ADR-0079 §4 crawl-hygiene keeps the primary
    nav lean (agentic-dev is already footer-only); a glossary is a discovery/SEO surface, not a primary
    buyer path. The hub is still fully crawlable from the footer + sitemap.

## Effort / value

**Effort:** Tasks 1–4 ≈ 1–2 days (the renderer + glossary scaffold + hub, mechanical — renderer SPEC's
own estimate). Task 5 (29 term records) is content-bound, not code-bound — the pace is set by Fork B's
review cadence, not engineering (a batch of ~8 records/day is realistic agent-drafted). **Value:** HIGH —
32 near-zero-competition long-tail pages on the ADR-0040 picks-and-shovels gap, each a code-proof surface
that both ranks and demonstrates the product; and the renderer it lands turns every future SEO page into a
data file. The dominant risk is copy (compliance over-claim), not build — which is why Fork B gates the
compliance cluster at 100% review.

---

## LOCKED addendum (ADR-0235, 2026-07-03 fifth picker round)

The five forks above are locked; the sections stay verbatim as the decision record. Binding
picks (full detail in `knowledge/decisions/ADR-0235-glossary-program-fork-locks.md`):

- **Fork A:** the 32 terms as listed (operator may strike a row at content review, never add).
- **Fork B (OVERRIDE):** agent-authored via a multi-agent workflow with research grounding +
  adversarial verification — replaces the tabled operator-review cadence. Claims dated + cited;
  independent skeptic passes enforce ADR-0080; the compliance cluster (terms 1–10) gets the
  strictest refutation pass. The operator gate is the PR merge.
- **Fork C:** cluster batches — batch 1 = renderer + hub + `DefinedTerm` JSON-LD + compliance
  cluster; later batches pure data, measuring indexation between.
- **Fork D:** curated related-terms (2–4 same-cluster slugs + `sells` CTA + hub); no auto-linking.
- **Fork D-nav:** footer only + sitemap.
