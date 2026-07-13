# KICKOFF — caisson: design + motion (standout moments)

> ## ⚠ POST-AUDIT CORRECTIONS (2026-07-13 adversarial round — READ FIRST, overrides items below)
>
> Full detail: `AUDIT-SYNTHESIS.md` §A. Verdict: needs-amendment (both reviewers).
>
> 1. **Task 6 (hero lazy-load) ALREADY SHIPPED** — ADR-0306 merged 07-10: dynamic-import behind idle/lg/no-reduced-motion gates, measured **128.2 KiB gzip vs the ≤130KB error-level home-route budget**. Rescope task 6 to a headroom re-measure only.
> 2. **The motion bundle objection is NOT moot.** "529 KB" was raw-vs-gzip on an off-critical-path lazy chunk. Motion's real cost = ~34–50 KB gzip (useScroll/useTransform need full motion/react, not LazyMotion) landing in the INTERACTIVE home bundle at zero headroom (128.2/130). A real `next build` chunk-delta gate precedes each moment merge. Note `framer-motion@12.42.2` is already in the lockfile (motion = alias, same version) — consider driving it instead of a second alias.
> 3. **Task 1: ADRs are append-only** — write a NEW superseding ADR (next free number), never edit 0307. And per 0307's binding text (CSS-only, transform/opacity-only) even the "dep-free three" exceed it (SVG dash draw, scroll-fed WebGL uniform) → **no motion moment lands before the superseding ADR**, including the dep-free batch. The new ADR must enumerate permitted non-transform properties, canvas-uniform paths, library-bearing components, and budgets.
> 4. **Task 3 (Living Chain): ChainViewer is commercial-package code** (`@caisson/audit-worm`, presentational/SSR-safe by contract) — motion lives in a site-local wrapper driving its inputs; motion NEVER enters the sold package. Build the finale against the per-row verification state vocabulary (sibling SPEC) or keep it swap-ready.
> 5. **Task 2 (Chrome Persists): Chromium-only** (no FF/Safari for cross-doc @view-transition + Speculation Rules) — mark progressive-enhancement, verify plain-nav path.
> 6. **Seal on Proof:** the per-row SPEC has it firing on a `verified` state that doesn't exist yet, on apps/admin (outside this kickoff's scope) — add the sequencing gate or cut the cross-ref.
> 7. **"LCP 186ms measured" is unsourced** (and the doc itself says no field data exists) — drop the claim; land task 7 (web-vitals) before treating perf as settled. **Task 13:** re-run `refero-usage.ts` before trials start; >50% quota = hard stop reopening the Mobbin fork.

- **Type:** design → execution · **Tier:** STANDARD · **Repo:** caisson (`apps/site` primary)
- **Date:** 2026-07-13 · **Source:** design-discovery forks + motion standout redo (operator-corrected mandate: ADRs are context, not caps)

## Locked decisions

- **All five motion moments + the `motion` dep (~20 KB React package; mini bundle explicitly rejected — moment 1 needs `useScroll`/`useTransform`).** Bundle objection moot next to the 529 KB three.js hero chunk.
- Ambition register: standout (Linear/Vercel/Stripe lineage), novelty-map discipline (moments never adjacent); pricing, /security, legal, checkout forms stay still.
- ADR-0307 gets an amendment, not silent conformance.

## Task list (build order)

1. **ADR amendment (operator gate, do first)** — extend ADR-0307 "CSS-first, no motion library" → "CSS-first; `motion` permitted where scroll orchestration or interruptible springs are load-bearing." Lock the five-moment set as the scope. Fork-board entry per the never-auto-decide rule.
2. **Ship the dep-free three first** (can land ahead of the amendment):
   - **Seal on Proof** (S) — one-shot hairline ring draw (SVG dash + `@starting-style`) + spring-overshoot settle via `linear()` easing on `proof-chips`, `license-token-card`, checkout success. The WORM lock engaging.
   - **Waterline Descent** (M) — hero poster/scrim layers on `animation-timeline: scroll()`; one scroll-fed uniform into `FieldHandle` deepens the canvas fog. Watertight-chamber-under-pressure.
   - **Chrome Persists + Door Morph** (S–M) — `@view-transition { navigation: auto }`; nav/logo/footer hold still (~240ms content cross-fade); door card kicker/chip morphs into destination header via matching `view-transition-name`s; Speculation Rules prerender on nav links. Reduced-motion: `::view-transition-group(*) { animation: none }` same commit. **Sequenced after the perf items (view-transition 4s timeout budget).**
