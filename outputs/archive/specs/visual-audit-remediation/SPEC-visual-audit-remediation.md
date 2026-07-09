---
title: "Visual-audit remediation — mobile scroll affordance, contrast, link affordance, copy sweep, sticky buy rail, discrete bugs"
status: FORKS LOCKED — ADR-0242 (2026-07-04 site-design session, operator picker); build unblocked.
tags: [ui, frontend]
proposed-adr: "n/a — this spec executes locked decisions (ADR-0242) plus unambiguous fixes; no new fork"
adr-interactions: realizes ADR-0242 (eyebrow-voice variation, reaffirmed-deferred real media, sticky mobile buy rail) · touches components under the ADR-0078/0189 brand system (contrast/a11y gates stay binding, no token-budget renegotiation) · does not reopen ADR-0237 F2 (real media stays deferred)
originating: full-site Playwright visual-audit workflow (2026-07-04, site-design session) — 48 routes × mobile/desktop × light/dark critiqued against the impeccable skill + DESIGN.md, 221 findings reconciled into `tooling/design-critic/findings.toml`. 14 marked `accepted` (ADR-0242, real-media reaffirm). This spec closes the remaining 207.
---

# SPEC — Visual-audit remediation

## Goal (WHAT + WHY)

**WHAT:** Close out the 207 open findings in `tooling/design-critic/findings.toml` (workflow
`visual-audit`) from clean root causes, not a per-finding whack-a-mole: most of the 207 collapse
into ~8 shared-component or shared-template bugs, so fixing the component fixes every route that
inherits it. The three ADR-0242 picks (eyebrow voice, sticky mobile buy rail) land as their own
workstreams; the real-media reaffirm needs no code.

**WHY:** The audit found systemic patterns, not scattered nits — one CSS rule change resolves ~30
"code sample unreadable on mobile" findings, one component fix resolves ~10 "related terms don't
look clickable" findings, one shared newsletter-widget CSS token resolves ~9 contrast failures. Root-cause fixes are a smaller diff than 207 individual patches and guarantee the pattern doesn't
reappear on the next new page that reuses the same component.

## Current state (ground truth, verified against source during the audit + a follow-up recon pass)

- **Mobile code-sample "clipping"** (Workstream A) is **not data loss**: `packages/ui/src/components/code-block.css:8` and `terminal.css:27` both already set `overflow-x: auto` on the scrollable containers. The screenshots show scroll-position-zero with no visual cue, which reads identically to a hard clip. Confirmed via source read, not guessed.
- **The eyebrow component** (`.cs-eyebrow`, ADR-0078) is a real tokenized primitive with an accent budget — not ad hoc per-page markup — used on nearly every marketing/docs/glossary/legal page template.
- **Module depth-page layout** (`apps/site/app/(marketing)/marketplace/modules/[slug]/`, `depth.module.css`): `<BuyRail>` is the second grid child after `<PageSections>`; below the 900px breakpoint the grid collapses to one column and `BuyRail` falls to DOM-order end — confirmed by a citing finding (audit-worm) that named the exact file.
- **Glossary term template** (renderer per ADR-0232/0235, `apps/site/lib/glossary.ts` + the section-union renderer) auto-generates a "DEFINITION" H2 that repeats the H1 term name verbatim on at least 6 term pages, and a "Related terms" link list with no `--cs-link` styling applied on at least 10 term pages.
- **Footer newsletter widget** (shared component rendered in every page footer): placeholder text measures ~3.3:1 in light mode across changelog/cart/glossary/legal-terms/legal-privacy/glossary-oscal/glossary-soc2-audit-log/glossary-token-metering/agentic-dev — same measured value everywhere, confirming one shared CSS rule, not per-page drift.
- **`/reset-password` contradictory-headers bug is ALREADY FIXED** (this session, ahead of this spec, since it was an unambiguous bug in code written earlier the same session): the page now reads `token` server-side and renders one coherent message instead of a static Hero plus a client form that could independently discover a missing token.
- **`/preview/emails` "dead route" finding is a screenshot-methodology artifact, not a product bug**: the harness captured screenshots against `bun run start` (a production build), and the route's own `if (process.env.NODE_ENV === "production") notFound()` guard correctly fired. No code change — noting it in the ledger disposition below.

