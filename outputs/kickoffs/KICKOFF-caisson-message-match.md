# KICKOFF — message-match copy fixes, D12 of the board fork-walk (site sitting)

**Lane:** solo worktree `/home/gw/lab/caisson-wt-copy`, branch `fix/site-message-match` (cut from
`main` @ `45707a1a`). One PR (ADR-0328 wave convention), conventional commits (`fix(site): …`).
**Open the PR and leave it unmerged — the coordinator merges on green.** This is D12 of the
2026-07 board audit fork-walk, operator-picked "do now" 2026-08-09. Evidence grounds:
`outputs/audit/2026-07-board/BOARD-REPORT.md` (PRD-3/4/5/6/8; E-D4, E-D7, E-B4, E-D10, E-D5).

**This carries the `ui` tag → the in-session SHIP audit lane (gw-code-reviewer +
gw-frontend-designer-grade review of the diff) runs BEFORE the PR opens.**

## The five items (all copy/config truth — no new research)

1. **Name the frameworks at hero level.** ISO 27001 (+ NIST 800-53) appear nowhere on the
   homepage (verified 2026-08-09) — buyers searching the incumbent frame never see their words.
   Name them at hero level on `apps/site/app/(marketing)/page.tsx` within the existing copy laws.
2. **Surface the month-13 answer at the decision point.** What happens after year one (updates
   subscription, license perpetuity, evidence-pack continuity) must be answered where the buying
   decision happens (pricing / checkout adjacency), not buried. No month-13 copy exists today.
3. **Defuse the price-footnote implied-validation read.** The pricing footnote currently reads as
   if the price were market-validated. Reword to the committed-price truth. NOTE (fresh lock,
   same walk): **$1,449 Compliance is now LOCKED as final (D4, ADR filed at capture)** — copy
   must state the committed price plainly; no "subject to change", no validation implication.
4. **Instrument `/partners`.** `apps/site/app/(marketing)/partners/page.tsx` lines ~190 + ~213
   are bare `mailto:` links — zero signal on intent. Replace with a form or a tracked click
   (existing PostHog client; event like `partners_apply_click`), keeping the mailto as the
   fallback action. No new vendor, no PII beyond what the existing analytics posture allows.
5. **Sentrik + Probo compare pages.** `app/(marketing)/compare/[slug]` infrastructure exists;
   neither competitor has a page and neither name appears anywhere in site lib/content. Build
   both per the gw-gtm-copywriter discipline: every competitor claim scraped + dated (source
   URL + retrieval date in the page data), no invented weaknesses, our-side claims artifact-true.

## Binding constraints

- **ADR-0080 copy laws** + `identity/voice.md`; **ADR-0237 rider 2 FULL V1-live posture** — no
  roadmap labels, no "coming soon", no future framing.
- **Artifacts true-to-built is the floor (ADR-0082):** every claim must be true of the shipped
  product TODAY. Two known-false claims exist elsewhere on the site (npm install line, sandbox
  pay path — D1, operator-deferred to launch): do NOT add copy that repeats or compounds either;
  items 1–5 must not reference the npm command or live-payment claims.
- Brand floor: design tokens + `identity/design-system.md`; no new visual language — this is a
  copy/instrumentation sitting, not a redesign.
- Prices: $1,449 Compliance committed (D4 lock). The displayed number does not move.

## Verification

```sh
bun install
bunx turbo run typecheck test build --filter=site
bunx turbo run lint --filter=site
bun run sot                       # BEFORE the PR (project memory)
```

- Item 4 proof: the PostHog event fires in a local run (or the form posts), and the page still
  renders with JS disabled (mailto fallback intact).
- Item 5 proof: both compare pages build statically, every competitor claim carries a dated
  source, and the pages pass the SHIP audit's copy-law check.
- SHIP audit (ui tag) runs in-session on the final diff BEFORE opening the PR; findings fixed
  in-branch.

## Hard don'ts

- No claims about npm installability or live payment (D1 territory, deferred).
- No price changes, no new packages, no dependency changes.
- No touching `apps/demos` (separate zone) or any non-site tree.
- No force-push; no merge — the coordinator merges.
