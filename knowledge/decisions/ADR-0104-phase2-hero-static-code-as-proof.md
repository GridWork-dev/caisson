# ADR-0104 — Phase-2 marketing hero: static code-as-proof (three.js signature spike deferred)

**Status:** accepted · 2026-06-29 (design-marketing-rebuild track — operator hero pick).
**Relates:** ADR-0102 (signature = tokenized CSS/SVG four-beat — direction stands, execution deferred) ·
ADR-0103 (signature sketch deferred-for-rework; blank slot reserved) · ADR-0080 §1–§3 (code-as-proof
copy register + honesty boundary) · ADR-0079 (CWV + a11y CI baseline) · ADR-0078 §6/§8 (tokenized
motion + ≤10% accent budget) · ADR-0082 (live self-serve posture). **Evidence:** exa research on
react-three-fiber under Next static export + CWV practice (the universal "hero text wins LCP, not the
canvas" finding); the `outputs/research/marketing-hero-concepts.md` four-beat plan (now amended).

## Context

The kickoff (`outputs/kickoffs/design-marketing-rebuild.md` Phase 2) planned the marketing hero as the
**four-beat signature** (deny→chain→hold→sign), evolving `home-hero-motion.tsx`. ADR-0103 deferred the
signature for rework, removing that centerpiece and leaving the Phase-2 hero direction unset. The
operator asked whether three.js could carry the hero instead.

three.js was researched: it **runs** on this stack (pure client-side WebGL; the `<Canvas>` mounts
client-only via `next/dynamic ssr:false`; static export has no SSR and Cloudflare Pages serves the
static bundle host-agnostically). But every production source converges on the same rule — **the hero
headline + CTA must be real HTML that wins LCP; the canvas is a lazy, layered enhancement** (mobile →
static poster, `prefers-reduced-motion` → skip WebGL), or it fails the ADR-0079 CWV/a11y gate. A
generic WebGL hero also reads as marketing flash, which undercuts the rigor/code-as-proof positioning
(ADR-0080) and risks the brand floor's anti-slop stance (ADR-0078).

## Decision

**Hero = static code-as-proof (option 1).** The fold is a real-HTML headline + CTA + a kit
`Terminal`/`CodeBlock` rendering the fail-closed RLS denial (the proof the static design can carry
honestly). Text and code carry LCP; no motion centerpiece is required to ship. A **blank slot is
reserved** in the page composition for the eventual signature.

**three.js is deferred to a future studio-candidate spike**, not adopted now. When revisited it will be
explored the same way the wordmark was — **live candidates rendered in `apps/studio`** (`/design/signature`,
the reserved surface) for the operator to pick: a restrained, _authored_ scene tied to the caisson
metaphor (the pressure vessel under load · the audit chain rejecting a tampered block · the field-crypto
seal), never a generic particle hero. That choice (three.js vs the locked ADR-0102 CSS/SVG four-beat) is
its **own future fork**, gated by the CWV/a11y baseline and the ≤10% accent budget.

## Consequences

- Phase-2 ships with no motion dependency and no blocked LCP; the four-beat motion is **not** built in
  this track. `home-hero-motion.tsx`'s role is reduced (kept only if it still earns a place as a small
  below-fold beat; otherwise retired with the rebuild).
- The signature slot stays **reserved + blank** on the site until a future spike resolves it.
- No new heavy dependency (`three`/`@react-three/fiber`/`drei`) enters the repo in this track — avoids a
  new audit/bundle surface for now. (All are MIT, cleared for the future spike.)
- The three.js direction is parked on the board as a deferred (non-blocking) future fork.

## Alternatives considered

- **Option 2 — evolve `home-hero-motion` into the hero (the ADR-0102 "deny" beat):** rejected for now —
  it partially resurrects the deferred signature motion the operator pulled, and ties LCP to a canvas.
- **three.js hero now:** rejected — bundle/CWV cost, brand-flash risk, and it would auto-commit the
  deferred signature fork. Kept as a future studio-candidate spike instead.
