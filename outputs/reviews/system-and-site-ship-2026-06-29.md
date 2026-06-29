# SHIP review + goal-backward VERIFY — design/system-and-site (2026-06-29)

Track: design-system lock + marketing-site rebuild (kickoff `outputs/kickoffs/design-marketing-rebuild.md`).
Tags: `ui` / `frontend` → UI review + a11y (axe both modes) fire at SHIP.

## Goal-backward VERIFY (vs kickoff exit criteria)

| Exit criterion                                                                     | Verdict                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design-system ADRs (0097+) locked                                                  | **PASS** — ADR-0097–0102 locked (recipe/tokens/gates/signature/mark + 0102 hero).                                                                                                                                                                         |
| Component kit in `packages/ui` consumed by both studio + site (no drift)           | **PASS** — site repointed kit-first this phase; inline dup primitives (icon/brand/reveal/theme-toggle/ui) deleted; studio consumes the kit.                                                                                                               |
| 6 deterministic gates green in `bun run check`                                     | **PASS** — gates 1–5 green in `bun run check`; gate 6 (axe both-modes) is the operator-locked axe-at-SHIP pass, performed via the 8-dimension review this phase (and the contrast gate was extended to cover the functional tokens it had been blind to). |
| Site rebuilt kit-first with the hero narrative                                     | **PASS (scope-adjusted)** — rebuilt kit-first; hero = **ADR-0102 static code-as-proof** (the four-beat/signature was operator-deferred via ADR-0102, blank slot reserved). Not the original four-beat — a locked change, not a miss.                      |
| UI-review + a11y audits pass at SHIP                                               | **PASS** — 8-dimension review returned fix-before-ship (0 blockers, 3 majors); all 3 majors fixed + verified.                                                                                                                                             |
| Phase-2 architecture (SiteNav→RSC, MARKETING_ROUTES→sitemap, chrome consolidation) | **PASS** — all three shipped + verified.                                                                                                                                                                                                                  |
| SEO IntentLadder + per-page data files                                             | **DEFERRED** (operator) — recon showed the rigid scaffold a poor fit; recorded on the board with forward options.                                                                                                                                         |

**Overall: PASS** — ship. Two operator-locked scope changes (ADR-0102 hero; deferred SEO), both recorded.

## UI review (8-dimension fan-out, 12 agents) — verdict + disposition

**fix-before-ship → resolved.** 0 blockers. Honesty boundary clean (no "Caisson is certified"
anywhere). Focus-visible present on every shipped interactive element. Dark theme (brand default) flawless.

### Majors (3) — FIXED (commit a5548d0)

1. Light-theme functional tokens (`--cs-success/danger/warning/info`) inherited dark values → success
   chip 2.19:1, danger token 3.29:1 on light (fail AA, zero-click via OS-follow). → per-mode functional
   sets, light darkened to L~0.50 (culori-verified ≥4.5); contrast gate extended to cover them.
2. Light `--cs-accent` (0.55) → eyebrows/CTA/skip-link 3.64–4.31:1. → darkened to oklch(0.50 0.13 215).
3. `/agentic-dev` hero horizontal overflow 360–412px. → `min-width:0` + `minmax(0,1fr)` in hero.css +
   shortened the credential chip; page overflow now 0 at 390px.

### Minor defects — FIXED (commit 032c69c)

- EditionCard featured-lead lost its accent on hover → `[data-lead]:hover` keeps accent + glow.
- Mobile nav drawer had no active-page/hover cue → added the rule.
- AI-Kit shown "(in development)" on eu-ai-act vs available elsewhere → dropped the parenthetical.

### Deferred follow-ups (non-blocking — tracked for a polish pass)

Minors: GDPR named in the hero strip without a clause receipt (positioning call — operator); theme-init
inline+CSP-hash vs external script (perf, ~1 RTT); ThemeToggle absent in the mobile drawer (degrades via
OS-follow); home band cadence flat (all `surface`, no `tint` closing lift); two closing sections not
`Reveal`-wrapped; `text-wrap: balance/pretty` on titles/lede; mobile touch targets 36–42px (<44 comfort,
clears the 24 AA floor); pricing RSC-prefetch 404s (local `.html`-serve artifact only). Nits (15): hex
mirror comments, label drift (AI-Kit CTA), font over-preload, 14 stylesheet links, EditionCard
forced-colors pin, interactive-Card focus (latent), `.cs-cta-row`/`.cs-card-title` kit↔app dup.

Full review payload: workflow `wf_f3d04e85-73d`.