3. **The Living Chain** (L — the flagship) — evidence section: ~250vh sticky container; the real SHA-256 `ChainViewer` builds itself on scroll (`useScroll` + per-stage `useTransform` + springs); `prevHash` visibly travels between cards; closes with `verifyChain` stamping `valid: true` + seal tick. Real `buildChain` kernel data (already baked in `audit-worm-demo.tsx`). Reduced-motion: full chain static, verdict visible. INP trace before merge. Lineage: Linear autonomous-demo + Ramp walkthrough + NRK sequencing.
4. **Doors With Weight** (M) — interruptible Motion springs on the dual-door hero (hovered door lifts, sibling settles back); one new accent-drift uniform in `hero-field-scene.ts` so the lattice field answers the cursor (pointer plumbing already exists). Lineage: Vercel Ship magnet + Stripe Connect cubes.
5. **Visual-harness motion leg** — transition-state screenshots + compositor/INP check per moment (ADR-0309 delta). Plus the **anti-slop scanner CI leg** (operator 2026-07-13: both legs): the 44-rule deterministic UI-slop catalog (designer-skill-mcp steal, $0/no-LLM) wired as a caisson CI pre-pass on site pages; gw-core owns the workflow leg.

## Site perf (same kickoff — motion depends on it)

6. **Hero three.js lazy-load — LOCKED (operator 2026-07-13): dynamic-import on idle/visible** (529 KB, largest client chunk, 2.3× next); scene kept as-is, raw-WebGL rewrite rejected for now. Site is otherwise already fast (LCP 186ms measured, CLS 0.00, marketing routes already SSG — PPR skipped as moot).
7. **web-vitals field capture** — no field data exists; PostHog already wired. One small client hook.
8. **CSS one-liners** — `field-sizing: content` (ask-AI textarea), `text-wrap: pretty` (headings/body).

## Design-workflow trials (feed future design phases)

9. **Stitch trial** (half-day, first) — stitch-bridge MCP + `STITCH_API_KEY`; derive DESIGN.md from the copper brand floor; `generate_variants` ×4 on one pricing-hero brief vs a straight impeccable pass. Success: ≥2/4 variants brand-respecting as SHAPE references. Kill: generic-Material output or quota reality (15 edits/day). Manifest + egress row land in gw-core (`system/mcps/stitch.toml`).
10. **Storybook 10.5 trial** (1–2 days) — `packages/ui`: init (Vite builder) + addon-mcp + addon-vitest; agent-generate 10 stories; evaluate docs/testing toolsets (does `get-documentation` beat Read? does the a11y runner catch what `tokens-contrast.test.ts` doesn't?). Success → generate remaining ~30 stories + `storybook build` as buyer-facing component playground. Ladle = null hypothesis if the MCP goes unused.
11. **superdesign — gated** — only if Stitch disappoints or replica-canvas workflow proves needed. Egress boundary: marketing-site files only, **never `ui-pro`**.
12. **Recraft API lane** (PAYG ~$0.04/img) — brand-style pinned from reference images; on-brand illustrations/icons/OG artwork. Fills the only true gap (no image-gen lane).
13. **Reference layer ($0)** — pinned gallery list (saaspo, bestsaaswebdesigns/dark, webanatomy.ai dev-tools scored set) + motion-catalog vocabulary in the refero-design research step. Refero kept (decision recorded in gw-core kickoff). Small probes: **FixAEO free scan** of caisson.sh (external validation of the shipped llms.txt/robots/schema; never pay — ADR-0254) + **21st.dev free tier** (2 MCP searches/day, feeds craft). Nicelydone cut (operator 2026-07-13).

## Deferred / watch (recorded, no tasks)

CSS Anchor Positioning at Baseline → deletes ~390 lines of ui-pro positioning · Takumi when an OG card fights Satori · Mobbin triggers (static-key auth / mobile phase / >50% Refero quota) · Motion `animateView` for same-doc transitions if a SPA-side need appears.

## Gates (STANDARD)

ADR amendment (task 1) is an explicit operator gate. `ui`/`frontend` tags fire UI review at SHIP. INP/compositor evidence required per moment before merge.