## Workstreams

### A — Mobile code-sample scroll affordance (~30 findings, shared CSS)

Add a scroll-shadow affordance to the already-scrollable code containers so mobile users can tell
there's more content, at the two shared components: `packages/ui/src/components/code-block.css`
and `terminal.css`. A right-edge fade-gradient mask (matching `--cs-surface-1`/card background) is
the standard pattern; scope to mobile breakpoints only if the desktop clipping cases (ai-kit,
security, frameworks/eu-ai-act desktop) turn out to be the same root cause on inspection — confirm
before assuming desktop needs the identical treatment. Verify against a live re-run of the harness
on at least 3 affected routes (one static page, one module depth page, one glossary term) before
closing the cluster.

### B — Mobile marketplace-hub tab overflow (4 findings, `high`)

The Editions/Modules/Build/Plans tab row on `/marketplace`, `/marketplace/modules`,
`/marketplace/build`, `/marketplace/plans` overflows 390-444px with the active tab and "Plans"
pushed off-screen, zero scroll affordance. Make the row horizontally scrollable with the same
fade-edge treatment as Workstream A (shared visual language, not a second bespoke solution) rather
than a dropdown/select fallback — the tab bar is the existing IA (ADR-0237 F1), a scroll affordance
preserves it.

### C — Light-mode footer/newsletter placeholder contrast (~9 findings, shared token)

The `you@company.com` placeholder in the newsletter footer widget measures ~3.3:1 in light mode
(below the 4.5:1 floor) and ~4.8:1 in dark mode. Darken the light-mode placeholder color token so
both modes clear AA — one token change, not a per-page fix. Re-verify with a contrast check, not
eyeballing.

### D — Glossary related-terms link affordance (~10 findings, shared component)

"Related terms" links on glossary term pages render in plain body-ink color with no underline or
`--cs-link` accent, so nothing signals they're clickable (Nielsen #6, and the glossary program's
own cross-linking goal per ADR-0235). Apply the site's existing `--cs-link` treatment (underline
or accent color, matching how inline links render elsewhere on the same pages) to the shared
related-terms component in the glossary template.

### E — Glossary restated-heading template bug (~6 findings, shared template)

The auto-generated "DEFINITION" section heading repeats the H1 term name verbatim with no new
information on at least 6 term pages (worm-audit-log, s3-object-lock, oscal,
control-to-code-mapping, worm-retention-policy; hash-chain-audit-trail repeats it a third time in
the closing CTA). Fix in the section-union renderer's default heading generation, not per-term
content edits — drop the redundant restatement or replace it with a one-line definitional lede.

### F — Eyebrow voice variation (ADR-0242 lock, ~20 findings, copy workstream)

Vary eyebrow wording/weight per section on the affected templates (home, compliance, ai-kit,
local-first, agentic-dev, security, marketplace hub + tabs, legal/terms, legal/privacy, legal/eula,
frameworks/eu-ai-act, glossary hub + most term pages) so the repetition reads as deliberate voice,
not reflexive scaffolding, per the ADR-0242 lock. This is copy/usage-pattern work, not a component
change — the `.cs-eyebrow` primitive and its accent budget (ADR-0078) are untouched. Route through
the existing draft → honesty/copy-law skeptic → gate pipeline (ADR-0235 Fork B pattern) given the
surface area (11+ templates); ADR-0080 copy laws stay binding.

### G — Sticky mobile buy rail (ADR-0242 lock, 9 findings, new component + template wiring)

