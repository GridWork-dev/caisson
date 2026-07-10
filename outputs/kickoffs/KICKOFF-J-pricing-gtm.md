# Kickoff J — Pricing + GTM sitting (non-code, main-thread)

**Status: READY — operator-selected 2026-07-10 (close-out kickoff split).** Non-code sitting:
owns `outputs/`, `docs/gtm/`, and Linear work items only. Touches **no product tree** — no
`packages/*`, `apps/*`, `services/*`, `infra/*`, or CI. Runs on the main thread (research +
synthesis + operator fork rounds), not a build wave.

**Provenance:** the pricing/GTM residue after the close-out sweep — the Cookiy WTP row + the
market-intel tickets + the design-partner program lock, all standing in
`docs/state/outstanding-work.md` §1.

## Scope (all four land this sitting)

1. **D2/D3 pricing picker** — run `gw-pricing-analyst` (never sets a price) over
   `qual(final)` + the frame-test result + the $1,049 ladder rung from
   `outputs/research/wtp-synthesis-partial-2026-07-09.md`, produce the WTP memo, then the
   operator locks the price forks. The panel is off-ICP so the VW leg cannot validate the
   anchor — the picker runs on qual + frame + ladder, not on waiting for 60/60 fill.
2. **VW recruit reallocation** — resolve the open fork: let the VW leg (445432) fill vs.
   stop + retarget the recruit toward the real-ICP round. Decision + Cookiy action.
3. **Design-partner program execution (ADR-0297)** — terms LOCKED (5 partners · 40% off ·
   12-month reverting · case-study contingent). Author the partner-facing terms one-pager +
   the recruiting/outreach list; the actual outreach stays an operator GTM act.
4. **Market-intel ticket triage** — the 5 filed CAISSON tickets from
   `outputs/research/market-intel-2026-07-09.md` (Delve-scandal GTM copy, AuditKit parity,
   MCP-parity reframe, …): rank, accept/defer each, and hand the accepted-copy items to
   `gw-gtm-copywriter` as scoped follow-ups (their builds are a later site sitting, not here).

## Binding rules

- **Never sets a price** — `gw-pricing-analyst` produces the memo; the operator locks every
  number as an ADR. Pricing display forks stay operator-owned (CLAUDE.md "Still open").
- Linear owns WORK, git owns DECISIONS — locks land as ADRs, not Linear.
- Cookiy = positioning research only, no PII. PostHog = `caisson-prod` per dispatch.
- Every agent dispatch sets `model` explicitly.

## Exit criteria

- WTP memo delivered + the pricing forks presented to the operator (locked or explicitly
  deferred as ADRs); VW-recruit disposition decided + actioned in Cookiy.
- Design-partner one-pager + outreach list committed under `docs/gtm/`.
- All 5 intel tickets dispositioned; accepted-copy items scoped as Linear follow-ups.
- Nothing here mutates a product tree — the sitting lands as `outputs/`/`docs/gtm/` commits + ADRs.
