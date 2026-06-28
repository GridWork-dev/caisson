# SPEC — Caisson Design · Brand · SEO · Copy (site v1)

**Status:** spec-committed · 2026-06-27 (Design·Brand·SEO·Copy session). **Tags:** `ui` `frontend` `seo`
`copy` `security` (CSP/legal/waitlist hardening). **Decides:** ADR-0078 (brand), ADR-0079 (SEO), ADR-0080
(copy), ADR-0081 (pricing). **Locked & not relitigated:** ADR-0040 (hero positioning), ADR-0041 (name),
ADR-0045 (static Next 16 + Fumadocs on CF Pages), ADR-0047 (Plausible). **Board:** `FORK-BOARD.md` (148
forks); **research:** `outputs/research/design-session/`.

## Goal

Take `apps/site` from a clean austere scaffold to a **production-grade, brand-complete, SEO-instrumented,
copy-finished** compliance-led marketing + docs surface — without relitigating the locked hero/name. Four
surfaces, one coherent system: a widened brand identity, a polished visual system, a programmatic SEO engine,
and finished persona-targeted copy. This SPEC is the **build session's PLAN seed**.

## 1. Visual design system (the locked craft direction)

- **Hero (home + editions):** split layout — claim + CTAs left, a **framed terminal** showing the _real_
  fail-closed RLS denial right (fills the empty desktop half; the artifact IS the headline). Terminal-window
  chrome with a `● RLS fail-closed` status chip (no mac traffic-lights). **Semantic-tint** code (ERROR/DETAIL
  → `--cs-danger`, `fail-closed` → accent; tint only load-bearing tokens). A `npx create-caisson` **install
  command** beside the artifact. One **signature hero motion** (expressive, ADR-0078 §6): an animated real
  fail-closed event and/or the waterline motif. (V1, V2, V4, V5)
