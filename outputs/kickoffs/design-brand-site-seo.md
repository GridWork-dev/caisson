# KICKOFF — Design · Brand · SEO · Copy (scope + research + lock)

Paste the **launcher** below as the first message of a fresh Claude session in the
`~/lab/caisson-design` worktree (branch `design/brand-site-seo`, off clean `main`). This is an
**ultracode** session — fan out subagents for research, then synthesis, then spec authoring, then
verify/sweep.

---

You are running the **Design · Brand · SEO · Copy scope session** for Caisson (`@caisson/*`, repo
`GridWork-dev/caisson`). Branch `design/brand-site-seo`, off `main` (carries the shipped GTM site
`apps/site` + the `packages/ui` token contract). This is **ultracode**: exhaustive, multi-agent,
token cost is not a constraint.

## Mode (binding)

**Scope + research + lock forks — SPEC-FIRST, NO product code this session.** No edits to
`apps/site` implementation or `packages/ui` tokens. Output is: research artifacts → a fully surfaced
**fork board** across the 4 surfaces → (operator locks) → **design SPEC + ADRs** + amendments to
`specs/03-design-framework.md` and `specs/04-voice-and-brand.md`. The site _implementation_ is a
separate later execution session this one scopes.

## Surfaces in scope (all four)

1. **Site visual design + polish** — `apps/site` marketing pages: layout, hierarchy, components,
   responsive, motion, craft.
2. **Brand identity** — **EXPAND the foundation**: logomark/wordmark, brand book,
   illustration/iconography, motion language. **This MAY supersede ADR-0042** (palette A + type
   Structural) via a NEW append-only ADR. ADR-0040 (compliance-hero positioning) and ADR-0041 (name
   **Caisson**) stay **LOCKED — do not relitigate.**
3. **SEO** — technical (meta, sitemap, JSON-LD, OG/social, Core Web Vitals, crawlability) **and**
   content/keyword strategy, IA, internal linking — **balanced**.
4. **Marketing copy + messaging** — further copy across home / 4 edition pages / pricing / docs:
   value props, headlines, persona-targeted messaging, voice consistency.

## Tools (use all three)

- **refero** MCP — reference research + critique: `refero_search_styles` / `_search_screens` /
  `_search_flows` (+ `_get_*`, `_get_similar_screens`). Pull real product screens/flows/styles for
  compliance SaaS, dev-tool libraries, AI-infra, pricing/edition pages, brand systems.
- **exa** — competitor teardowns, positioning/messaging, **SEO keyword + SERP landscape**, technical
  SEO best practice, brand-identity references. `web_search_exa` / `web_search_advanced_exa`
  (date/domain-filtered); `get_code_context_exa` for Next.js 16 / Fumadocs / structured-data specifics.
- **impeccable** skill — **full principles + the detector/audit pass** on the current `apps/site`
  (rendered marketing pages + components) against the brand floor. This is the craft engine; run its
  audit/detector to enumerate concrete craft gaps.

## Workflow (author + run as an ultracode Workflow)

**Phase RESEARCH (parallel fanout — many subagents):**

- **refero reference** — brand systems · hero/landing patterns · pricing/edition-page layouts ·
  dev-tool & compliance-SaaS screens · motion/interaction flows. Curate the strongest references with
  rationale.
- **exa competitor teardown** — positioning + visual + IA + SEO of comparable players (compliance
  SaaS, dev-tool/boilerplate libraries, AI-infra, local-first). What they lead with, how they price,
  how they rank.
- **exa SEO/keyword landscape** — keyword clusters per surface/persona (compliance, AI-kit,
  local-first, agentic-dev), SERP intent, structured-data + technical-SEO checklist for a static
  Next-on-Cloudflare-Pages site, OG/social best practice.
- **impeccable detector/audit** — run on the current marketing pages + components; output concrete,
  prioritized craft findings (hierarchy, spacing, type, color, motion, a11y/contrast — note
  `apps/site/lib/contrast.ts` exists).
