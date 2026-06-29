# ADR-0100 — Marketing signature animation: tokenized CSS/SVG, video pipeline deferred

**Status:** accepted · 2026-06-29 (design-system-harden track — operator lock, picker round F6).
**Relates:** ADR-0078 §6 (expressive tokenized motion — the bounding craft law), ADR-0080 §3 (honesty
boundary), ADR-0079 (CWV/a11y baseline), ADR-0084 (`apps/site` static export → CF Pages). **Adopts** the
direction of `outputs/research/marketing-hero-concepts.md` (the four-beat narrative + reference lock).
Evidence: the 2026-06-29 grounding (`outputs/kickoffs/design-marketing-rebuild.md` F6;
`apps/site/components/home-hero-motion.tsx:13-92`).

## Context

The marketing rebuild needs a signature "wow" surface. The playbook ships a heavy path — a hermetic-boot →
Playwright capture → Remotion composite → ffmpeg-encode **video pipeline** committing `hero.mp4`. But the
hero-concepts research specifies **every** wow-moment as **tokenized inline-SVG/CSS motion** (transform /
opacity / color via `--cs-*`, reduced-motion-gated, scroll-triggered once, never looping) and contains
**zero** mention of video. Concept A ("the denial") is explicitly an **evolution of already-shipped code** —
`apps/site/components/home-hero-motion.tsx`, a line-by-line RLS-denial reveal already using
`--cs-duration-slow` / `--cs-ease-reveal`, a 90ms stagger, reduced-motion gating, and SSR-safe full-text
markup. The video pipeline is the most infra-heavy piece (it depends on an e2e/audit hermetic-boot
substrate that does not exist) and sits in the marketing **surface** layer, unrelated to the token/component
foundation. (`outputs/research/marketing-hero-concepts.md:32-74`.)

## Decision

**Build the v1 signature animation as tokenized CSS/SVG; defer the video pipeline.**

The four-beat narrative — **deny → chain → hold → sign** — renders entirely in tokenized CSS + inline SVG:

- **deny (hero/fold):** Concept A "The Denial" — **evolve** `home-hero-motion.tsx` (the proven
  arm→rAF→staggered-reveal of the fail-closed RLS `psql` denial); single above-fold `--cs-glow-accent`
  instrument light on the framed terminal.
- **chain (one scroll down):** the "Break the Chain" standout — SVG hash-chain tiles; one block edits, its
  hash recomputes, every link after turns danger-red, `verifyChain()` flips OK→FAIL. Tokenized
  transform/opacity/color, reduced-motion-gated to a **static broken state**, scroll-triggered once, never
  looping.
- **hold (mid-page):** the **caisson cross-section** signature diagram — inline SVG on `--cs-surface-1`,
  scroll-revealed (architecture + evidence-pipeline + metaphor, triple-duty).
- **sign (mid-page):** "code → signed proof" — the control→clause map + `caisson evidence pack` materializing
  a signed manifest.

All motion stays inside the ADR-0078 §6 craft law (tokenized `--cs-duration-*`/`--cs-ease-*`,
transform/opacity-first, `prefers-reduced-motion` honored with content never stuck at `opacity:0`, no
looping/gimmick, accent ≤10%). The danger-red "break" beat uses the reserved `danger` functional token, not
a new accent. The honesty boundary (ADR-0080 §3) binds: animations show **generated evidence**, never imply
Caisson is itself certified.

The **video pipeline is deferred** (not cancelled): it becomes a fast-follow only if a real product capture
is needed, and would require the hermetic-boot e2e substrate first. The gated `<video muted loop playsInline>`
player pattern (reduced-motion → static poster, IntersectionObserver → load-on-scroll) may be adopted later
without reopening this ADR.

## Rejected

- **Build the hermetic-boot → Playwright → Remotion → ffmpeg video pipeline for v1** — the most
  infrastructure-heavy option, depends on an e2e substrate that does not exist, and is unsupported by the
  hero-concepts research; it would block the marketing rebuild on heavy infra unrelated to the foundation.
  Deferred.

## Binding

- The v1 four-beat signature (deny/chain/hold/sign) renders as **tokenized CSS + inline SVG**; Concept A
  evolves `home-hero-motion.tsx`.
- All motion obeys the ADR-0078 §6 craft law + the ADR-0080 §3 honesty boundary; the "break" beat uses the
  reserved `danger` token.
- The **video pipeline is deferred** to a possible fast-follow (real product capture only); the gated
  `<video>` player pattern may be added later without a new ADR.

Implementation in Phase 2 of the track (the marketing-site rebuild), on the kit locked by ADR-0097/0098/0099.