Build a sticky bottom bar (price + Add-to-cart) for the mobile viewport on all 11 module depth
pages, replacing the current DOM-order fallback that sinks the buy rail below the FAQ. Needs: a
new sticky-positioned component (`packages/ui` or `apps/site/components`), safe-area-inset handling
for notched devices, a z-index slot on the existing scale (nav is currently the topmost layer —
confirm the buy bar doesn't compete), and wiring into the shared module depth-page template
(`depth.module.css` + the `[slug]/page.tsx` grid). Verify it doesn't obscure the FAQ's last item or
double up with the existing sticky desktop sidebar rail at the tablet breakpoint.

### H — Copy sweep: em dashes + aphoristic cadence (~16 findings, mechanical + light rewrite)

Two sub-patterns, same fix shape (a copy pass, not code):

1. **Em dash / en-dash-as-connector removal** — SKILL.md's explicit "no em dashes" rule, violated
   on local-first, cart, legal/license, glossary (hero + several term pages),
   marketplace/modules/audit-worm, ai-meter, agent-kernel, procurement (en dash). Replace with
   commas/colons/semicolons/periods/parentheses per the rule; this mirrors the repo's own existing
   P2 prose-remediation pattern (ADR-0241's sibling effort), so reuse that sweep's method if still
   available.
2. **"Positive claim, then punchy negation" cadence** flagged at 3+ occurrences per page on ai-kit,
   marketplace/modules, marketplace/build, frameworks/eu-ai-act — a voice rewrite, not a mechanical
   find-replace. Route through the same draft → skeptic → gate pipeline as Workstream F.

### I — Discrete bugs (independent, no shared root cause — fix each directly)

| Finding                                                                                     | Surface                                   | Fix                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broken module-card icon (renders literal "L." instead of the bespoke glyph)                 | `marketplace__modules`, Agent-runner card | Icon-resolution bug in the module card's icon-lookup — find the missing/misspelled icon-id mapping for `agent-runner` and correct it.                                                                                         |
| Garbled pricing description ("workspace:\* dependency... " — stray asterisk + missing word) | `marketplace__modules__alerting`          | Copy fix in the alerting module's pricing-card description string.                                                                                                                                                            |
| Mobile price truncation (3-digit prices render as 2-digit: "$199"→"$19")                    | `marketplace__build`                      | Data-correctness bug in the stack-configurator's price-column CSS (fixed width truncating instead of fitting) — this is on the live pricing surface, treat as high priority regardless of the rest of this spec's sequencing. |
| Dropped word-space in a cluster heading ("AI & agentinfrastructure")                        | `glossary`                                | Copy/markup fix — a missing space in the cluster heading string or a CSS `word-spacing`/`white-space` bug collapsing it only at desktop width.                                                                                |
| Sidebar nav group repeats its own name as its only child link ("Base substrate")            | `docs`, `docs__getting-started`           | Docs nav config fix — give the child link a distinct label or collapse the redundant group level.                                                                                                                             |

### J — Ledger dispositions requiring no fix

- **14 real-media findings**: already marked `accepted` in `findings.toml` per ADR-0242 (reaffirmed
  deferred, ADR-0237 F2). No action.
- **`/preview/emails` "dead route"**: methodology artifact (production-mode `notFound()` gate
  correctly fired against the harness's `bun run start` capture) — mark `accepted` with a note, not
  a bug. Re-verify by running the harness against `bun run dev` if this route's real appearance
  ever needs auditing.
- **`/preview/emails` Turnstile widget broken**: this specific capture is on the 404 page's shared
  footer, so it's really a finding about the sitewide newsletter Turnstile integration, surfaced via
  an unrelated route. Worth a quick standalone check (is this a local/sandbox Turnstile key issue or
  a real production-affecting bug?) before deciding whether it needs its own fix — do not fold into
  Workstream C's contrast fix, it's a different failure mode (network/widget error, not styling).

## Verify

- `bun run check` (build + lint + test + standards-gate) stays green after every workstream.
- Re-run `apps/site/scripts/visual-harness.ts` against the affected routes per workstream (not
  necessarily all 48 every time) and spot-check the specific finding is gone.
- Any `packages/ui` component touched needs its own `bun:test` file per the existing kit convention.
- Changesets for every touched version-tracked package (`@caisson/site`, `@caisson/ui` at minimum),
  external-facing prose, no ADR refs/internal paths per the standards-gate prose rule.
- After remediation, re-run the visual-audit workflow (or a scoped subset) and reconcile again
  through `tooling/design-critic/src/cli.ts` — fixed findings should flip to `closed`/`fixed` in the
  ledger, not linger as `open`.
