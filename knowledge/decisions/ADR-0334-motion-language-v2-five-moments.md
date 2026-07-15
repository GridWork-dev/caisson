# ADR-0334 — Motion language v2: five standout moments; scoped supersession of ADR-0307's CSS-only floor

**Status:** accepted · 2026-07-13 (operator-locked, Kickoff-S design-motion sitting — the
kickoff's task-1 wall; drafted in block 0334–0339, ADR-0088 renumber-at-merge applies. Amended
and re-locked the same sitting, pre-push: the budget numbers were re-measured from a real
`next build` — first-load baseline 423.1 KiB gzip, hero lazy chunk 127.8 KiB — overturning the
audit's conflated "interactive bundle 128.2/130" premise).
**Tags:** `ui`, `frontend`. Supersedes ADR-0307 **in part** (the "CSS-only, no motion library,
transform/opacity-only" binding); ADR-0307's floor discipline otherwise carries forward. Executes
ADR-0078 §6 at the standout register; bounded by ADR-0306 (hero field budget), ADR-0309
(error-level CWV budgets), ADR-0331 (per-row state vocabulary + Seal-on-Proof sequencing gate).

## Context

ADR-0307 locked a sitewide CSS-first motion pass and shipped it. The operator has since
redirected the ambition register: five standout moments (Linear/Vercel/Stripe lineage), which
exceed 0307's binding text in three ways — SVG line-draw animates a stroke property, the hero
field takes scroll-fed shader uniforms, and two moments need real scroll orchestration +
interruptible springs (`useScroll`/`useTransform` — full `framer-motion`, LazyMotion cannot carry
them). ADRs are append-only: 0307 cannot be edited, so this ADR is the superseding instrument.
The 2026-07-13 adversarial audit demanded a real `next build` measurement before any moment
lands; the same-sitting re-measure overturned the audit's own headline number: the ≤130 KiB
error-level ceiling belongs to the ADR-0306 hero LAZY chunk (127.8 KiB gzip measured here, not
in first load), while the home route's interactive first-load JS actually measures 423.1 KiB
gzip (react-dom 70.8 · orama search 69.1+20.9 · fumadocs 24.2 · …) — the "interactive home
bundle at 128.2/130, zero headroom" framing conflated the two. Motion's ~34–50 KiB gzip real
cost still may not land in first load; and `framer-motion@12.42.2` is already in the lockfile
(transitively via fumadocs-ui → motion), so admitting it adds zero new packages.

## Decision

1. **Scope lock — exactly five moments**, novelty-map discipline (moments never adjacent;
   pricing, `/security`, legal, and checkout forms stay still):
   **Seal on Proof** (S — one-shot hairline ring draw + `linear()` spring-overshoot settle) ·
   **Waterline Descent** (M — hero poster/scrim layers on `animation-timeline: scroll()` + one
   scroll-fed fog uniform) · **Chrome Persists + Door Morph** (S–M — cross-document
   `@view-transition`, ~240ms content cross-fade, door kicker/chip morph, Speculation Rules
   prerender; sequenced after the perf items) · **The Living Chain** (L, flagship — ~250vh sticky
   evidence build of the real SHA-256 chain) · **Doors With Weight** (M — interruptible springs
   on the dual-door hero + one pointer-answer uniform). Anything beyond this set is a new ADR.
2. **Permitted non-transform properties/drivers — a closed list.** Beyond 0307's
   transform/opacity floor, authored motion may use ONLY: (a) `stroke-dasharray`/
   `stroke-dashoffset` on inline SVG hairlines, one-shot ≤1s, small elements (paint cost
   bounded); (b) `animation-timeline: scroll()`/`view()` as a _driver_, animating
   transform/opacity only; (c) `linear()` easing functions; (d) `@view-transition` +
   `view-transition-name` + `::view-transition-*` pseudo-elements animating opacity/transform,
   ~240ms, exits faster than enters; (e) WebGL shader uniforms per item 3. Background, color,
   filter, and layout properties stay banned from authored motion. Everything remains tokenized
   (`--cs-duration-*`/`--cs-ease-*`; `linear()` curves land as new tokens).
3. **Canvas-uniform paths — a closed list.** The ADR-0306 field scene admits exactly two new
   inputs, both through `FieldHandle`, poster contract untouched (mobile/reduced-motion/no-WebGL
   visitors still never download the chunk): (a) a scroll-descent input deepening the depth fog
   (Waterline Descent); (b) an accent-drift uniform answering the pointer (Doors With Weight —
   pointer plumbing already exists in-scene). No other uniform is externally drivable.
4. **Motion-library admission — scoped, lazy-only.** `framer-motion@12.42.2` (the real package;
   the `motion` alias is not added) becomes a direct dependency of `apps/site` ONLY. Exactly two
   library-bearing components exist: the **Living Chain site-local wrapper** and the **Doors
   With Weight enhancer** — both loaded via dynamic import behind in-view/idle +
   `prefers-reduced-motion: no-preference` gates, emitted as lazy chunks. `packages/*` never
   import a motion library; `@caisson/audit-worm` stays motion-free (presentational/SSR-safe by
   contract) — the wrapper drives `ChainViewer` through its public props, and its stage/state
   typing uses the ADR-0331 six-state vocabulary (swap-ready: no motion-side reimplementation of
   verification logic).
5. **Seal-on-Proof retarget (ADR-0331 sequencing gate honored).** The per-row `verified` state
   does not exist until the per-row feature ships, and `apps/admin` is outside this kickoff. v1
   Seal targets are `ProofChips` reveal and the `LicenseTokenCard` copy-confirm only; the
   "checkout success" target from the kickoff sketch is DROPPED — no such surface exists (the
   Paddle overlay owns completion UI). Seal-on-`verified` integration waits for the per-row ship.
6. **Reduced-motion contract, per moment.** Seal: ring renders complete, no draw, no overshoot ·
   Waterline: scroll-timeline animations gated off via `@media`; the canvas never loads anyway ·
   Chrome Persists: `::view-transition-group(*) { animation: none }` lands in the same commit ·
   Living Chain: full chain static, verdict visible, no sticky scroll choreography · Doors: no
   lift/spring; token-floor CSS hover only. Everywhere: content never parked at `opacity: 0`, no
   animation on keyboard-initiated or high-frequency actions, no loops (0307 floor carried
   forward).
7. **Budgets + evidence contract (numbers re-measured this sitting).** Home-route interactive
   first-load JS: baseline **423.1 KiB gzip** (2026-07-13; per-chunk table in the PR evidence).
   Motion may add ONLY inline gating shims there — **wave-wide first-load delta ≤ +2 KiB
   gzip**; the first-load diet itself is ADR-0310 territory, out of this scope. The ADR-0306
   hero lazy chunk keeps its **≤130 KiB gzip** ceiling (127.8 measured) and the two item-3
   uniforms must fit inside it. Combined framer-motion-bearing lazy chunks: **≤60 KiB gzip**
   ceiling. EVERY moment merge carries a chunk-delta measurement from
   `apps/site/scripts/measure-first-load.ts` (Turbopack prints no size table — the script
   gzips the route HTML's script set and named lazy chunks). The Living Chain additionally
   carries an INP/compositor trace before merge; scroll-linked DOM animation stays
   compositor-only. Lighthouse error-level budgets (ADR-0309) stand unchanged. Chrome Persists +
   Speculation Rules are Chromium-only progressive enhancement — the plain-navigation path is
   verified as part of its evidence; prerender rules cover marketing nav links only (never
   `/dashboard*`, `/cart`, or API routes).

## Consequences

- The standout register finally has a governing instrument: every permitted deviation from the
  0307 floor is enumerated here — a reviewer can flag any motion outside lists 2/3/4 as a
  violation without judgment calls.
- A motion library enters the repo for the first time, contained to two lazy-loaded site-local
  components with a hard chunk ceiling and zero interactive-bundle cost; removal is two
  components + one dependency line.
- The five moments ship individually revertible, each with its own chunk-delta (and INP where
  applicable) evidence — a budget regression is visible per moment, not per wave.
- The dropped checkout-success target and the gated Seal-on-`verified` keep this ADR honest
  against surfaces that exist today; both re-open with the per-row verification ship (ADR-0331).
