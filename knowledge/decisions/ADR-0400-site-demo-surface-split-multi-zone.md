# ADR-0400 — Site demo-surface split: multi-zone `apps/demos`, same origin

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the 2026-08-09 ponytail-audit remediation picker)
- **Parent:** ADR-0114/0115 (one dynamic Next standalone app on Railway — amended: the DEMO
  surface leaves that unit) · ADR-0378/0396 (the poke program and real-package pokes this
  moves) · ADR-0082 (live self-serve posture — unchanged)
- **Supersedes:** ADR-0114/0115 in part (the single-app scope no longer includes demos)

## Context

`apps/site` is the repo's god node: ~76k TS/TSX LOC and 50 internal `@caisson/*` dependencies
in the revenue-critical deploy unit — roughly 27 of those dependencies exist solely to power
the interactive pokes (`components/poke/`, lazy-loaded via `components/media-carousel.tsx`).
Every package change therefore rebuilds and redeploys the revenue site, and the July board
audit already named apps/site "the one place deletion is likely to pay." The operator locked
splitting the demo surface out THIS wave, in the multi-zone shape.

## Decision

1. **A new `apps/demos` Next app owns the poke surface** — the poke components, their sample
   data, and the ~27 `@caisson/*` dependencies that exist only for them.
2. **Same origin via Next multi-zone:** `apps/site` rewrites `/demos/*` to the demos service
   (`next.config` rewrite). No new public hostname, no CSP frame-src changes, no CF bot-rule
   churn — the origin story is unchanged.
3. **Module pages keep inline demos via same-origin iframes** at `/demos/embed/<module>`;
   the demos app serves minimal embed routes per module. Marketing UX is preserved.
4. **Deploy order is fail-safe:** the new Railway service exists and serves before the site
   rewrite flips. Creating the service is an external-system act — **operator-paged, never
   auto-run**; the rewrite merges only after the demos service answers its health route.
5. **Target:** site's internal dependency count drops from 50 to roughly the low twenties;
   package-only changes stop triggering revenue-site redeploys.

## Consequences

- A sixth Railway service (demos) joins the fleet: deploy receipts, `docs/deploy/STATE.md`
  rows, and the parity/health probe set extend to it.
- `deploy-railway.yml` and `tooling/scripts/railway-deploy.ts` service lists gain the new
  service; turbo graph splits accordingly.
- The split PR carries the `ui` tag → in-session SHIP audit lane before it opens.

## Rejected

- Subdomain (`demos.caisson.sh`) — cross-origin iframes force frame-src CSP, DNS, and CF
  bot-rule review for the same payoff multi-zone gets free.
- Link-out hub — removes inline demos from marketing pages; a conversion-surface UX
  regression nobody asked for.
- Staying monolithic and documenting the coupling — operator explicitly chose the split.
