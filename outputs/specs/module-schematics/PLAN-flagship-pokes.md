# PLAN — flagship-4 pokes (ADR-0378 slice 1)

Branch: `admin/caisson-145-module-schematics-design-kickoff-bespoke-blueprint-system`
(on top of PR #326's pilot sheets, per the hold-the-branch lock).

## Wiring (main thread owns these shared files)

- `apps/site/lib/media-manifest.ts`: new `SlideKind "poke"` + `PokeKey` union
  (`field-crypto | audit-worm | ai-meter | guardrails`) + `MODULE_POKES` record
  (module id → { poke, caption }) + `BUNDLE_POKES` (compliance ← field-crypto ·
  ai-kit ← ai-meter · provenance ← audit-worm; the hero member's poke verbatim).
  `mediaSlides()` reorders per ADR-0378: module depth = schematic sheet → poke →
  component → code-artifact (unless omitted) → remaining diagrams; bundle = strata
  sheet → composition → borrowed poke → remaining diagrams. New option
  `leadWithPoke` (preview dialog/card viewer passes it) hoists the poke to slide 1.
- `apps/site/components/media-carousel.tsx`: `POKE_SLIDES` registry (dynamic,
  ssr:false, MediaPlaceholder loading) + `Slide()` case for `kind === "poke"` +
  arrow-key fix: the carousel's ArrowLeft/ArrowRight handler ignores key events
  originating inside `[data-poke]` (a poke owns its keyboard interaction).

## The four pokes (parallel builders; each owns ONLY its three files)

Files per poke, under `apps/site/components/poke/`:
`<slug>-logic.ts` (pure deterministic engine, no React) ·
`<slug>-logic.test.ts` (golden parity vs the package's `__golden__` fixtures) ·
`<slug>-poke.tsx` ("use client" component; imports the logic + the shared rig).

Shared rig (main thread, built first): `apps/site/components/poke/poke-rig.tsx` +
`poke-rig.module.css` — PokeShell (MediaFrame NON-decorative, `data-poke`, title,
trust line "Runs entirely in your browser. Nothing leaves this page."), Verdict
(ok/fail/neutral line), shared control styles, reduced-motion helper.

Binding rules (ADR-0378 lock 2): real primitive client-side (WebCrypto HKDF/
AES-GCM/SHA-256 where the package's node:crypto isn't browser-safe — mirrored and
GOLDEN-PINNED against the package fixture; import the package's own pure functions
directly where browser-safe); tamper/break-it control on every security-adjacent
poke; every identifier real and cited; token system only, both themes; 44px
targets; reduced-motion safe; no fetch/persist/measure; ≥1 golden parity test.

Specs: kimi's CANDIDATES-KIMI.md §B flagships F1–F4 (worktree `caisson-wt-kimi`,
copy in the session scratchpad) — F1 field-crypto envelope bench · F2 audit-worm
break-the-chain · F3 ai-meter breaker console · F4 guardrails boundary.

## After build

Manifest wiring → gates (`bunx turbo run lint test --filter=@caisson/site` + tsc)
→ screenshots (both themes, desktop+mobile, the 4 module pages + compliance/ai-kit/
provenance bundle pages) → operator screenshot review (the cadence gate) →
then class rigs + remaining sheets + the C1/D2/E2 surface lane.
