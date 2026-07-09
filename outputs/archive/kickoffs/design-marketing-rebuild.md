# KICKOFF — Track: Design-system lock + marketing-site ground-up rebuild

> Run this as the first message of a fresh Claude session in a worktree off clean `main`
> (`design/system-and-site`, e.g. `~/lab/caisson-design`). **Research-first, spec-first:** resolve
> the design-system-lock forks → sketch in `apps/studio` → then rebuild `apps/site` ground-up. **No
> production code before the design-system ADRs it implements are locked.** This is a `ui`/`frontend`
> tagged track (UI review + a11y audits fire at SHIP).

---

## Mission

Two phases, in order:

1. **Design-system lock + harden** — adopt the transplantable Wardfile playbook
   (`outputs/research/wardfile-frontend-playbook.md`) onto Caisson's existing token system, resolve
   the open recipe/quality forks, and lock them as append-only ADRs (number from **0099+**).
2. **Marketing-site ground-up rebuild** — rebuild `apps/site` on the locked kit + the hero/standout/
   diagram concepts (`outputs/research/marketing-hero-concepts.md`), kit-first.

## Read first (in this repo)

- `outputs/research/wardfile-frontend-playbook.md` — the target system (mechanism to copy vs brand to keep)
- `outputs/research/marketing-hero-concepts.md` — hero (Concept A "the denial") · standout ("break the
  chain") · signature diagram (caisson cross-section) · the **reference lock** (Axiom/Warp/Trunk/Trigger)
- `DESIGN.md` · `specs/04-voice-and-brand.md` · `knowledge/decisions/ADR-0042`/`0078` (brand floor) ·
  `ADR-0079` (SEO) · `ADR-0080` (copy) — **LOCKED, do not relitigate the brand**
- `packages/ui/src/tokens/{foundation,candidates,theme,types}.ts` + `scripts/gen-tokens-css.ts` (the token system)
- `apps/site/` (current marketing+docs app) + `apps/studio/` (the gallery)

## State of the design system (from the 2026-06-29 3-agent research)

**Caisson already owns playbook layer-1** — tokens-as-TS → codegen `--cs-*` CSS vars, two-tier OKLCH
(`foundation.ts` static + `theme.ts` semantic-flipping), a token-consuming `apps/studio`, and a strong
distilled-from-tokens `DESIGN.md` doctrine. **Brand swap is done** (`--wf-*`→`--cs-*`, palette A teal +
Structural type + waterline-over-chamber mark, all locked). So item 1 is **HARDEN, not build**.

**The real gaps** (the lock forks below): the component recipe (primitives live inline in `apps/site`
as global-BEM + inline-style, **not** in `packages/ui`; no Radix, no `data-*`, no co-located CSS, no
kit packaging) · 6 of 7 deterministic quality gates absent (only a partial hand-copied contrast test) ·
two token divergences (2-prong dark mode, no breakpoint ladder/`scrim`) · `apps/studio` consumes tokens
not components (drift risk) · Next version skew (site 16 / studio 15).

## Forks to resolve FIRST (research-backed recommendations; lock each via picker → ADR 0099+)

| #                                            | Fork                                                                                                                                         | Recommendation                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1 — Component recipe (the central fork)** | Adopt `data-*` variants + co-located per-component CSS + Radix behavior primitives, OR ratify the current BEM-global + inline-style approach | **Adopt the playbook recipe** (data-*/co-located-CSS, Radix for disclosure/dialog/toggle) — pure-cascade theming, kills the pervasive inline styles. Bigger refactor but it's the playbook's core value.                                                                                  |
| **F2 — Kit packaging**                       | Move the `apps/site/components` primitive set into `packages/ui` with a `./components/*` raw-`.tsx` export (kit-first)                       | **Yes — move them.** `packages/ui` is tokens-only today; the kit-first rule is non-negotiable for drift-proofing. Point `apps/studio` at the kit's components (gallery == product).                                                                                                       |
| **F3 — Dark mode prongs**                    | Add `@media (prefers-color-scheme)` + OS-seed in `ThemeToggle` (3-prong), OR ratify dark-default-only (2-prong)                              | **Ratify 2-prong (dark-default + manual override)** — "dark is the brand" (DESIGN.md). Cheap to add OS-follow later; not worth blocking. (Operator call.)                                                                                                                                 |
| **F4 — Breakpoint ladder + scrim**           | Add the one rem breakpoint ladder to `foundation.ts` + a `scrim` semantic token; reconcile `surface1/2`↔`surface/surfaceRaised`              | **Yes, all three** — the ladder unblocks the breakpoint guard; `scrim` is needed for overlays. Low-risk hardening.                                                                                                                                                                        |
| **F5 — Deterministic gates**                 | Which of the 6 missing gates to wire into `bun run check`                                                                                    | **All six, staged:** token-drift (regen+byte-compare), full contrast matrix (derive pairs from the token objects), anti-slop AST guard, TS-compiler copy guard, breakpoint guard, axe-both-modes + boundingRect overflow sweep. Plus a stable-ID `findings.toml` for the advisory critic. |
| **F6 — Video pipeline vs CSS/SVG signature** | Build the hermetic-boot→Playwright→Remotion→ffmpeg video pipeline, OR lean on tokenized CSS/SVG signature animation                          | **CSS/SVG signature animation** for v1 (the "break the chain" standout is SVG+tokenized motion — cheaper, on-brand, no new toolchain). Defer the video pipeline unless a real product capture is needed.                                                                                  |
| **F7 — Next version align**                  | Align `apps/studio` (Next 15) to `apps/site` (Next 16)                                                                                       | **Align to 16** during the rebuild.                                                                                                                                                                                                                                                       |
| **F8 — Icons**                               | Phosphor (playbook) vs Lucide (locked ADR-0078)                                                                                              | **Keep Lucide** — intentional brand lock; do not swap.                                                                                                                                                                                                                                    |

## Phase 1 — design-system lock + harden (after forks locked)

Harden the token layer (F4), build the component kit in `packages/ui` (F1/F2: Radix + co-located CSS +
`data-*` + local-indirection vars, kit-first), wire the deterministic gates (F5), repoint `apps/studio`
at the kit + add the Components gallery. **Sketch the kit + the hero/diagram in `apps/studio` before the
site rebuild** (the operator's explicit sequence). Exit: `bun run check` green incl. the new gates;
studio renders the full kit; tokens.css drift-guarded.

## Phase 2 — marketing-site ground-up rebuild (kit-first, on the locked system)

- **Architecture:** one consistent route group; consolidate the 3 chrome-mounting patterns; `SiteNav`
  → RSC + tiny active-link island; `MARKETING_ROUTES` → `sitemap` 1:1.
- **SEO:** introduce the `IntentLadder` template + per-page **data files** (replace the hand-authored
  270–680-line pages); keep the existing centralized `buildMetadata`/`jsonld` (already playbook-grade).
- **Hero & beats (`outputs/research/marketing-hero-concepts.md`):** Concept A "the denial" at the fold
  (evolves the shipped `home-hero-motion.tsx`) → "break the chain" standout one scroll down → the
  caisson cross-section signature diagram → "code → signed proof" mid-page. Four beats: deny→chain→hold→sign.
- **Conversion:** keep the live self-serve posture (ADR-0082); the "Contact us" Enterprise tier
  (ADR-0095); product-updates capture (not a waitlist). Static export ⇒ A/B + edge logic in CF
  `functions/` (no Next middleware). **Drop the coming-soon framing** (retired by ADR-0082); the CF
  Access gate stays until commerce-ready (a launch act, not this track).
- **Honesty boundary (ADR-0080 §3):** show _generated evidence_; never imply Caisson is itself certified.

## Locked — do NOT relitigate

Brand floor (ADR-0042/0078/0079/0080, specs/04, DESIGN.md) · palette A teal + Structural type +
waterline-over-chamber mark · Lucide icons · live self-serve + committed-pricing posture (ADR-0082) ·
the tokens-as-TS→codegen mechanism (keep + harden) · the centralized SEO module (keep).

## Exit criteria

Design-system ADRs (0099+) locked · component kit in `packages/ui` consumed by both `apps/studio` +
`apps/site` (no drift) · the 6 deterministic gates green in `bun run check` · `apps/site` rebuilt
kit-first with the four-beat hero narrative · UI-review + a11y (axe both modes) audits pass at SHIP ·
goal-backward VERIFY against this kickoff.

## Cross-track note

Open-core re-licensing (ADR-0094, W1) touches `apps/site` licensing **copy** only — coordinate the copy
change but it does not block this track. This track touches `packages/ui` + `apps/site` + `apps/studio`
(disjoint from the code/wiring track's `services/*` + `packages/{migrate,cli,…}` + `tooling/`), so the
two tracks can run as parallel disjoint-tree worktree streams per the playbook §4.