- **Above the fold:** a quiet mono **credential strip** ("SOC 2 · HIPAA · GDPR · EU AI Act — evidence packs
  you generate", never "we are certified"). Persistent **nav CTA** ("Request early access" + ghost Docs). (V7, V23)
- **Evidence cards:** glyph + label + body **+ a one-line mono proof-artifact** per card (RLS → `FORCE ROW
LEVEL SECURITY`; WORM → `ObjectLockMode: COMPLIANCE`; audit → a SHA-256 link). Left-intro / right-dense
  grid for the compliance controls (spec-sheet, not marketing grid). (V8, V11)
- **Editions:** **featured-lead hierarchy** — Compliance spans, the other three follow subordinate; a
  status-chip language (Free·AGPL / Hero / #2 / Roadmap) + a dashed/ghost "scaffolded slot" for roadmap +
  the EU-AI-Act add-on. (V12, V13)
- **SKU / pricing:** a **feature matrix** (editions × included modules — rows modules, cols editions; NOT a
  competitor table, ADR-0040-safe) with the **indicative prices** (ADR-0081) and a single section CTA; an
  edition×module matrix is the biggest missing scannable artifact. (V14, V15, V16, V17)
- **Depth & motion:** **elevation + glow scale** (ADR-0078 §7) — tonal+hairline default, shadow/glow for
  cards/overlays/hero focal point; **tonal-hover affordance** (border brighten + surface step, ~120–160ms);
  a single **fade-up-once** scroll-reveal; the expressive hero moment. (V18, V19, V25, V36, V37)
- **System hygiene:** **extract the duplicated inline-style blocks** (the hero `h1` is byte-identical across
  6 files) into reusable classes/components (`.cs-display`, `Hero`, `Card`, `CodeBlock`, `SkuGrid`);
  **intermediate breakpoints** + a **mobile hamburger nav** (the nav has no responsive branch); promote
  section heads to use the dead 4xl/5xl scale steps; **fluid `clamp()`** display type for mobile. (V29, V27,
  V28, X5)
- **Docs (Fumadocs):** 3-col + right scroll-spy TOC + an always-dark request/response code-rail for API-ref;
  grouped collapsible sidebar (mono group labels) + CMD-K with a visible hint + edition-scoped tree; semantic
  callout set keyed to the functional tokens (glyph + label); filename/lang code-block tabs (TS default, no
  mac dots, copy-with-checkmark); "Copy page as Markdown / Open in Claude" + the existing llms.txt; a docs
  **landing hub** (quickstart tile + per-edition cards + install command). (V31–V35, V38, V39, X9)
- **Error/empty/motion states:** branded `not-found.tsx` / `error.tsx` / `loading.tsx`; terse command-forward
  empty states; honor reduced-motion (content never stuck at `opacity:0`). (X1, V41, V42)

## 2. Brand system → ADR-0078 + DESIGN.md

Keep palette A + Hubot Sans; add a code-mono. Waterline-over-chamber **logomark** + favicon/app-icon kit;
customized monochrome Martian Mono **wordmark**; **line-icon system** (Lucide/Phosphor + ~8–12 bespoke domain
glyphs) replacing the Unicode box glyphs; **blueprint + animated-waterline** illustration motif; **expressive
tokenized motion**; **elevation + glow scale** (supersedes shadowless); always-dark code; mono tabular
numerals; per-edition = icon+label; accent ≤10%; body weight 400. **Author `DESIGN.md`** (the brand book +
anti-boilerplate is/is-not law) before the first brand commit.

## 3. SEO system → ADR-0079

Own the dev-kit long-tail; programmatic `/frameworks` × control engine (pilot SOC 2 + HIPAA, 90-day gate),

- `/use-cases` `/guides` `/glossary` gated on the pilot; EU-AI-Act page now; docs as rankable guides; root
  `@graph` JSON-LD; `buildMetadata()` helper (canonical/OG/twitter); per-edition OG; **self-host fonts**;
  favicon kit; fix home↔/compliance cannibalization; allow-all + content-signals + linked llms.txt; CWV + a11y
  CI baseline.

## 4. Copy system → ADR-0080

Dev-kit-noun register (never "platform"/"automate compliance"); code-as-proof + CI green-checks strip;
technical-vs-administrative honesty boundary; retrofit $-figures; control+clause tags; named-engineer note;
CTA-by-tier; pricing indicative-with-frame; answer-first/FAQ; owned glossary; resolve the Local-first AGPL
contradiction; consent + post-signup copy; CISO/procurement path.

## 5. Pricing → ADR-0081

Indicative anchors shown with a "subject to change before launch" frame; waitlist conversion; final numbers
stay the operator's open fork.

## 6. Implementation backlog (build session PLAN seed)

Priority: **P0 = launch-blocking** (all 4 launch-gate bundles are P0 per operator) · **P1 = launch polish** ·
**P2 = post-launch / pilot-gated**. Each item cites its fork id(s).

### P0 — launch-blocking

**Brand foundation (gates everything visual):**

- B0.1 Token additions to `packages/ui`: motion tokens (`--cs-duration-*`, `--cs-ease-*`), elevation/glow
  scale (`--cs-shadow-*`, `--cs-glow-accent`), code-mono family; body weight → 400; `gen:tokens` regen. (ADR-0078)
- B0.2 Waterline-over-chamber **logomark** (SVG) + favicon/app-icon/manifest kit + `theme-color`. (B4, S23, X-favicon)
- B0.3 **Icon system**: adopt Lucide/Phosphor tuned to 2px/24px + ~8–12 bespoke domain glyphs; replace the
  Unicode box glyphs across all pages. (B7, B8)
- B0.4 Author **DESIGN.md** brand book. (B18, B19)

**Visual (site shell + home + editions):**

- V0.1 Extract the inline-style duplication into `.cs-*` classes + `Hero`/`Card`/`CodeBlock`/`SkuGrid`
  components; **self-host fonts** via `next/font`. (V29, S16)
- V0.2 Split hero + framed terminal chrome + semantic-tint code + install command + the signature hero motion. (V1–V5)
- V0.3 Featured-lead edition hierarchy + status-chip system + evidence proof-lines + credential strip + nav CTA. (V7–V13, V23)
- V0.4 Elevation/glow + tonal-hover + fade-up-once reveal + reduced-motion correctness. (V18, V25, V36, V37, V41)
- V0.5 **Mobile hamburger nav** + intermediate breakpoints + fluid display type. (V27, X4, X5)
- V0.6 Branded **404 / error / loading** routes + real 404 status from the static export. (X1, X13)

**SEO (technical floor):**

- S0.1 Root `@graph` JSON-LD (Org + WebSite + per-page) replacing the duplicated anon block. (S11)
- S0.2 `buildMetadata()` helper (per-page title/desc/canonical/OG/twitter); fix home↔/compliance
  cannibalization; per-edition OG images. (S8, S14, S15, S19)
- S0.3 sitemap `lastmod` + reciprocal links; allow-all robots + content-signals + linked llms.txt + noindex
  the md mirror. (S17, S18, S24)
- S0.4 CWV + a11y **Lighthouse CI baseline + budget**. (S25, C20)

**Copy:**

- C0.1 Dev-kit register pass (banish "platform"/"automate compliance"); tighten edition H1s ≤7w + Agentic-Dev
  CTA; CTA-by-tier; resolve the Local-first AGPL contradiction. (C1–C3, C2, C14, C18)
- C0.2 Proof: CI green-checks strip + claim strip + control+clause tags on home + retrofit figures +
  smoke-detector line + named-engineer note. (C5, C9–C13, C19)
- C0.3 Honesty: technical-vs-administrative boundary + precise-scope guardrail. (C6, C25)
- C0.4 Pricing copy: indicative numbers + "subject to change" frame + consent microcopy + post-signup
  expectation. (C15, C24, X23)

**Launch-gate bundles (P0, operator-selected — all blocking):**

- G0.1 **Legal + privacy floor:** `/privacy` (Resend PII + GDPR basis), `/terms`, commercial-license/EULA
  page, footer Legal column, form consent line. (X15, X23)
- G0.2 **Security hardening:** CSP off `unsafe-inline` (hashed inline scripts) + tighten `img-src`; waitlist
  **spam protection** (honeypot + Cloudflare Turnstile + per-IP rate-limit); `/.well-known/security.txt` + a
  short trust/security page; CI-assert the header set. (X14, X3, X16) — **`security` tag → SHIP security audit.**
- G0.3 **Error routes + a11y:** (folded with V0.6) + skip-to-content link + landmarks + form focus management
  - a11y CI gate. (X1, X6, X20, C2-form)
- G0.4 **Content cadence + funnel:** `/changelog` + RSS (Compliance Updates proof surface); branded
  transactional/nurture email template; CISO/procurement path + section. (X17, X11, X25)

### P1 — launch polish

- Docs: 3-col TOC + grouped sidebar + CMD-K + callouts + code-block tabs + copy-feedback + docs landing hub +
  AI affordance. (V31–V35, V38, V39, X9)
- Visual: section-rhythm bands, page-density hybrid, sticky-nav transition, OG-image motif, theme-toggle
  transition, copy-button morph, breadcrumb UI. (V19, V20, V22, V30, V40, V38, X18)
- SEO: title/meta templates, FAQ schema where real, branded-term + GitHub-repo SEO, Plausible funnel events,
  EU-AI-Act page. (S13, S19, S21, S26, S22)
- Copy: answer-first/FAQ blocks, owned-vocabulary glossary, vary proof types, copy-consistency pass. (C22–C24, C26)
- Brand: always-dark Shiki code theme, accent-discipline tighten, OG hex CI-assert, wordmark lockup polish. (B12, B16, B26, B5)
- Forced-colors / print stylesheet / scrollbar polish. (X7, X10, X12)

### P2 — post-launch / pilot-gated

- Programmatic engine: `/frameworks/{soc2,hipaa}` × control pages (pilot), measure indexation at 90 days;
  then `/use-cases` (4 verticals) + `/guides` (8–12) + `/glossary` (6–10). (S2–S5)
- Forward product surfaces: dashboard credit-ledger / entitlements / data-viz, command palette, empty-state
  system, docs versioning, i18n locale scaffolding. (V43, B24, X19, X22)

## Done-when (this SPEC's scope)

The build session ships **P0 green** (brand foundation + visual shell/home/editions + SEO technical floor +
copy pass + all 4 launch-gate bundles) through `bun run check` + the standards gate + a UI review + a
security audit (the `security` tag), behind one PR; P1/P2 tracked as follow-ups. No DEPLOY (ship stops at the
merged PR).
