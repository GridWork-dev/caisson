# SPEC — Module schematics design kickoff (ADR-0376 lock 2)

status: SHIPPED — PR #326; production re-audit 729/729 fixed
date: 2026-07-22
tags: ui, frontend

## Goal

Replace the 14 accepted empty-illustration-placeholder surfaces with a bespoke
blueprint/cross-section schematic system per DESIGN.md §5 ("blueprint / cross-section
schematics for the how-it-holds architecture story"). Every module/bundle page's media
slot carries a real, page-specific architecture schematic or a live artifact — never an
empty grid with a lone icon.

## Scope (the 14 accepted ledger surfaces)

Module pages: ai-evals · local-store · retention-runner · audit-worm · field-crypto ·
alerting · agent-runner · agent-kernel · guardrails · ai-meter · prompt-registry.
Bundle pages: agentic-dev · compliance · ai-kit.

Kickoff-I precedent (ADR-0308) already upgraded five modules to live-component slides
(audit-worm ChainViewer · ai-meter UsageChart · prompt-registry PromptBrowser ·
local-store StoreSearch · credits LedgerList) — those pages keep their live slides; this
kickoff fills the remaining schematic slot per page or replaces the slot where a live
slide already carries the story.

## Approach (design-track, operator-in-loop per WS10)

1. **Research**: refero screen research on architecture-diagram treatments + the
   existing brand system (ADR-0078; grid-paper texture, elevation/glow, accent budget
   per ADR-0375 lock 2).
2. **Illustration system first, instances second**: one schematic vocabulary (node,
   seam, boundary, flow, WORM band, crypto boundary), one component or SVG pipeline that
   renders it theme-following (light/dark from tokens — no baked colors), THEN the ~14
   per-page diagrams as data.
3. **Honest-artifact floor** (ADR-0082/0237): every schematic depicts the real package
   architecture (real seam names, real port names from the code) — a diagram is a claim.
4. Gates: contrast gate on any new token pairs, golden re-snapshots, e2e on touched
   pages, the standard SHIP audit lane.

## Non-goals

No stock illustration, no video, no invented topology, no new accent spend beyond the
ADR-0375 eyebrow/accent budget. No new SKU or copy changes.

## Verification

The accepted ledger rows for these 14 surfaces close by re-audit (absent from the run →
fixed) only after the schematics ship; the ADR-0376 lock-4 audit round (or the next
scheduled audit after this kickoff) is the closing instrument.
