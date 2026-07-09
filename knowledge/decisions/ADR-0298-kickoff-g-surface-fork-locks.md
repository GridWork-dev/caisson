# ADR-0298 — Kickoff-G surface-remediation fork locks (twelve, three rounds)

**Status:** accepted · 2026-07-09 (operator-locked, Kickoff-G research-first fork rounds over the
2026-07-09 visual audit + CAISSON-50/60/61/64–70; research passes cited in
`outputs/kickoffs/KICKOFF-G-surface-remediation.md`). **Tags:** `ui`, `frontend`,
`data-migration`.

## Context

Kickoff G (buyer-surface remediation) ran its W1–W4 research passes first — code recon verified
every defect citation, refero supplied real-product pattern evidence, exa-code/exa supplied the
fumadocs-Shiki root cause and the 2025–2026 email-client dark-mode support matrix, and the
2026-07-09 audit screenshots settled the one statically-unconfirmed defect (the home cart bar is
real: the fixed `.mobileBar` renders "0 selected / $0" over hero copy at 390px). Twelve forks
went to the operator in three AskUserQuestion rounds; all twelve locked as follows.

## Decision

**W1 — marketing layout (CAISSON-65/66/67):**

1. **Footer <480px collapses to a single-column stack** (wordmark+tagline lockup on top, nav
   columns stacked, legal last) — not an in-grid wrap. Refero: Linear/GlossGenius/Excalidraw all
   stack; no wrap counter-example found. The `site-footer.tsx` `navLabel` drift fix rides along.
2. **The shared `.cs-matrix` gets `table-layout: fixed` + per-column width constraints +
   word-break** (kills the glued-cell class on all ~20 `/compare` pages and the homepage
   6-bundle table deterministically) — not per-column wrap patches on auto layout.
3. **Mobile matrices stay tabular with contained horizontal scroll** — overflow container (page
   never scrolls sideways), sticky first column, visible scroll cue — not a card-collapse
   re-render. Refero: Make/Typeform/Calendly/OpenAI keep deep matrices tabular; cards appear
   only on plan-selector rows.

**W2 — dashboard/auth (CAISSON-64/69/61):**

4. **Migration lists unify into a single shared source of truth** consumed by both
   `deploy-migrate.ts` and the PGlite dev double, keeping prod-canonical names (`0011/0012`
   ask_ai stay; `0020–0022` added), plus a drift test — not two lists with a superset assertion.
5. **Dashboard topbar mobile: truncate the account pill AND add Sign-out to the mobile nav
   drawer** (the ADR-0296 Dialog drawer variant) — fixes both the clipped pill and the
   no-sign-out-on-mobile defect.
6. **`/dashboard/ai-keys` gains an entitlement gate + upsell** (defense in depth) mirroring the
   compliance-gate pattern — fail-closed at page load and re-checked in server actions. The
   compliance page's gate is exactly what saved it from the missing-table crash class.

**W3 — marketplace media + popout (CAISSON-68):**

7. **The 8 zero-slide modules get authored SVG mechanism diagrams** (alerting, ai-meter,
   ai-evals, guardrails, prompt-registry, local-store, agent-kernel, agent-runner) in the
   existing `marketplace-diagrams.tsx` lane — not a live-component extension. Remotion/video was
   never on the table: ADR-0290 locked all-static/no-video.
8. **Popout dialog reorders metadata-first with a bounded, internally-scrolling code region**
   (refero: TwelveLabs view-code modal pattern) — not a clamp-only fix.
9. **The duplicate code render resolves by dropping the carousel code slide**
   (`omitCodeArtifact: true` in the preview dialog — the ADR-0290 WR-03 pattern the depth page
   already uses); the labeled body CodeBlock stays.

**W4 — docs + email (CAISSON-70/60):**

10. **Docs depth-page scope: FULL sweep (~26 pages)** — the 9 MODULE_PAGES-backed missing pages,
    the 3 partials completed, the bundle overviews reworked to six-bundle vocabulary, AND the
    ~11 no-source modules authored honestly from package source. Nothing parked.
11. **Email dark-mode technique: hybrid** — the light `BRAND_COLOR` palette tuned to survive
    Gmail/Outlook forced inversion (the floor) PLUS `meta color-scheme` + a
    `prefers-color-scheme: dark` authored palette in `layout.tsx` for clients that honor it
    (Apple Mail fully; Outlook Mac/OWA partially). Single-file remediation: all 11 templates
    route color through one const.
12. **The docs sidebar/pagination P3s ride W4** (sidebar drops 3 of 5 bundle links on
    base-package pages; kernel→compliance pagination casing) — not parked.

Decided-by-evidence (technical, recorded for trace, not operator forks): the Shiki fix is the
pure-CSS re-key of fumadocs-ui's compiled `.dark`-gated rules to `[data-theme="dark"]` in
`apps/site/app/global.css` (zero `packages/ui` touch — fumadocs-ui 16.10.6 hardcodes the
selector; shiki dual-theme CSS variables are already emitted); the home cart bar hides when the
selection is empty.

## Consequences

- W1–W4 build as parallel worktree waves (`feat/g-w1-marketing`, `feat/g-w2-dashboard`,
  `feat/g-w3-media`, `feat/g-w4-docs`), each through the in-session SHIP audit lane
  (fable/sonnet implements per the kickoff routing, opus reviews, findings fixed in-branch),
  merge-when-green standing.
- The EULA credit-clause **wording** (CAISSON-61, built in W2) still requires explicit operator
  approval before the W2 merge — a held checkpoint, not covered by merge-when-green.
- The live migration apply for `0020–0022` stays an operator-gated DEPLOY checkpoint (the
  0006–0009 bless pattern) in W5.
- The silent-placeholder class closes structurally: the 28/28 media test extends to depth-page
  slide options so a module without a diagram/component slide fails CI, not just the carousel
  fallback.