- **current-state audit** — brand tokens (`packages/ui/src/tokens/{foundation,theme,candidates,types}.ts`
  vs ADR-0042); existing copy (`apps/site/app/(marketing)/{page,compliance,ai-kit,local-first,agentic-dev,pricing}/…`);
  existing SEO (`app/{robots.ts,sitemap.ts,opengraph-image.tsx}`, `app/llms.txt`, `app/llms-full.txt`,
  the SoftwareApplication JSON-LD, `components/site-{nav,footer}.tsx`).

**Phase SYNTHESIS** — consolidate into a single **fork board** across the 4 surfaces. Every fork:
options + a recommendation labeled with **confidence + evidence**, operator-gated. Be exhaustive
(Wave-1 surfaced 117 forks — match that ambition). Use a completeness critic: what surface/claim/page
went un-audited?

**Phase LOCK (operator)** — surface ALL forks via `AskUserQuestion` picker rounds (batch
architecture-level forks per surface; present the brand-expansion + name/hero-adjacent ones
individually). Operator decides; record each lock as an append-only ADR in `knowledge/decisions/`.

**Phase EXECUTE (spec authoring — NOT site code):** write the **design SPEC** (`specs/` or
`outputs/specs/design-…/SPEC.md`) + the ADRs (brand-expansion ADR — may supersede ADR-0042; SEO
strategy ADR; copy/messaging + voice ADR; visual-design system spec). Amend `specs/03-design-framework.md`

- `specs/04-voice-and-brand.md`. Author the implementation backlog (the later build session's PLAN seed).

**Phase VERIFY + SWEEP** — goal-backward: do the specs/ADRs achieve the 4-surface scope without
relitigating locked ADR-0040/0041? Consistency across brand↔copy↔SEO↔visual. SWEEP for gaps +
downstream notes for the implementation session (what `apps/site` + `packages/ui` must change).

## Read first

`SUMMARY.md`; `specs/00-product-spec.md` (§positioning) · `02-core-loop-ux.md` ·
`03-design-framework.md` · `04-voice-and-brand.md`; `knowledge/decisions/ADR-0040-positioning-hero.md`
· `ADR-0041-product-name-caisson.md` · `ADR-0042-design-system-foundation.md` ·
`ADR-0086-web-analytics-plausible.md` · `ADR-0087-hero-sku-surface.md`;
`packages/ui/src/tokens/*`; `apps/site/app/(marketing)/*`; `outputs/research/{market-research.md,
scores.json,decisions-log.md,review-findings.json,options.md,demand-signals.md}`;
`outputs/kickoffs/positioning.md` + `gtm-marketing-docs.md` (prior design/GTM sessions);
`docs/state/decisions-and-forks.md` (the live board).

## Rules

- **Never auto-decide a fork** — board options on `docs/state/decisions-and-forks.md` with confidence
  - evidence, recommend, confirm with operator before locking. Locks → append-only ADRs
    (`ADR-NNNN-slug.md`, never edited; supersede with a later ADR). Next free ADR number: check the
    board's ADR-numbering note (Wave-1 used through ADR-0077; design ADRs continue from the next free).
- **Spec-first, doc-only** — no `apps/site`/`packages/ui` product code. The brand foundation may be
  expanded (new ADR superseding 0042); ADR-0040/0041 are locked.
- **Voice** = gridwork-core `identity/voice.md` floor (evidence-forward, no AI-slop) + Caisson
  `specs/04`. **Design** = `identity/design-doctrine.md` + the brand floor + **impeccable**; reference
  research via **refero**.
- **exa-first** for any library/SEO/framework fact (Next.js 16, Fumadocs, structured data) — training
  data lags.
- Atomic conventional commits: `docs(design):` `docs(brand):` `docs(seo):` `docs(copy):`
  `docs(adr):` `docs(state):` `docs(kickoffs):`. One logical change each.
- **No DEPLOY**, no merge of unrelated PRs, no touching the running wave-1 build worktrees.

## Done-when

Research artifacts in `outputs/research/`; a complete 4-surface fork board (locked + open) on
`docs/state/decisions-and-forks.md`; the locked forks recorded as ADRs; a design SPEC + amended
`specs/03`+`04` + an implementation backlog for the later build session. A PR opened for the doc set
(operator merges). No product code, no service restarted.
