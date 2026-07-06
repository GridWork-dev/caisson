# ADR-0263 — Remotion media pipeline: static pre-rendered mp4, apps/site/remotion source, audit-worm pilot, stackCompat bundled

**Status:** accepted · 2026-07-06 (Kickoff-F picker round 2, dx-demos-compat session).
Fills the ADR-0237 F2 media contract ("real media is a later phase, TBD" — this is that
phase); respects ADR-0078 §6 (tokenized motion) and the 2026-07-03 operator directive
("no generative art system, media is produced before launch"). Append-only.
**Tags:** ui, frontend.

## Decision

1. **Static pre-rendered h264 mp4 assets** in `apps/site/public`, embedded via a plain
   `<video>` element in the `media` section renderer arm + the four edition-page slots.
   The Remotion renderer (headless Chrome + FFmpeg) **never runs in the deployed Next
   process** — Remotion documents in-app rendering as unsupported; rendering is an offline
   script only. `@remotion/player` runtime embeds rejected (210 kB min/65 kB gz client JS
   for content that never varies at runtime).
2. **Composition source lives in `apps/site/remotion/`** (Remotion's own Next.js pattern),
   excluded from the Next build/tsconfig so composition code never enters the app bundle.
   Compositions consume the `--cs-*` tokens and the ADR-0078 §6 motion tokens
   (120/180/240 ms, authored easings) — the kit is the video design system.
3. **Pilot: one audit-worm video** (append → tamper-attempt → verify-catches-it, the
   trusted-length-oracle story) on the audit-worm module depth page. Fan-out to the other
   18 slots only after the pilot validates pipeline, brand fidelity, and file-size posture.
4. **The `stackCompat` badge-row section kind ships in this same wave** (operator pick above
   the separate-follow-up rec): one new PageSection kind + switch arm reusing `StatusChip`,
   rendering compatibility data — sequenced AFTER the W4 matrix corrections (ADR-0265) so
   the badge row is authored from corrected rows, never the stale table.

Rejected: **@remotion/player embeds** (bundle cost, runtime dependency, contradicts the
produced-before-launch directive); **a tooling/video workspace** (tooling/ is the closed
gate/lint/test tree per docs/architecture.md — taxonomy drift).

## Consequences

- Remotion license: free for a for-profit org ≤3 employees (verified 2026-07-06 at
  remotion.dev/docs/license). **Re-verify on any headcount change** — the Company License
  (~$100/mo entry) triggers at 4+.
- The render script needs an explicit exit guard (documented Remotion-under-Bun caveat:
  SSR scripts may not quit) or runs under Node.
- First binary video asset in `apps/site/public` (16 KB today) — check size/caching posture
  on the Railway standalone deploy before fan-out multiplies assets.
